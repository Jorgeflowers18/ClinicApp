using System.Net;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class PatientsTests(ApiFactory api)
{
    [Fact]
    public async Task Sin_sesion_responde_401()
    {
        var response = await api.Anonymous().GetAsync("/api/patients");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("recepcion")]
    [InlineData("medico")]
    public async Task Los_tres_roles_crean_y_editan(string role)
    {
        var client = await api.As(role);
        var created = await client.CreatePatientAsync();

        var body = TestData.PatientBody(documentId: created.Str("documentId"), firstName: "Editado");
        var updated = await client.PutJson($"/api/patients/{created.Id()}", body, HttpStatusCode.OK);

        Assert.Equal("Editado", updated.Str("firstName"));
    }

    [Fact]
    public async Task Crear_asigna_numero_de_historia_correlativo_y_notificaciones_activas()
    {
        var client = await api.As("admin");
        var body = TestData.PatientBody();
        body.Remove("notificationsEnabled");

        var first = await client.PostJson("/api/patients", body, HttpStatusCode.Created);
        var second = await client.CreatePatientAsync();

        Assert.Matches(@"^HC-\d{6}$", first.Str("clinicalRecordNumber"));
        var firstNumber = int.Parse(first.Str("clinicalRecordNumber")[3..]);
        var secondNumber = int.Parse(second.Str("clinicalRecordNumber")[3..]);
        Assert.True(secondNumber > firstNumber);
        Assert.True(first!["notificationsEnabled"]!.GetValue<bool>());
        Assert.Null(first["deletedAt"]);
    }

    [Theory]
    [InlineData("firstName", "A")]
    [InlineData("lastName", "")]
    [InlineData("documentId", "123")]
    [InlineData("phone", "12345")]
    [InlineData("email", "no-es-correo")]
    [InlineData("gender", "x")]
    [InlineData("birthDate", "1899-01-01")]
    [InlineData("birthDate", "2999-01-01")]
    [InlineData("birthDate", "12/05/1990")]
    [InlineData("maritalStatus", "comprometido")]
    [InlineData("treatmentStatus", "raro")]
    public async Task Crear_valida_cada_campo(string field, string value)
    {
        var client = await api.As("recepcion");
        var body = TestData.PatientBody();
        body[field] = value;

        var error = await client.PostJson("/api/patients", body, HttpStatusCode.BadRequest);

        Assert.True(error.HasError(field), $"Se esperaba un error en {field}: {error}");
        Assert.Equal("Revisa los datos ingresados", error.Str("title"));
    }

    [Fact]
    public async Task Nacimiento_hoy_se_acepta()
    {
        var client = await api.As("admin");
        var body = TestData.PatientBody();
        body["birthDate"] = TestData.TodayInClinic().Iso();

        await client.PostJson("/api/patients", body, HttpStatusCode.Created);
    }

    [Fact]
    public async Task Cedula_repetida_responde_409_con_el_campo()
    {
        var client = await api.As("admin");
        var document = TestData.DocumentId();
        await client.PostJson("/api/patients", TestData.PatientBody(document), HttpStatusCode.Created);

        var error = await client.PostJson("/api/patients", TestData.PatientBody(document), HttpStatusCode.Conflict);

        Assert.True(error.HasError("documentId"));
    }

    [Fact]
    public async Task Dos_altas_simultaneas_con_la_misma_cedula_crean_solo_una()
    {
        var client = await api.As("admin");
        var document = TestData.DocumentId();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ =>
            client.PostAsync("/api/patients", System.Net.Http.Json.JsonContent.Create(TestData.PatientBody(document)))));

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(4, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Editar_no_cambia_el_numero_de_historia_y_valida_la_cedula()
    {
        var client = await api.As("admin");
        var patient = await client.CreatePatientAsync();
        var other = await client.CreatePatientAsync();

        var body = TestData.PatientBody(documentId: patient.Str("documentId"));
        body["clinicalRecordNumber"] = "HC-999999";
        var updated = await client.PutJson($"/api/patients/{patient.Id()}", body, HttpStatusCode.OK);
        Assert.Equal(patient.Str("clinicalRecordNumber"), updated.Str("clinicalRecordNumber"));

        var conflict = await client.PutJson($"/api/patients/{patient.Id()}", TestData.PatientBody(other.Str("documentId")), HttpStatusCode.Conflict);
        Assert.True(conflict.HasError("documentId"));
    }

    [Fact]
    public async Task Se_puede_editar_un_paciente_importado_que_comparte_cedula()
    {
        var client = await api.As("admin");
        var first = await client.CreatePatientAsync();
        var second = await client.CreatePatientAsync();

        // Simula un dato importado: la base no exige cédula única.
        await using (var scope = api.Db())
        {
            await scope.Context.Patients.Where(patient => patient.Id == second.Id())
                .ExecuteUpdateAsync(setters => setters.SetProperty(patient => patient.DocumentId, first.Str("documentId")));
        }

        var body = TestData.PatientBody(documentId: first.Str("documentId"), firstName: "Corregido");
        await client.PutJson($"/api/patients/{second.Id()}", body, HttpStatusCode.OK);
    }

    [Fact]
    public async Task Buscar_sin_tildes_por_cedula_telefono_y_numero_de_historia()
    {
        var client = await api.As("medico");
        var unique = $"Ñandú{TestData.Next()}";
        var patient = await client.PostJson("/api/patients", TestData.PatientBody(firstName: "José", lastName: unique), HttpStatusCode.Created);
        var plainName = unique.Replace("Ñ", "N").Replace("ú", "u").ToLowerInvariant();

        async Task<int> CountAsync(string search) =>
            (await client.GetJson($"/api/patients?search={Uri.EscapeDataString(search)}"))!["totalItems"]!.GetValue<int>();

        Assert.Equal(1, await CountAsync($"jose {plainName}"));
        Assert.Equal(1, await CountAsync(plainName));
        Assert.Equal(1, await CountAsync(patient.Str("documentId")[2..]));
        Assert.Equal(1, await CountAsync(patient.Str("clinicalRecordNumber")));
        Assert.True(await CountAsync("0991234567") >= 1);
    }

    [Fact]
    public async Task La_lista_va_de_la_mas_reciente_a_la_mas_antigua_y_pagina()
    {
        var client = await api.As("admin");
        await client.CreatePatientAsync();
        var newest = await client.CreatePatientAsync();

        var page = await client.GetJson("/api/patients?page=1&pageSize=2");

        Assert.Equal(newest.Id(), page!["items"]![0].Id());
        Assert.Equal(2, page["items"]!.AsArray().Count);
        Assert.Equal(2, page["pageSize"]!.GetValue<int>());
    }

    [Fact]
    public async Task Baja_logica_oculta_al_paciente_y_admin_lo_reactiva()
    {
        var admin = await api.As("admin");
        var reception = await api.As("recepcion");
        var patient = await admin.CreatePatientAsync();
        var id = patient.Id();

        await reception.Delete($"/api/patients/{id}", HttpStatusCode.NoContent);
        await reception.Delete($"/api/patients/{id}", HttpStatusCode.NoContent); // repetir no falla

        var list = await admin.GetJson($"/api/patients?search={patient.Str("documentId")}");
        Assert.Equal(0, list!["totalItems"]!.GetValue<int>());

        var deleted = await admin.GetJson($"/api/patients/{id}");
        Assert.NotNull(deleted!["deletedAt"]);

        await admin.PutJson($"/api/patients/{id}", TestData.PatientBody(patient.Str("documentId")), HttpStatusCode.Conflict);
        await reception.PostJson($"/api/patients/{id}/restore", null, HttpStatusCode.Forbidden);

        var restored = await admin.PostJson($"/api/patients/{id}/restore", null, HttpStatusCode.OK);
        Assert.Null(restored!["deletedAt"]);
    }

    [Fact]
    public async Task El_medico_no_puede_dar_de_baja()
    {
        var medico = await api.As("medico");
        var patient = await medico.CreatePatientAsync();

        await medico.Delete($"/api/patients/{patient.Id()}", HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Reactivar_con_cedula_ya_usada_responde_409()
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync();
        await admin.Delete($"/api/patients/{patient.Id()}", HttpStatusCode.NoContent);
        await admin.PostJson("/api/patients", TestData.PatientBody(patient.Str("documentId")), HttpStatusCode.Created);

        await admin.PostJson($"/api/patients/{patient.Id()}/restore", null, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Paciente_inexistente_responde_404()
    {
        var admin = await api.As("admin");

        var error = await admin.GetJson($"/api/patients/{Guid.NewGuid()}", HttpStatusCode.NotFound);

        Assert.Equal("Paciente no encontrado", error.Str("title"));
    }
}
