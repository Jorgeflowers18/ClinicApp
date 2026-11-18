using System.ComponentModel.DataAnnotations;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// Profesional: la forma de <c>Professional</c> del frontend (appointment.types.ts), más <c>active</c>
/// y <c>userId</c> (el usuario vinculado, si tiene).
/// </summary>
public record ProfessionalDto(Guid Id, string Name, string Specialty, string RegistrationNumber, bool Active, Guid? UserId)
{
    public static ProfessionalDto FromEntity(Professional professional, Guid? userId) => new(
        professional.Id, professional.Name, professional.Specialty, professional.RegistrationNumber, professional.Active, userId);
}

/// <summary>Respuesta de PUT: el profesional y cuántas citas futuras tiene (para avisar al desactivarlo).</summary>
public record ProfessionalUpdateDto(Guid Id, string Name, string Specialty, string RegistrationNumber, bool Active, Guid? UserId, int FutureAppointments);

public class ProfessionalRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(3, ErrorMessage = "Mínimo 3 caracteres")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string Name { get; set; } = "";

    [Required(ErrorMessage = "La especialidad es obligatoria")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(80, ErrorMessage = "Máximo 80 caracteres")]
    public string Specialty { get; set; } = "";

    [MaxLength(40, ErrorMessage = "Máximo 40 caracteres")]
    public string? RegistrationNumber { get; set; }

    /// <summary>Si no viene, el profesional queda activo.</summary>
    public bool Active { get; set; } = true;

    /// <summary>Usuario de la app que es este profesional (o null para desvincular).</summary>
    public Guid? UserId { get; set; }

    public void ApplyTo(Professional professional)
    {
        professional.Name = Name.Trim();
        professional.Specialty = Specialty.Trim();
        professional.RegistrationNumber = RegistrationNumber?.Trim() ?? "";
        professional.Active = Active;
    }
}

/// <summary>Consultorio: la forma de <c>Room</c> del frontend, más <c>active</c>.</summary>
public record RoomDto(Guid Id, string Name, bool Active)
{
    public static RoomDto FromEntity(Room room) => new(room.Id, room.Name, room.Active);
}

public class RoomRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string Name { get; set; } = "";

    public bool Active { get; set; } = true;
}
