using System.Net;
using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>Archivo clínico digital: catálogo, adjuntar con metadatos, duplicados, edición, archivado y auditoría.</summary>
[Collection(ApiCollection.Name)]
public class ClinicalArchiveTests(ApiFactory api)
{
    private static byte[] Png(byte seed) => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, seed, 2, 3, 4, 5];

    private async Task<(HttpClient Medico, Guid PatientId, Guid ProfessionalId)> NewPatientAsync()
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync();
        return (await api.As("medico"), patient.Id(), await admin.ProfessionalIdAsync());
    }

    private static Dictionary<string, string?> Draft(string name = "Panorámica inicial", string type = "panoramica") => new()
    {
        ["displayName"] = name, ["clinicalType"] = type, ["studyDate"] = "2026-11-10", ["categoryId"] = null, ["professionalId"] = null,
        ["encounterId"] = null, ["treatmentId"] = null, ["examRequestId"] = null, ["zone"] = "Arcada superior", ["notes"] = "Control",
    };

    private static async Task<HttpResponseMessage> AttachAsync(HttpClient client, Guid patientId, byte[] content, Dictionary<string, string?> draft, params Guid[] tagIds)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", "pano.png");
        foreach (var (key, value) in draft.Where(entry => entry.Value is not null)) form.Add(new StringContent(value!), key);
        foreach (var tag in tagIds) form.Add(new StringContent(tag.ToString()), "tagIds");
        return await client.PostAsync($"/api/clinical-history/patients/{patientId}/archive/files", form);
    }

    private static async Task<JsonNode> AttachOkAsync(HttpClient client, Guid patientId, byte[] content, Dictionary<string, string?> draft, params Guid[] tagIds)
    {
        var response = await AttachAsync(client, patientId, content, draft, tagIds);
        var body = await response.JsonAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, body.ToJsonString());
        return body;
    }

    private static JsonNode File(JsonNode history, string id) =>
        history["record"]!["attachments"]!.AsArray().Single(item => item.Str("id") == id)!;

    /// <summary>Una atención con un examen solicitado, ya guardado como pendiente en la historia. Devuelve el id del examen.</summary>
    private static async Task<(Guid EncounterId, string ExamId)> PendingExamAsync(HttpClient medico, Guid patientId, Guid professionalId)
    {
        var encounterId = Guid.NewGuid();
        var examId = Guid.NewGuid().ToString();
        await medico.PostJson($"/api/clinical-history/patients/{patientId}/encounters", new
        {
            id = encounterId, date = TestData.TodayInClinic().Iso(), professionalId, reason = "Control",
            diagnoses = new[] { new { id = Guid.NewGuid().ToString(), description = "Gingivitis", tooth = "", priority = "" } },
            requestedExams = new[] { new { id = examId, kind = "panoramica", detail = "" } },
        }, HttpStatusCode.Created);

        var record = (await medico.GetJson($"/api/clinical-history/patients/{patientId}"))!["record"]!.AsObject();
        record["examRequests"] = new JsonArray(new JsonObject
        {
            ["id"] = examId, ["kind"] = "panoramica", ["detail"] = "", ["status"] = "pendiente", ["encounterId"] = encounterId.ToString(),
            ["requestedAt"] = TestData.TodayInClinic().Iso(), ["attachmentId"] = null, ["receivedAt"] = null,
        });
        await medico.PutJson($"/api/clinical-history/patients/{patientId}", record, HttpStatusCode.OK);
        return (encounterId, examId);
    }

    [Fact]
    public async Task Catalogo_categorias_y_etiquetas_con_nombres_unicos_y_version()
    {
        var medico = await api.As("medico");
        var suffix = TestData.Next();

        var catalog = await medico.PostJson("/api/clinical-history/archive/categories",
            new { name = $"  Radiografías   {suffix}", description = "Estudios de imagen", color = "cyan" }, HttpStatusCode.OK);
        var category = catalog!["categories"]!.AsArray().Single(item => item.Str("name") == $"Radiografías {suffix}")!;
        Assert.Equal(1, category["version"]!.GetValue<int>());
        var revision = catalog["revision"]!.GetValue<int>();

        // El mismo nombre sin tildes ni mayúsculas choca.
        var duplicate = await medico.PostJson("/api/clinical-history/archive/categories",
            new { name = $"radiografias {suffix}", description = "", color = "neutral" }, HttpStatusCode.Conflict);
        Assert.True(duplicate.HasError("name"));
        await medico.PostJson("/api/clinical-history/archive/categories", new { name = $"Otra {suffix}", description = "", color = "rojo" }, HttpStatusCode.BadRequest);

        // Archivar con la versión leída; con una versión vieja, 409.
        var archived = await medico.PutJson($"/api/clinical-history/archive/categories/{category.Str("id")}",
            new { name = $"Radiografías {suffix}", description = "Estudios", color = "cyan", archivedAt = DateTime.UtcNow, version = 1 }, HttpStatusCode.OK);
        var updated = archived!["categories"]!.AsArray().Single(item => item.Str("id") == category.Str("id"))!;
        Assert.NotNull(updated["archivedAt"]);
        Assert.Equal(2, updated["version"]!.GetValue<int>());
        Assert.True(archived["revision"]!.GetValue<int>() > revision);
        await medico.PutJson($"/api/clinical-history/archive/categories/{category.Str("id")}",
            new { name = "X", description = "", color = "cyan", version = 1 }, HttpStatusCode.Conflict);

        // Etiquetas: crear la misma otra vez no duplica; renombrar a una existente, 409.
        var withTag = await medico.PostJson("/api/clinical-history/archive/tags", new { name = $"Control {suffix}" }, HttpStatusCode.OK);
        var again = await medico.PostJson("/api/clinical-history/archive/tags", new { name = $"CONTROL {suffix}" }, HttpStatusCode.OK);
        Assert.Equal(withTag!["tags"]!.AsArray().Count, again!["tags"]!.AsArray().Count);
        var other = await medico.PostJson("/api/clinical-history/archive/tags", new { name = $"Ortodoncia {suffix}" }, HttpStatusCode.OK);
        var otherTag = other!["tags"]!.AsArray().Single(item => item.Str("name") == $"Ortodoncia {suffix}")!;
        var renamed = await medico.PutJson($"/api/clinical-history/archive/tags/{otherTag.Str("id")}", new { name = $"control {suffix}", version = 1 }, HttpStatusCode.Conflict);
        Assert.True(renamed.HasError("name"));

        await (await api.As("recepcion")).GetJson("/api/clinical-history/archive/catalog", HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Adjuntar_con_metadatos_vincula_el_examen_y_audita()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var (encounterId, examId) = await PendingExamAsync(medico, patientId, professionalId);
        var catalog = await medico.PostJson("/api/clinical-history/archive/categories", new { name = $"Imagen {TestData.Next()}", description = "", color = "violet" }, HttpStatusCode.OK);
        var categoryId = catalog!["categories"]!.AsArray().Last()!.Str("id");
        var tags = await medico.PostJson("/api/clinical-history/archive/tags", new { name = $"Inicial {TestData.Next()}" }, HttpStatusCode.OK);
        var tagId = Guid.Parse(tags!["tags"]!.AsArray().Last()!.Str("id"));
        var revisionBefore = (await medico.GetJson($"/api/clinical-history/patients/{patientId}"))!["record"]!["revision"]!.GetValue<int>();

        var draft = Draft();
        draft["categoryId"] = categoryId;
        draft["professionalId"] = professionalId.ToString();
        draft["encounterId"] = encounterId.ToString();
        draft["examRequestId"] = examId;
        var history = await AttachOkAsync(medico, patientId, Png(1), draft, tagId);

        var record = history["record"]!;
        Assert.Equal(revisionBefore + 1, record["revision"]!.GetValue<int>());
        var file = record["attachments"]!.AsArray().Single()!;
        Assert.Equal("pano.png", file.Str("name"));
        Assert.Equal("panoramica", file.Str("kind"));
        var archive = file["archive"]!;
        Assert.Equal(1, archive["version"]!.GetValue<int>());
        Assert.Equal("Panorámica inicial", archive.Str("displayName"));
        Assert.Equal("2026-11-10", archive.Str("studyDate"));
        Assert.Equal(categoryId, archive.Str("categoryId"));
        Assert.Equal(tagId.ToString(), archive["tagIds"]![0]!.GetValue<string>());
        Assert.Equal(64, archive.Str("digest").Length);
        Assert.Equal("adjuntar", archive["audit"]![0].Str("action"));
        Assert.False(string.IsNullOrEmpty(archive["uploadedBy"].Str("name")));

        var exam = record["examRequests"]!.AsArray().Single()!;
        Assert.Equal("recibido", exam.Str("status"));
        Assert.Equal(file.Str("id"), exam.Str("attachmentId"));
        Assert.Equal(TestData.TodayInClinic().Iso(), exam.Str("receivedAt"));

        // El mismo original, aunque con otro nombre, es un duplicado. Y el examen ya tiene resultado.
        var duplicate = await AttachAsync(medico, patientId, Png(1), Draft("Copia"));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.True((await duplicate.JsonAsync()).HasError("file"));
        draft["displayName"] = "Otro resultado";
        var taken = await AttachAsync(medico, patientId, Png(2), draft, tagId);
        Assert.Equal(HttpStatusCode.Conflict, taken.StatusCode);

        // Los rechazados no dejan archivos en la historia.
        var current = await medico.GetJson($"/api/clinical-history/patients/{patientId}");
        Assert.Single(current!["record"]!["attachments"]!.AsArray());
    }

    [Fact]
    public async Task Duplicado_de_un_adjunto_anterior_sin_huella()
    {
        var (medico, patientId, _) = await NewPatientAsync();
        var first = await AttachOkAsync(medico, patientId, Png(7), Draft());
        var id = first["record"]!["attachments"]![0].Id();

        // Simula un adjunto anterior a la huella SHA-256: se calcula al comparar.
        await using (var scope = api.Db())
        {
            await scope.Context.ClinicalAttachments.Where(entry => entry.Id == id)
                .ExecuteUpdateAsync(update => update.SetProperty(entry => entry.Digest, (string?)null));
        }

        var duplicate = await AttachAsync(medico, patientId, Png(7), Draft("De nuevo"));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        // Otro paciente sí puede tener el mismo archivo.
        var (_, otherPatient, _) = await NewPatientAsync();
        await AttachOkAsync(medico, otherPatient, Png(7), Draft());
    }

    [Theory]
    [InlineData("clinicalType", "inventado")]
    [InlineData("displayName", "")]
    [InlineData("studyDate", "10/11/2026")]
    [InlineData("encounterId", "otro-paciente")]
    [InlineData("examRequestId", "no-existe")]
    [InlineData("categoryId", "no-existe")]
    [InlineData("treatmentId", "no-existe")]
    public async Task Validacion_de_los_metadatos(string field, string value)
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var draft = Draft();
        draft[field] = value switch
        {
            "otro-paciente" => (await PendingExamAsync(medico, (await NewPatientAsync()).PatientId, professionalId)).EncounterId.ToString(),
            "no-existe" when field != "examRequestId" => Guid.NewGuid().ToString(),
            _ => value,
        };

        var response = await AttachAsync(medico, patientId, Png(3), draft);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.JsonAsync();
        Assert.True(body.HasError(field), body.ToJsonString());
    }

    [Fact]
    public async Task Editar_un_adjunto_anterior_con_version_0_y_concurrencia()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        // Adjunto anterior: subido desde la historia y guardado con el PUT, sin metadatos.
        using var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(Png(4));
        content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(content, "file", "rx antigua.png");
        form.Add(new StringContent("radiografia_periapical"), "kind");
        form.Add(new StringContent(patientId.ToString()), "patientId");
        var uploaded = await (await medico.PostAsync("/api/clinical-history/attachments", form)).JsonAsync();
        Assert.Null(uploaded["archive"]);
        var record = (await medico.GetJson($"/api/clinical-history/patients/{patientId}"))!["record"]!.AsObject();
        record["attachments"] = new JsonArray(new JsonObject { ["id"] = uploaded.Str("id") });
        await medico.PutJson($"/api/clinical-history/patients/{patientId}", record, HttpStatusCode.OK);

        var edited = await medico.PatchJson($"/api/clinical-history/attachments/{uploaded.Str("id")}", new
        {
            version = 0, displayName = "Periapical 16", clinicalType = "radiografia_periapical", studyDate = "", categoryId = (Guid?)null,
            tagIds = Array.Empty<Guid>(), professionalId, encounterId = (Guid?)null, treatmentId = (Guid?)null, examRequestId = "", zone = "16", notes = "",
        }, HttpStatusCode.OK);
        var archive = File(edited!, uploaded.Str("id"))["archive"]!;
        Assert.Equal(1, archive["version"]!.GetValue<int>());
        Assert.Equal("Periapical 16", archive.Str("displayName"));
        var audit = archive["audit"]!.AsArray().Single()!;
        Assert.Equal("editar", audit.Str("action"));
        Assert.Equal(["displayName", "professionalId", "zone"], audit["fields"]!.AsArray().Select(item => item!.GetValue<string>()));

        // Con la versión vieja, 409.
        await medico.PatchJson($"/api/clinical-history/attachments/{uploaded.Str("id")}", new
        {
            version = 0, displayName = "Otra", clinicalType = "radiografia_periapical", tagIds = Array.Empty<Guid>(),
        }, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task El_vinculo_con_el_examen_no_se_reasigna_y_editar_puede_vincular()
    {
        var (medico, patientId, professionalId) = await NewPatientAsync();
        var (_, examId) = await PendingExamAsync(medico, patientId, professionalId);
        var history = await AttachOkAsync(medico, patientId, Png(5), Draft());
        var id = history["record"]!["attachments"]![0].Str("id");

        object Body(int version, string exam) => new
        {
            version, displayName = "Panorámica", clinicalType = "panoramica", tagIds = Array.Empty<Guid>(), examRequestId = exam,
        };

        // Sin vínculo previo: editar lo vincula y el examen pasa a recibido.
        var linked = await medico.PatchJson($"/api/clinical-history/attachments/{id}", Body(1, examId), HttpStatusCode.OK);
        Assert.Equal(id, linked!["record"]!["examRequests"]![0].Str("attachmentId"));

        // Ya vinculado: no se puede cambiar ni quitar.
        var error = await medico.PatchJson($"/api/clinical-history/attachments/{id}", Body(2, ""), HttpStatusCode.BadRequest);
        Assert.True(error.HasError("examRequestId"));
    }

    [Fact]
    public async Task Archivar_y_restaurar_conservan_el_archivo_en_la_historia()
    {
        var (medico, patientId, _) = await NewPatientAsync();
        var history = await AttachOkAsync(medico, patientId, Png(6), Draft());
        var id = history["record"]!["attachments"]![0].Str("id");

        var archived = await medico.PostJson($"/api/clinical-history/attachments/{id}/archive", new { version = 1 }, HttpStatusCode.OK);
        var archive = File(archived!, id)["archive"]!;
        Assert.NotNull(archive["archivedAt"]);
        Assert.Equal(2, archive["version"]!.GetValue<int>());
        await medico.PostJson($"/api/clinical-history/attachments/{id}/restore", new { version = 1 }, HttpStatusCode.Conflict);

        // Guardar la historia (el PUT manda solo los ids) no borra los metadatos.
        var record = archived!["record"]!.AsObject();
        await medico.PutJson($"/api/clinical-history/patients/{patientId}", record, HttpStatusCode.OK);
        var restored = await medico.PostJson($"/api/clinical-history/attachments/{id}/restore", new { version = 2 }, HttpStatusCode.OK);
        var final = File(restored!, id)["archive"]!;
        Assert.Null(final["archivedAt"]);
        Assert.Equal("Panorámica inicial", final.Str("displayName"));
        Assert.Equal(["adjuntar", "archivar", "restaurar"], final["audit"]!.AsArray().Select(item => item.Str("action")));

        await (await api.As("recepcion")).PostJson($"/api/clinical-history/attachments/{id}/archive", new { version = 3 }, HttpStatusCode.Forbidden);
        await medico.PostJson($"/api/clinical-history/attachments/{Guid.NewGuid()}/archive", new { version = 0 }, HttpStatusCode.NotFound);
    }
}
