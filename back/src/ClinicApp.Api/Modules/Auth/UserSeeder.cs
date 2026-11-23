using ClinicApp.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Auth;

/// <summary>
/// Crea los usuarios iniciales al arrancar. Los demás los crea el admin desde /administracion (UsersController).
/// <list type="bullet">
/// <item><b>Desarrollo:</b> si no hay ningún usuario, crea las tres cuentas de prueba del modo mock del
/// frontend (admin@clinica.com / admin123, recepcion@clinica.com / recepcion123, medico@clinica.com / medico123).</item>
/// <item><b>Cualquier entorno:</b> si están <c>Seed:AdminEmail</c> y <c>Seed:AdminPassword</c> (en producción,
/// variables <c>Seed__AdminEmail</c> y <c>Seed__AdminPassword</c>) y ese correo no existe, crea ese administrador.</item>
/// </list>
/// </summary>
public static class UserSeeder
{
    private static readonly (string Email, string Password, string Name, string Role)[] DevelopmentAccounts =
    [
        ("admin@clinica.com", "admin123", "Ana Morales", Roles.Admin),
        ("recepcion@clinica.com", "recepcion123", "Luis Fernández", Roles.Recepcion),
        ("medico@clinica.com", "medico123", "Dra. Carla Ríos", Roles.Medico),
    ];

    public static async Task SeedUsersAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<User>>();

        try
        {
            if (app.Environment.IsDevelopment() && !await db.Users.AnyAsync())
            {
                foreach (var (email, password, name, role) in DevelopmentAccounts)
                {
                    db.Users.Add(NewUser(hasher, email, password, name, role));
                }
                await db.SaveChangesAsync();
                logger.LogInformation("Se crearon las cuentas de prueba de desarrollo ({Count}).", DevelopmentAccounts.Length);
            }

            var adminEmail = app.Configuration["Seed:AdminEmail"];
            var adminPassword = app.Configuration["Seed:AdminPassword"];

            if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrEmpty(adminPassword))
            {
                if (adminPassword.Length < 12)
                {
                    logger.LogError("Seed:AdminPassword debe tener al menos 12 caracteres. No se creó el administrador.");
                    return;
                }

                var email = AuthController.NormalizeEmail(adminEmail);
                if (!await db.Users.AnyAsync(u => u.Email == email))
                {
                    var name = app.Configuration["Seed:AdminName"] ?? "Administrador";
                    db.Users.Add(NewUser(hasher, email, adminPassword, name, Roles.Admin));
                    await db.SaveChangesAsync();
                    logger.LogInformation("Se creó el administrador inicial {Email}.", email);
                }
            }
        }
        catch (Exception exception)
        {
            // La API arranca igual: el chequeo de salud y los logs muestran el problema.
            logger.LogError(exception, "No se pudieron crear los usuarios iniciales. ¿Está la base levantada y con las migraciones aplicadas?");
        }
    }

    private static User NewUser(IPasswordHasher<User> hasher, string email, string password, string name, string role)
    {
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = email,
            Name = name,
            Role = role,
            CreatedAt = DateTime.UtcNow,
        };
        user.PasswordHash = hasher.HashPassword(user, password);
        return user;
    }
}
