using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ClinicApp.Api.Modules.Auth;

/// <summary>
/// Sección "Auth" de la configuración. La clave de firma (<c>Auth:SigningKey</c>) es un secreto:
/// en desarrollo está en appsettings.Development.json y en producción va en la variable de entorno
/// <c>Auth__SigningKey</c>.
/// </summary>
public sealed class AuthOptions
{
    public const string Section = "Auth";

    public string Issuer { get; init; } = "clinicapp";
    public string Audience { get; init; } = "clinicapp";

    /// <summary>Clave HMAC para firmar los JWT. Mínimo 32 caracteres, aleatoria.</summary>
    public string SigningKey { get; init; } = "";

    /// <summary>Vida del access token. Corta: si alguien lo roba, deja de servir pronto.</summary>
    public int AccessTokenMinutes { get; init; } = 15;

    /// <summary>Vida de la sesión sin actividad. Cada renovación la extiende.</summary>
    public int RefreshTokenDays { get; init; } = 7;

    /// <summary>Vida del enlace de recuperación de contraseña.</summary>
    public int PasswordResetMinutes { get; init; } = 60;

    /// <summary>URL del frontend, para armar el enlace de recuperación de contraseña.</summary>
    public string FrontendBaseUrl { get; init; } = "";

    public SymmetricSecurityKey GetSigningKey() => new(Encoding.UTF8.GetBytes(SigningKey));

    /// <summary>Lee y valida la sección al arrancar: si falta algo, la API no arranca.</summary>
    public static AuthOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection(Section).Get<AuthOptions>() ?? new AuthOptions();

        if (options.SigningKey.Length < 32)
        {
            throw new InvalidOperationException(
                "Falta 'Auth:SigningKey' o tiene menos de 32 caracteres. En producción defínela en la variable de entorno Auth__SigningKey.");
        }

        if (!Uri.TryCreate(options.FrontendBaseUrl, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException(
                "Falta 'Auth:FrontendBaseUrl' (por ejemplo https://midominio.com). En producción defínela en Auth__FrontendBaseUrl.");
        }

        return options;
    }
}
