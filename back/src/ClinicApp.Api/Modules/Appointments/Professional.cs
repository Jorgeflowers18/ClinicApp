namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// Profesional de la clínica (odontólogo, especialista). Tabla <c>professionals</c>.
/// No se borra: se desactiva, porque tiene citas, atenciones y ciclos de esterilización que deben
/// seguir mostrando su nombre.
/// </summary>
public class Professional
{
    public Guid Id { get; set; }

    /// <summary>Con el título: "Dra. Carla Ríos".</summary>
    public string Name { get; set; } = "";

    public string Specialty { get; set; } = "";

    /// <summary>Registro profesional (MSP / Senescyt). Vacío si no se registró.</summary>
    public string RegistrationNumber { get; set; } = "";

    public bool Active { get; set; } = true;

    public DateTime CreatedAt { get; set; }
}

/// <summary>Consultorio. Tabla <c>rooms</c>. Tampoco se borra: se desactiva.</summary>
public class Room
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    public bool Active { get; set; } = true;

    public DateTime CreatedAt { get; set; }
}
