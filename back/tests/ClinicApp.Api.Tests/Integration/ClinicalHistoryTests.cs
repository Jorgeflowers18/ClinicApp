using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using ClinicApp.Api.Common;
using ClinicApp.Api.Modules.ClinicalHistory;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class ClinicalHistoryTests(ApiFactory api)
{
    // ───────────── Ayudas ─────────────

    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4, 5];
    private static readonly byte[] Jpg = [0xFF, 0xD8, 0xFF, 0xE0, 9, 9, 9];
    private static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.7 contenido de prueba");
    private static readonly byte[] Webp = Encoding.ASCII.GetBytes("RIFF\0\0\0\0WEBPVP8 datos");

    private async Task<(HttpClient Medico, Guid PatientId, Guid ProfessionalId)> NewPatientAsync()
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync();
        return (await api.As("medico"), patient.Id(), await admin.ProfessionalIdAsync());
    }

    /// <summary>La historia (vacía o guardada) tal como la devuelve el GET: es la base de cada PUT.</summary>
    private static async Task<JsonObject> RecordAsync(HttpClient client, Guid patientId) =>
        (await client.GetJson($"/api/clinical-history/patients/{patientId}"))!["record"]!.AsObject();

    private static Task<JsonNode?> SaveAsync(HttpClient client, Guid patientId, JsonObject record, HttpStatusCode expected = HttpStatusCode.OK) =>
        client.PutJson($"/api/clinical-history/patients/{patientId}", record, expected);

    private static Dictionary<string, object?> EncounterBody(Guid professionalId, Guid? id = null, string? date = null) => new()
    {
        ["id"] = id ?? Guid.NewGuid(),
        ["date"] = date ?? TestData.TodayInClinic().Iso(),
        ["professionalId"] = professionalId,
        ["appointmentId"] = null,
        ["reason"] = "Dolor en molar superior",
        ["presentIllness"] = "Desde hace 3 días",
        ["vitals"] = new { bloodPressure = "120/80", heartRate = 72, respiratoryRate = (int?)null, spo2 = 98, temperature = 36.5, weight = (decimal?)null, height = (decimal?)null },
        ["asa"] = "I",
        ["riskAssessment"] = new[] { "ambulatorio" },
        ["extraoralExam"] = new Dictionary<string, object> { ["atm"] = new { status = "normal", finding = "" } },
        ["intraoralExam"] = new Dictionary<string, object>(),
        ["pain"] = new { scale = 6, location = "16", character = "Pulsátil" },
        ["cariesRisk"] = new { level = "alto", factors = "" },
        ["periodontalRisk"] = new { level = "", factors = "" },
        ["diagnoses"] = new[] { new { id = Guid.NewGuid().ToString(), description = "Caries profunda", tooth = "16", priority = "alta" } },
        ["prognosis"] = new { level = "favorable", notes = "" },
        ["periodontalDiagnosis"] = new
        {
            gingival = "", stage = "", extent = "", grade = "", stability = "", periImplant = "", smoking = "", diabetes = "", otherFactors = "", teethLostToPerio = (int?)null,
        },
        ["maintenanceInterval"] = new { option = "6", other = "" },
        ["procedures"] = "Apertura cameral",
        ["materials"] = "Lidocaína 2 %, lote 123",
        ["requestedExams"] = new[] { new { id = Guid.NewGuid().ToString(), kind = "panoramica", detail = "" } },
        ["examFindings"] = "",
        ["evolution"] = "Favorable",
        ["notes"] = "",
        ["nextVisit"] = "",
        ["performedTreatments"] = Array.Empty<object>(),
        ["chartSnapshot"] = null,
        ["clinicalSnapshot"] = new { alerts = new[] { "latex" }, allergies = Array.Empty<object>(), medications = Array.Empty<object>() },
    };

    private static Task<JsonNode?> CreateEncounterAsync(HttpClient client, Guid patientId, object body, HttpStatusCode expected = HttpStatusCode.Created) =>
        client.PostJson($"/api/clinical-history/patients/{patientId}/encounters", body, expected);

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, Guid patientId, byte[] content, string fileName, string kind = "radiografia_periapical")
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", fileName);
        form.Add(new StringContent(kind), "kind");
        form.Add(new StringContent(patientId.ToString()), "patientId");
        return await client.PostAsync("/api/clinical-history/attachments", form);
    }

    private static async Task<JsonNode> UploadOkAsync(HttpClient client, Guid patientId, byte[] content, string fileName)
    {
        var response = await UploadAsync(client, patientId, content, fileName);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.JsonAsync();
    }

    // ───────────── Roles ─────────────

    [Fact]
    public async Task Recepcion_recibe_403_y_sin_sesion_401()
    {
        var (_, patientId, professionalId) = await NewPatientAsync();
        var reception = await api.As("recepcion");

        await reception.GetJson($"/api/clinical-history/patients/{patientId}", HttpStatusCode.Forbidden);
        await reception.GetJson("/api/clinical-history/encounters", HttpStatusCode.Forbidden);
        await CreateEncounterAsync(reception, patientId, EncounterBody(professionalId), HttpStatusCode.Forbidden);
        Assert.Equal(HttpStatusCode.Forbidden, (await UploadAsync(reception, patientId, Png, "rx.png")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.Anonymous().GetAsync($"/api/clinical-history/patients/{patientId}")).StatusCode);
    }

    // ───────────── Historia ─────────────

    [Fact]
    public async Task Historia_vacia_primer_guardado_revision_vieja_y_versiones()
    {
        var (medico, patientId, _) = await NewPatientAsync();

        var empty = await RecordAsync(medico, patientId);
        Assert.Equal(0, empty["revision"]!.GetValue<int>());
        Assert.Equal("pendiente", empty["dataConsent"]!["status"]!.GetValue<string>());
        Assert.Equal(19, empty["medicalBackground"]!["conditions"]!.AsObject().Count);

        empty["allergiesAndMedication"]!["allergies"] = new JsonArray(new JsonObject
        {
            ["id"] = "a1", ["reaction"] = "Penicilina", ["substance"] = "Penicilina", ["manifestation"] = "Urticaria",
        });
        var first = await SaveAsync(medico, patientId, empty);
        Assert.Equal(1, first!["revision"]!.GetValue<int>());

        // Guardar con la revisión vieja (0) falla.
        var stale = await SaveAsync(medico, patientId, empty, HttpStatusCode.Conflict);
        Assert.Equal(ClinicalRecordsController.ConcurrencyMessage, stale.Str("title"));

        var current = await RecordAsync(medico, patientId);
        current["allergiesAndMedication"]!["allergies"]![0]!["reaction"] = "Amoxicilina";
        await SaveAsync(medico, patientId, current);
        current = await RecordAsync(medico, patientId);
        await SaveAsync(medico, patientId, current);

        await using var scope = api.Db();
        var versions = await scope.Context.ClinicalRecordVersions.AsNoTracking()
            .Where(version => version.PatientId == patientId).OrderBy(version => version.Revision).ToListAsync();
        Assert.Equal([1, 2], versions.Select(version => version.Revision));
        Assert.Contains("Penicilina", versions[0].Data!.Value.GetRawText());
        Assert.Contains("Amoxicilina", versions[1].Data!.Value.GetRawText());
    }

    [Fact]
    public async Task Dos_guardados_simultaneos_con_la_misma_revision_uno_gana()
    {
        var (medico, patientId, _) = await NewPatientAsync();
        var record = await RecordAsync(medico, patientId);

        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ =>
            medico.PutAsync($"/api/clinical-history/patients/{patientId}", JsonContent.Create(record))));

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData("niega", "medicalBackground.denies")]
    [InlineData("otro", "medicalBackground.conditions.otro.detail")]
    [InlineData("consentimiento", "dataConsent.signerName")]
    [InlineData("consentimientoFuturo", "dataConsent.date")]
    [InlineData("declaracion", "truthDeclaration.signerDocumentId")]
    [InlineData("alergia", "allergiesAndMedication.allergies[0].reaction")]
    [InlineData("alerta", "allergiesAndMedication.alerts")]
    [InlineData("habito", "habits.tobacco.answer")]
    [InlineData("fase", "plan[0].phase")]
    public async Task Validacion_de_la_historia_por_campo(string scenario, string field)
    {
        var (medico, patientId, _) = await NewPatientAsync();
        var record = await RecordAsync(medico, patientId);
        var tomorrow = TestData.TodayInClinic().AddDays(1).Iso();

        switch (scenario)
        {
            case "niega":
                record["medicalBackground"]!["denies"] = true;
                record["medicalBackground"]!["conditions"]!["diabetes"]!["personal"] = true;
                break;
            case "otro":
                record["medicalBackground"]!["conditions"]!["otro"]!["family"] = true;
                break;
            case "consentimiento":
                record["dataConsent"] = new JsonObject { ["status"] = "aceptado", ["signer"] = "paciente", ["signerName"] = "", ["signerDocumentId"] = "1712345678", ["date"] = "2026-01-01", ["attachmentId"] = null };
                break;
            case "consentimientoFuturo":
                record["dataConsent"] = new JsonObject { ["status"] = "rechazado", ["signer"] = "paciente", ["signerName"] = "Ana Ruiz", ["signerDocumentId"] = "1712345678", ["date"] = tomorrow, ["attachmentId"] = null };
                break;
            case "declaracion":
                record["truthDeclaration"] = new JsonObject { ["accepted"] = true, ["signer"] = "paciente", ["signerName"] = "Ana Ruiz", ["signerDocumentId"] = "12", ["date"] = "2026-01-01", ["professionalId"] = "" };
                break;
            case "alergia":
                record["allergiesAndMedication"]!["allergies"] = new JsonArray(new JsonObject { ["id"] = "a1", ["reaction"] = "", ["substance"] = "", ["manifestation"] = "" });
                break;
            case "alerta":
                record["allergiesAndMedication"]!["alerts"] = new JsonArray("inventada");
                break;
            case "habito":
                record["habits"]!["tobacco"]!["answer"] = "quizas";
                break;
            case "fase":
                record["plan"] = new JsonArray(new JsonObject { ["id"] = "p1", ["treatmentId"] = null, ["description"] = "Limpieza", ["tooth"] = "", ["phase"] = "inventada", ["plannedDate"] = "" });
                break;
        }

        var error = await SaveAsync(medico, patientId, record, HttpStatusCode.BadRequest);

        Assert.True(error.HasError(field), $"Se esperaba un error en {field}: {error}");
    }

    [Fact]
    public async Task Referencias_invalidas_dan_400()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var (_, otherPatient, _) = await NewPatientAsync();
        var otherEncounter = await CreateEncounterAsync(medico, otherPatient, EncounterBody(professionalId));
        var record = await RecordAsync(medico, patientId);

        record["plan"] = new JsonArray(new JsonObject { ["id"] = "p1", ["treatmentId"] = Guid.NewGuid().ToString(), ["description"] = "", ["tooth"] = "", ["phase"] = "", ["plannedDate"] = "" });
        record["examRequests"] = new JsonArray(new JsonObject
        {
            ["id"] = "e1", ["kind"] = "panoramica", ["detail"] = "", ["status"] = "pendiente", ["encounterId"] = otherEncounter.Str("id"),
            ["requestedAt"] = "2026-11-01", ["attachmentId"] = null, ["receivedAt"] = null,
        });
        record["dataConsent"] = new JsonObject
        {
            ["status"] = "aceptado", ["signer"] = "paciente", ["signerName"] = "Ana Ruiz", ["signerDocumentId"] = "1712345678", ["date"] = "2026-01-01", ["attachmentId"] = Guid.NewGuid().ToString(),
        };
        record["truthDeclaration"]!["professionalId"] = Guid.NewGuid().ToString();

        var error = await SaveAsync(medico, patientId, record, HttpStatusCode.BadRequest);

        Assert.True(error.HasError("plan[0].treatmentId"));
        Assert.True(error.HasError("examRequests[0].encounterId"));
        Assert.True(error.HasError("dataConsent.attachmentId"));
        Assert.True(error.HasError("truthDeclaration.professionalId"));
    }

    [Fact]
    public async Task Plan_guarda_solo_la_referencia_y_references_trae_el_nombre_aunque_este_inactivo()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var admin = await api.As("admin");
        var treatment = await admin.PostJson("/api/treatments", new
        {
            name = $"Corona {TestData.Next()}", category = "Prótesis", durationMinutes = 60, price = 300, active = false, consumption = Array.Empty<object>(),
        }, HttpStatusCode.Created);
        var record = await RecordAsync(medico, patientId);
        record["plan"] = new JsonArray(
            new JsonObject { ["id"] = "p1", ["treatmentId"] = treatment.Str("id"), ["description"] = "copia del nombre", ["tooth"] = "11", ["phase"] = "protesica", ["plannedDate"] = "" },
            new JsonObject { ["id"] = "p2", ["treatmentId"] = null, ["description"] = "Texto libre antiguo", ["tooth"] = "", ["phase"] = "", ["plannedDate"] = "" });
        record["truthDeclaration"]!["professionalId"] = professionalId.ToString();

        var saved = await SaveAsync(medico, patientId, record);
        Assert.Equal("", saved!["plan"]![0]!["description"]!.GetValue<string>());
        Assert.Equal("Texto libre antiguo", saved["plan"]![1]!["description"]!.GetValue<string>());

        var history = await medico.GetJson($"/api/clinical-history/patients/{patientId}");
        var reference = history!["references"]!["treatments"]![treatment.Str("id")]!;
        Assert.Equal(treatment.Str("name"), reference.Str("name"));
        Assert.False(reference["active"]!.GetValue<bool>());
        Assert.NotNull(history["references"]!["professionals"]![professionalId.ToString()]);

        // Un tratamiento que está en un plan no se puede borrar del catálogo.
        await admin.Delete($"/api/treatments/{treatment.Id()}", HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Paciente_inexistente_404_y_dado_de_baja_no_se_edita()
    {
        var (medico, patientId, _) = await NewPatientAsync();
        await medico.GetJson($"/api/clinical-history/patients/{Guid.NewGuid()}", HttpStatusCode.NotFound);

        var record = await RecordAsync(medico, patientId);
        await (await api.As("admin")).Delete($"/api/patients/{patientId}", HttpStatusCode.NoContent);

        await SaveAsync(medico, patientId, record, HttpStatusCode.Conflict);
    }

    // ───────────── Atenciones ─────────────

    [Fact]
    public async Task Crear_atencion_reintento_idempotente_y_otro_paciente_409()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var (_, otherPatient, _) = await NewPatientAsync();
        var body = EncounterBody(professionalId);

        var created = await CreateEncounterAsync(medico, patientId, body);
        Assert.Equal(6, created!["extraoralExam"]!.AsObject().Count); // las que faltaban: no_evaluado
        Assert.Equal("no_evaluado", created["intraoralExam"]!["mucosa"]!["status"]!.GetValue<string>());

        var retry = await CreateEncounterAsync(medico, patientId, body, HttpStatusCode.OK);
        Assert.Equal(created.Str("id"), retry.Str("id"));

        await CreateEncounterAsync(medico, otherPatient, body, HttpStatusCode.Conflict);

        await using var scope = api.Db();
        Assert.Equal(1, await scope.Context.ClinicalEncounters.CountAsync(encounter => encounter.PatientId == patientId));
        var summary = await scope.Context.ClinicalEncounters.Where(encounter => encounter.Id == created.Id()).Select(encounter => encounter.DiagnosisSummary).SingleAsync();
        Assert.Equal("Caries profunda", summary);
    }

    [Fact]
    public async Task Una_cita_tiene_como_maximo_una_atencion()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var admin = await api.As("admin");
        var appointment = await admin.PostJson("/api/appointments", new
        {
            patientId = patientId.ToString(), professionalId = professionalId.ToString(), treatmentId = "", roomId = "",
            date = TestData.TodayInClinic().Iso(), startTime = "07:00", endTime = "07:30", notes = "",
        }, HttpStatusCode.Created);

        var first = EncounterBody(professionalId);
        first["appointmentId"] = appointment.Id();
        await CreateEncounterAsync(medico, patientId, first);

        var second = EncounterBody(professionalId);
        second["appointmentId"] = appointment.Id();
        var conflict = await CreateEncounterAsync(medico, patientId, second, HttpStatusCode.Conflict);
        Assert.True(conflict.HasError("appointmentId"));
    }

    [Theory]
    [InlineData("futura", "date")]
    [InlineData("sinDiagnostico", "diagnoses")]
    [InlineData("motivo", "reason")]
    [InlineData("frecuencia", "vitals.heartRate")]
    [InlineData("presion", "vitals.bloodPressure")]
    [InlineData("hallazgo", "extraoralExam.atm.finding")]
    [InlineData("interconsulta", "requestedExams[0].detail")]
    [InlineData("intervalo", "maintenanceInterval.other")]
    [InlineData("control", "nextVisit")]
    [InlineData("profesional", "professionalId")]
    public async Task Validacion_de_la_atencion(string scenario, string field)
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var body = EncounterBody(professionalId);
        var today = TestData.TodayInClinic();

        switch (scenario)
        {
            case "futura": body["date"] = today.AddDays(1).Iso(); break;
            case "sinDiagnostico": body["diagnoses"] = Array.Empty<object>(); break;
            case "motivo": body["reason"] = "ab"; break;
            case "frecuencia": body["vitals"] = new { bloodPressure = "", heartRate = 300 }; break;
            case "presion": body["vitals"] = new { bloodPressure = "120-80" }; break;
            case "hallazgo": body["extraoralExam"] = new Dictionary<string, object> { ["atm"] = new { status = "alterado", finding = "" } }; break;
            case "interconsulta": body["requestedExams"] = new[] { new { id = "x1", kind = "interconsulta", detail = "" } }; break;
            case "intervalo": body["maintenanceInterval"] = new { option = "otro", other = "" }; break;
            case "control": body["nextVisit"] = today.AddDays(-1).Iso(); break;
            case "profesional": body["professionalId"] = Guid.NewGuid(); break;
        }

        var error = await CreateEncounterAsync(medico, patientId, body, HttpStatusCode.BadRequest);

        Assert.True(error.HasError(field), $"Se esperaba un error en {field}: {error}");
    }

    [Fact]
    public async Task Historia_con_atenciones_en_orden_y_notas_con_autor_de_la_sesion()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var today = TestData.TodayInClinic();
        var older = await CreateEncounterAsync(medico, patientId, EncounterBody(professionalId, date: today.AddDays(-5).Iso()));
        var newer = await CreateEncounterAsync(medico, patientId, EncounterBody(professionalId, date: today.Iso()));

        var note = await medico.PostJson($"/api/clinical-history/encounters/{older.Id()}/notes", new { text = "  Corrección: la pieza era la 17.  " }, HttpStatusCode.Created);
        Assert.Equal("Corrección: la pieza era la 17.", note.Str("text"));
        Assert.Equal("Dra. Carla Ríos", note.Str("authorName"));

        await medico.PostJson($"/api/clinical-history/encounters/{older.Id()}/notes", new { text = "corta" }, HttpStatusCode.BadRequest);
        await medico.PostJson($"/api/clinical-history/encounters/{Guid.NewGuid()}/notes", new { text = "Una nota suficientemente larga" }, HttpStatusCode.NotFound);

        var history = await medico.GetJson($"/api/clinical-history/patients/{patientId}");
        var encounters = history!["encounters"]!.AsArray();
        Assert.Equal([older.Id(), newer.Id()], encounters.Select(item => item.Id()));
        Assert.Single(encounters[0]!["addenda"]!.AsArray());
    }

    [Fact]
    public async Task Lista_de_atenciones_filtra_busca_y_ordena()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var admin = await api.As("admin");
        var lastName = $"Zúñiga{TestData.Next()}";
        var patient = await admin.PostJson("/api/patients", TestData.PatientBody(firstName: "Lucía", lastName: lastName), HttpStatusCode.Created);
        var today = TestData.TodayInClinic();
        var body = EncounterBody(professionalId, date: today.AddDays(-2).Iso());
        body["reason"] = $"Sensibilidad {lastName}";
        var first = await CreateEncounterAsync(medico, patient.Id(), body);
        var second = await CreateEncounterAsync(medico, patient.Id(), EncounterBody(professionalId, date: today.Iso()));
        await CreateEncounterAsync(medico, patientId, EncounterBody(professionalId));

        var byPatient = await medico.GetJson($"/api/clinical-history/encounters?patientId={patient.Id()}");
        Assert.Equal([second.Id(), first.Id()], byPatient!["items"]!.AsArray().Select(item => item.Id()));

        async Task<int> Count(string search) =>
            (await medico.GetJson($"/api/clinical-history/encounters?search={Uri.EscapeDataString(search)}"))!["totalItems"]!.GetValue<int>();

        Assert.Equal(2, await Count(lastName.Replace("ú", "u").ToLowerInvariant()));  // nombre del paciente, sin tilde
        Assert.Equal(2, await Count(patient.Str("documentId")));
        Assert.True(await Count("caries profunda") >= 3);                              // diagnóstico

        var byProfessional = await medico.GetJson($"/api/clinical-history/encounters?professionalId={professionalId}&pageSize=100");
        Assert.Equal(3, byProfessional!["totalItems"]!.GetValue<int>());
    }

    // ───────────── Adjuntos ─────────────

    [Fact]
    public async Task Subir_los_cuatro_formatos_y_descargar_igual()
    {
        var (medico, patientId, _) = await NewPatientAsync();

        foreach (var (content, name, mime) in new[] { (Png, "rx inicial.png", "image/png"), (Jpg, "foto.jpg", "image/jpeg"), (Webp, "foto.webp", "image/webp"), (Pdf, "laboratorio.pdf", "application/pdf") })
        {
            var attachment = await UploadOkAsync(medico, patientId, content, name);
            Assert.Equal(name, attachment.Str("name"));
            Assert.Equal(mime, attachment.Str("mime"));

            var download = await medico.GetAsync($"/api/clinical-history/attachments/{attachment.Id()}/file");
            Assert.Equal(HttpStatusCode.OK, download.StatusCode);
            Assert.Equal(content, await download.Content.ReadAsByteArrayAsync());
            Assert.Equal(mime, download.Content.Headers.ContentType!.MediaType);
            Assert.Contains(name.Split('.')[0], download.Content.Headers.ContentDisposition!.ToString());
        }
    }

    [Fact]
    public async Task Rechazos_de_adjuntos()
    {
        var (medico, patientId, _) = await NewPatientAsync();

        var renamed = await UploadAsync(medico, patientId, Encoding.ASCII.GetBytes("esto es texto"), "falso.png");
        Assert.Equal(HttpStatusCode.BadRequest, renamed.StatusCode);
        var body = await renamed.JsonAsync();
        Assert.True(body.HasError("file"), body.ToJsonString());
        Assert.Equal("falso.png: utiliza JPG, PNG, WebP o PDF de hasta 20 MB", body.Str("title"));

        var big = new byte[AttachmentStorage.MaxSize + 1];
        Png.CopyTo(big, 0);
        Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(medico, patientId, big, "grande.png")).StatusCode);

        var kind = await UploadAsync(medico, patientId, Png, "rx.png", kind: "inventado");
        var kindBody = await kind.JsonAsync();
        Assert.True(kindBody.HasError("kind"), kindBody.ToJsonString());
    }

    [Fact]
    public async Task Guardar_vincula_quitar_marca_y_el_archivo_se_conserva()
    {
        var (medico, patientId, _) = await NewPatientAsync();
        var (_, otherPatient, _) = await NewPatientAsync();
        var attachment = await UploadOkAsync(medico, patientId, Png, "rx.png");
        var foreign = await UploadOkAsync(medico, otherPatient, Png, "otro.png");

        var record = await RecordAsync(medico, patientId);
        record["attachments"] = new JsonArray(new JsonObject { ["id"] = foreign.Str("id") });
        var error = await SaveAsync(medico, patientId, record, HttpStatusCode.BadRequest);
        Assert.True(error.HasError("attachments[0].id"));

        record["attachments"] = new JsonArray(new JsonObject { ["id"] = attachment.Str("id") });
        var saved = await SaveAsync(medico, patientId, record);
        Assert.Equal(attachment.Str("id"), saved!["attachments"]![0].Str("id"));

        var current = await RecordAsync(medico, patientId);
        current["attachments"] = new JsonArray();
        var removed = await SaveAsync(medico, patientId, current);
        Assert.Empty(removed!["attachments"]!.AsArray());

        // Quitado de la historia, pero se sigue descargando (las versiones anteriores lo nombran).
        Assert.Equal(HttpStatusCode.OK, (await medico.GetAsync($"/api/clinical-history/attachments/{attachment.Id()}/file")).StatusCode);

        await using var scope = api.Db();
        var row = await scope.Context.ClinicalAttachments.AsNoTracking().SingleAsync(entry => entry.Id == attachment.Id());
        Assert.NotNull(row.LinkedAt);
        Assert.NotNull(row.RemovedAt);
        Assert.Equal($"{patientId}/{attachment.Str("id")}.png", row.StoragePath);
    }

    [Fact]
    public async Task Limpieza_borra_huerfanos_viejos_y_el_protocolo_respeta_la_simulacion()
    {
        var (medico, patientId, _) = await NewPatientAsync();
        var orphan = await UploadOkAsync(medico, patientId, Png, "huerfano.png");
        var removed = await UploadOkAsync(medico, patientId, Png, "quitado.png");
        var kept = await UploadOkAsync(medico, patientId, Png, "actual.png");

        var record = await RecordAsync(medico, patientId);
        record["attachments"] = new JsonArray(new JsonObject { ["id"] = removed.Str("id") }, new JsonObject { ["id"] = kept.Str("id") });
        await SaveAsync(medico, patientId, record);
        record = await RecordAsync(medico, patientId);
        record["attachments"] = new JsonArray(new JsonObject { ["id"] = kept.Str("id") });
        await SaveAsync(medico, patientId, record);

        // Se envejecen las fechas en la base para no esperar 24 h ni años.
        await using (var scope = api.Db())
        {
            await scope.Context.ClinicalAttachments.Where(entry => entry.Id == orphan.Id())
                .ExecuteUpdateAsync(setters => setters.SetProperty(entry => entry.CreatedAt, DateTime.UtcNow.AddHours(-25)));
            await scope.Context.ClinicalAttachments.Where(entry => entry.Id == removed.Id())
                .ExecuteUpdateAsync(setters => setters.SetProperty(entry => entry.RemovedAt, DateTime.UtcNow.AddDays(-400)));
        }

        // Configuración por defecto: borra el huérfano y no purga nada (protocolo apagado).
        var cleanup = api.Services.GetRequiredService<AttachmentCleanupService>();
        var (orphans, purged) = await cleanup.RunOnceAsync(CancellationToken.None);
        Assert.True(orphans >= 1);
        Assert.Equal(0, purged);
        Assert.Equal(HttpStatusCode.NotFound, (await medico.GetAsync($"/api/clinical-history/attachments/{orphan.Id()}/file")).StatusCode);

        // Protocolo encendido en simulación: no borra.
        Assert.Equal(0, (await CleanupWith(dryRun: true).RunOnceAsync(CancellationToken.None)).Purged);
        Assert.Equal(HttpStatusCode.OK, (await medico.GetAsync($"/api/clinical-history/attachments/{removed.Id()}/file")).StatusCode);

        // Protocolo real: purga solo el quitado hace más de 365 días; la fila queda y la descarga da 410.
        Assert.Equal(1, (await CleanupWith(dryRun: false).RunOnceAsync(CancellationToken.None)).Purged);
        Assert.Equal(HttpStatusCode.Gone, (await medico.GetAsync($"/api/clinical-history/attachments/{removed.Id()}/file")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await medico.GetAsync($"/api/clinical-history/attachments/{kept.Id()}/file")).StatusCode);
    }

    /// <summary>Una tarea de limpieza con el protocolo de conservación encendido (365 días).</summary>
    private AttachmentCleanupService CleanupWith(bool dryRun)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Attachments:OrphanHours"] = "24",
                ["Attachments:Retention:RemovedDays"] = "365",
                ["Attachments:Retention:DryRun"] = dryRun.ToString(),
            })
            .Build();

        return new AttachmentCleanupService(
            api.Services.GetRequiredService<IServiceScopeFactory>(),
            api.Services.GetRequiredService<AttachmentStorage>(),
            configuration,
            api.Services.GetRequiredService<ClinicClock>(),
            NullLogger<AttachmentCleanupService>.Instance);
    }
}
