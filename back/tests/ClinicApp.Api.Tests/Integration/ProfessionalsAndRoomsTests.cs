using System.Net;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class ProfessionalsAndRoomsTests(ApiFactory api)
{
    [Fact]
    public async Task La_semilla_crea_los_del_modo_mock_y_vincula_al_medico()
    {
        var medico = await api.As("medico");

        var professionals = (await medico.GetJson("/api/professionals"))!.AsArray();
        var rooms = (await medico.GetJson("/api/rooms"))!.AsArray();
        var me = await medico.GetJson("/api/auth/me");

        var carla = professionals.Single(item => item.Str("name") == "Dra. Carla Ríos");
        Assert.Equal("MSP-17-04581", carla.Str("registrationNumber"));
        Assert.Contains(rooms, room => room.Str("name") == "Consultorio 1");
        Assert.Equal(carla.Str("id"), me.Str("professionalId"));
        Assert.Equal(me.Str("id"), carla.Str("userId"));
    }

    [Theory]
    [InlineData("recepcion")]
    [InlineData("medico")]
    public async Task Solo_admin_crea_y_edita(string role)
    {
        var client = await api.As(role);

        await client.PostJson("/api/professionals", new { name = "Dr. Nuevo", specialty = "Cirugía" }, HttpStatusCode.Forbidden);
        await client.PostJson("/api/rooms", new { name = "Consultorio X" }, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Crear_editar_y_desactivar_un_profesional()
    {
        var admin = await api.As("admin");
        var id = await admin.ProfessionalIdAsync();

        var updated = await admin.PutJson($"/api/professionals/{id}",
            new { name = "Dra. Editada", specialty = "Periodoncia", registrationNumber = "MSP-99", active = false }, HttpStatusCode.OK);

        Assert.Equal("Dra. Editada", updated.Str("name"));
        Assert.False(updated!["active"]!.GetValue<bool>());
        Assert.Equal(0, updated["futureAppointments"]!.GetValue<int>());

        var list = (await admin.GetJson("/api/professionals"))!.AsArray();
        Assert.Contains(list, item => item.Id() == id && !item!["active"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Validacion_de_profesional()
    {
        var admin = await api.As("admin");

        var error = await admin.PostJson("/api/professionals", new { name = "Dr", specialty = "" }, HttpStatusCode.BadRequest);

        Assert.True(error.HasError("name"));
        Assert.True(error.HasError("specialty"));
    }

    [Fact]
    public async Task Vincular_usuario_y_no_repetirlo_en_otro_profesional()
    {
        var admin = await api.As("admin");
        var reception = await api.As("recepcion");
        var receptionId = (await reception.GetJson("/api/auth/me")).Id();
        var first = await admin.ProfessionalIdAsync();
        var second = await admin.ProfessionalIdAsync();

        await admin.PutJson($"/api/professionals/{first}", new { name = "Dr. Uno", specialty = "General", userId = receptionId }, HttpStatusCode.OK);
        var me = await reception.GetJson("/api/auth/me");
        Assert.Equal(first.ToString(), me.Str("professionalId"));

        var conflict = await admin.PutJson($"/api/professionals/{second}", new { name = "Dr. Dos", specialty = "General", userId = receptionId }, HttpStatusCode.Conflict);
        Assert.True(conflict.HasError("userId"));

        var missing = await admin.PutJson($"/api/professionals/{second}", new { name = "Dr. Dos", specialty = "General", userId = Guid.NewGuid() }, HttpStatusCode.BadRequest);
        Assert.True(missing.HasError("userId"));

        // Desvincular deja al usuario sin profesional.
        await admin.PutJson($"/api/professionals/{first}", new { name = "Dr. Uno", specialty = "General", userId = (Guid?)null }, HttpStatusCode.OK);
        Assert.Null((await reception.GetJson("/api/auth/me"))!["professionalId"]);
    }

    [Fact]
    public async Task Consultorios_con_nombre_unico_entre_activos()
    {
        var admin = await api.As("admin");
        var name = $"Sala {TestData.Next()}";
        var room = await admin.PostJson("/api/rooms", new { name }, HttpStatusCode.Created);

        var conflict = await admin.PostJson("/api/rooms", new { name = name.ToUpperInvariant() }, HttpStatusCode.Conflict);
        Assert.True(conflict.HasError("name"));

        // Desactivado, el nombre queda libre.
        await admin.PutJson($"/api/rooms/{room.Id()}", new { name, active = false }, HttpStatusCode.OK);
        await admin.PostJson("/api/rooms", new { name }, HttpStatusCode.Created);
    }

    [Fact]
    public async Task Esterilizacion_exige_un_responsable_existente_y_activo()
    {
        var admin = await api.As("admin");
        var item = await admin.PostJson("/api/inventory/items", new
        {
            name = $"Espejo {TestData.Next()}", category = "Instrumental", unit = "unidad", kind = "instrumental", minStock = 0, unitCost = 5,
        }, HttpStatusCode.Created);
        var inactive = await admin.ProfessionalIdAsync();
        await admin.PutJson($"/api/professionals/{inactive}", new { name = "Dr. Inactivo", specialty = "General", active = false }, HttpStatusCode.OK);

        object Body(Guid professionalId) => new
        {
            itemIds = new[] { item.Id() },
            performedAt = TestData.TodayInClinic().Iso(),
            result = "aprobado",
            responsibleProfessionalId = professionalId,
        };

        var missing = await admin.PostJson("/api/inventory/sterilization-cycles", Body(Guid.NewGuid()), HttpStatusCode.BadRequest);
        Assert.True(missing.HasError("responsibleProfessionalId"));

        var notActive = await admin.PostJson("/api/inventory/sterilization-cycles", Body(inactive), HttpStatusCode.BadRequest);
        Assert.True(notActive.HasError("responsibleProfessionalId"));
    }

    [Fact]
    public async Task La_base_impide_borrar_un_profesional_con_ciclos()
    {
        var admin = await api.As("admin");
        var professional = await admin.ProfessionalIdAsync();
        var item = await admin.PostJson("/api/inventory/items", new
        {
            name = $"Fórceps {TestData.Next()}", category = "Instrumental", unit = "unidad", kind = "instrumental", minStock = 0, unitCost = 5,
        }, HttpStatusCode.Created);
        await admin.PostJson("/api/inventory/sterilization-cycles", new
        {
            itemIds = new[] { item.Id() },
            performedAt = TestData.TodayInClinic().Iso(),
            result = "aprobado",
            responsibleProfessionalId = professional,
        }, HttpStatusCode.Created);

        await using var scope = api.Db();
        await Assert.ThrowsAnyAsync<Exception>(() =>
            scope.Context.Professionals.Where(entry => entry.Id == professional).ExecuteDeleteAsync());
    }
}
