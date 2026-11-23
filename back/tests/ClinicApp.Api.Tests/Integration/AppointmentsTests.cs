using System.Net;
using System.Net.Http.Json;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class AppointmentsTests(ApiFactory api)
{
    /// <summary>Cada prueba usa su propio profesional y consultorio, para no chocar con las demás.</summary>
    private sealed record Agenda(HttpClient Admin, Guid PatientId, Guid ProfessionalId, Guid RoomId, DateOnly Day);

    private async Task<Agenda> NewAgendaAsync(int daysAhead = 30)
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync();
        return new Agenda(admin, patient.Id(), await admin.ProfessionalIdAsync(), await admin.RoomIdAsync(),
            TestData.TodayInClinic().AddDays(daysAhead));
    }

    private static Dictionary<string, object?> Body(Agenda agenda, string start = "09:00", string end = "09:30", Guid? professionalId = null, Guid? roomId = null) => new()
    {
        ["patientId"] = agenda.PatientId.ToString(),
        ["professionalId"] = (professionalId ?? agenda.ProfessionalId).ToString(),
        ["treatmentId"] = "",
        ["roomId"] = (roomId ?? agenda.RoomId).ToString(),
        ["date"] = agenda.Day.Iso(),
        ["startTime"] = start,
        ["endTime"] = end,
        ["notes"] = "Control",
    };

    [Fact]
    public async Task Crear_convierte_la_hora_de_la_clinica_a_UTC()
    {
        var agenda = await NewAgendaAsync();

        var created = await agenda.Admin.PostJson("/api/appointments", Body(agenda), HttpStatusCode.Created);

        // 09:00 en Ecuador (UTC−5) = 14:00 UTC.
        Assert.Equal(agenda.Day.ToDateTime(new TimeOnly(14, 0), DateTimeKind.Utc), created!["start"]!.GetValue<DateTime>().ToUniversalTime());
        Assert.Equal("programada", created.Str("status"));
        Assert.Null(created["treatmentId"]);
    }

    [Fact]
    public async Task La_cita_trae_el_nombre_del_paciente_en_el_detalle_y_en_la_agenda()
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync("Rosa", "Agenda Nombre");
        var agenda = new Agenda(admin, patient.Id(), await admin.ProfessionalIdAsync(), await admin.RoomIdAsync(), TestData.TodayInClinic().AddDays(33));

        var created = await admin.PostJson("/api/appointments", Body(agenda, "07:00", "07:20"), HttpStatusCode.Created);
        Assert.Equal("Rosa Agenda Nombre", created.Str("patientName"));

        var detail = await admin.GetJson($"/api/appointments/{created.Id()}");
        Assert.Equal("Rosa Agenda Nombre", detail.Str("patientName"));

        var day = agenda.Day.Iso();
        var list = (await admin.GetJson($"/api/appointments?from={day}&to={day}"))!.AsArray();
        Assert.Equal("Rosa Agenda Nombre", list.Single(item => item!["id"]!.GetValue<string>() == created.Id().ToString())!.Str("patientName"));
    }

    [Theory]
    [InlineData("recepcion")]
    [InlineData("medico")]
    public async Task Los_tres_roles_agendan(string role)
    {
        var agenda = await NewAgendaAsync();
        var client = await api.As(role);

        await client.PostJson("/api/appointments", Body(agenda), HttpStatusCode.Created);
    }

    [Fact]
    public async Task Validaciones_de_la_cita()
    {
        var agenda = await NewAgendaAsync();

        var reversed = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "10:00", "09:00"), HttpStatusCode.BadRequest);
        Assert.True(reversed.HasError("endTime"));

        var badPatient = Body(agenda);
        badPatient["patientId"] = Guid.NewGuid().ToString();
        Assert.True((await agenda.Admin.PostJson("/api/appointments", badPatient, HttpStatusCode.BadRequest)).HasError("patientId"));

        var badRoom = Body(agenda);
        badRoom["roomId"] = "room_1";
        Assert.True((await agenda.Admin.PostJson("/api/appointments", badRoom, HttpStatusCode.BadRequest)).HasError("roomId"));

        var badTime = Body(agenda, "9:00");
        Assert.True((await agenda.Admin.PostJson("/api/appointments", badTime, HttpStatusCode.BadRequest)).HasError("startTime"));
    }

    [Fact]
    public async Task Paciente_dado_de_baja_y_profesional_inactivo_dan_400()
    {
        var agenda = await NewAgendaAsync();
        await agenda.Admin.Delete($"/api/patients/{agenda.PatientId}", HttpStatusCode.NoContent);
        var inactive = await agenda.Admin.ProfessionalIdAsync();
        await agenda.Admin.PutJson($"/api/professionals/{inactive}", new { name = "Dr. Inactivo", specialty = "General", active = false }, HttpStatusCode.OK);

        var error = await agenda.Admin.PostJson("/api/appointments", Body(agenda, professionalId: inactive), HttpStatusCode.BadRequest);

        Assert.True(error.HasError("patientId"));
        Assert.True(error.HasError("professionalId"));
    }

    [Fact]
    public async Task Los_cuatro_choques_con_sus_mensajes()
    {
        var agenda = await NewAgendaAsync();
        var otherProfessional = await agenda.Admin.ProfessionalIdAsync();
        var otherRoom = await agenda.Admin.RoomIdAsync();
        await agenda.Admin.PostJson("/api/appointments", Body(agenda, "09:00", "10:00"), HttpStatusCode.Created);

        var professionalBusy = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "09:30", "10:30", roomId: otherRoom), HttpStatusCode.Conflict);
        Assert.Equal("El profesional ya tiene una cita agendada en ese horario", professionalBusy!["errors"]!["startTime"]![0]!.GetValue<string>());

        var roomBusy = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "09:30", "10:30", professionalId: otherProfessional), HttpStatusCode.Conflict);
        Assert.Equal("El consultorio ya está ocupado en ese horario", roomBusy.Str("title"));

        await agenda.Admin.PostJson("/api/schedule-blocks", new
        {
            professionalId = agenda.ProfessionalId.ToString(), roomId = "", date = agenda.Day.Iso(), startTime = "12:00", endTime = "13:00", reason = "Almuerzo",
        }, HttpStatusCode.Created);
        await agenda.Admin.PostJson("/api/schedule-blocks", new
        {
            professionalId = "", roomId = agenda.RoomId.ToString(), date = agenda.Day.Iso(), startTime = "15:00", endTime = "16:00", reason = "Mantenimiento",
        }, HttpStatusCode.Created);

        var blocked = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "12:30", "13:30", roomId: otherRoom), HttpStatusCode.Conflict);
        Assert.Equal("El profesional tiene un bloqueo de horario en ese rango", blocked.Str("title"));

        var roomBlocked = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "15:00", "15:30", professionalId: otherProfessional), HttpStatusCode.Conflict);
        Assert.Equal("El consultorio tiene un bloqueo de horario en ese rango", roomBlocked.Str("title"));
    }

    [Fact]
    public async Task Citas_pegadas_se_permiten_y_una_cancelada_libera_el_horario()
    {
        var agenda = await NewAgendaAsync();
        var first = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "09:00", "10:00"), HttpStatusCode.Created);

        await agenda.Admin.PostJson("/api/appointments", Body(agenda, "10:00", "10:30"), HttpStatusCode.Created);

        await agenda.Admin.PatchJson($"/api/appointments/{first.Id()}/status", new { status = "cancelada" }, HttpStatusCode.OK);
        await agenda.Admin.PostJson("/api/appointments", Body(agenda, "09:00", "09:45"), HttpStatusCode.Created);
    }

    [Fact]
    public async Task Diez_agendados_simultaneos_en_el_mismo_horario_crean_solo_uno()
    {
        var agenda = await NewAgendaAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ =>
            agenda.Admin.PostAsync("/api/appointments", JsonContent.Create(Body(agenda, "11:00", "11:30")))));

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(9, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Editar_no_choca_consigo_misma_y_una_completada_no_se_edita()
    {
        var agenda = await NewAgendaAsync();
        var created = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "09:00", "10:00"), HttpStatusCode.Created);

        var moved = await agenda.Admin.PutJson($"/api/appointments/{created.Id()}", Body(agenda, "09:30", "10:30"), HttpStatusCode.OK);
        Assert.Equal("Control", moved.Str("notes"));

        await agenda.Admin.PatchJson($"/api/appointments/{created.Id()}/status", new { status = "completada" }, HttpStatusCode.OK);
        await agenda.Admin.PutJson($"/api/appointments/{created.Id()}", Body(agenda, "11:00", "11:30"), HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Cambios_de_estado_permitidos_y_prohibidos()
    {
        var agenda = await NewAgendaAsync();
        var created = await agenda.Admin.PostJson("/api/appointments", Body(agenda), HttpStatusCode.Created);
        var url = $"/api/appointments/{created.Id()}/status";

        await agenda.Admin.PatchJson(url, new { status = "confirmada" }, HttpStatusCode.OK);
        await agenda.Admin.PatchJson(url, new { status = "confirmada" }, HttpStatusCode.OK); // mismo estado
        await agenda.Admin.PatchJson(url, new { status = "programada" }, HttpStatusCode.Conflict);
        await agenda.Admin.PatchJson(url, new { status = "no_asistio" }, HttpStatusCode.OK);
        await agenda.Admin.PatchJson(url, new { status = "completada" }, HttpStatusCode.Conflict);
        await agenda.Admin.PatchJson(url, new { status = "otro" }, HttpStatusCode.BadRequest);
        await agenda.Admin.PatchJson($"/api/appointments/{Guid.NewGuid()}/status", new { status = "cancelada" }, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Listar_por_rango_por_paciente_y_sin_filtros()
    {
        var agenda = await NewAgendaAsync(daysAhead: 60);
        var early = await agenda.Admin.PostJson("/api/appointments", Body(agenda, "08:00", "08:30"), HttpStatusCode.Created);
        var nextDay = agenda with { Day = agenda.Day.AddDays(1) };
        var late = await agenda.Admin.PostJson("/api/appointments", Body(nextDay, "08:00", "08:30"), HttpStatusCode.Created);

        var byPatient = (await agenda.Admin.GetJson($"/api/appointments?patientId={agenda.PatientId}"))!.AsArray();
        Assert.Equal([late.Id(), early.Id()], byPatient.Select(item => item.Id()));

        var oneDay = (await agenda.Admin.GetJson($"/api/appointments?from={agenda.Day.Iso()}&to={agenda.Day.Iso()}&professionalId={agenda.ProfessionalId}"))!.AsArray();
        Assert.Equal([early.Id()], oneDay.Select(item => item.Id()));

        var all = (await agenda.Admin.GetJson("/api/appointments"))!.AsArray();
        Assert.Contains(all, item => item.Id() == late.Id());

        await agenda.Admin.GetJson($"/api/appointments?from={agenda.Day.AddDays(1).Iso()}&to={agenda.Day.Iso()}", HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Bloqueos_crear_borrar_y_choque_con_cita()
    {
        var agenda = await NewAgendaAsync();
        await agenda.Admin.PostJson("/api/appointments", Body(agenda, "09:00", "10:00"), HttpStatusCode.Created);

        var conflict = await agenda.Admin.PostJson("/api/schedule-blocks", new
        {
            professionalId = agenda.ProfessionalId.ToString(), date = agenda.Day.Iso(), startTime = "09:30", endTime = "11:00", reason = "Reunión",
        }, HttpStatusCode.Conflict);
        Assert.Equal("El profesional tiene una cita agendada en ese horario", conflict.Str("title"));

        var noTarget = await agenda.Admin.PostJson("/api/schedule-blocks", new
        {
            professionalId = "", roomId = "", date = agenda.Day.Iso(), startTime = "12:00", endTime = "13:00", reason = "Nada",
        }, HttpStatusCode.BadRequest);
        Assert.True(noTarget.HasError("roomId"));

        var first = await agenda.Admin.PostJson("/api/schedule-blocks", new
        {
            roomId = agenda.RoomId.ToString(), date = agenda.Day.Iso(), startTime = "14:00", endTime = "15:00", reason = "Limpieza",
        }, HttpStatusCode.Created);
        // Los bloqueos pueden superponerse entre sí.
        await agenda.Admin.PostJson("/api/schedule-blocks", new
        {
            roomId = agenda.RoomId.ToString(), date = agenda.Day.Iso(), startTime = "14:30", endTime = "15:30", reason = "Revisión",
        }, HttpStatusCode.Created);

        var listed = (await agenda.Admin.GetJson($"/api/schedule-blocks?from={agenda.Day.Iso()}&to={agenda.Day.Iso()}"))!.AsArray();
        Assert.Contains(listed, item => item.Id() == first.Id());

        await agenda.Admin.Delete($"/api/schedule-blocks/{first.Id()}", HttpStatusCode.NoContent);
        await agenda.Admin.Delete($"/api/schedule-blocks/{first.Id()}", HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Un_tratamiento_con_citas_no_se_borra_y_el_profesional_cuenta_sus_citas_futuras()
    {
        var agenda = await NewAgendaAsync();
        var treatment = await agenda.Admin.PostJson("/api/treatments", new
        {
            name = $"Limpieza {TestData.Next()}", category = "Preventivo", durationMinutes = 30, price = 25, active = true, consumption = Array.Empty<object>(),
        }, HttpStatusCode.Created);
        var body = Body(agenda);
        body["treatmentId"] = treatment.Str("id");
        await agenda.Admin.PostJson("/api/appointments", body, HttpStatusCode.Created);

        var error = await agenda.Admin.Delete($"/api/treatments/{treatment.Id()}", HttpStatusCode.Conflict);
        Assert.Equal("Este tratamiento ya se usó. Desactívalo en su lugar.", error.Str("title"));

        var professional = await agenda.Admin.PutJson($"/api/professionals/{agenda.ProfessionalId}",
            new { name = "Dr. Con Citas", specialty = "General", active = false }, HttpStatusCode.OK);
        Assert.Equal(1, professional!["futureAppointments"]!.GetValue<int>());
    }
}
