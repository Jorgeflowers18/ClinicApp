using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Patients;

public static class PatientNames
{
    /// <summary>
    /// "Nombres Apellidos" de cada paciente, en una sola consulta (también los dados de baja). Para que las
    /// listas que nombran pacientes (citas, atenciones, tratamientos realizados, notificaciones) no obliguen al
    /// frontend a pedir cada paciente por separado ni a cargar "los primeros 100".
    /// </summary>
    public static async Task<Dictionary<Guid, string>> PatientNamesAsync(
        this AppDbContext db, IEnumerable<Guid> patientIds, CancellationToken cancellationToken)
    {
        var ids = patientIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return await db.Patients.AsNoTracking()
            .Where(patient => ids.Contains(patient.Id))
            .ToDictionaryAsync(patient => patient.Id, patient => (patient.FirstName + " " + patient.LastName).Trim(), cancellationToken);
    }
}
