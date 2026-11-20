using System.Buffers.Text;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace ClinicApp.Api.Modules.Auth;

/// <summary>Crea los access tokens (JWT) y los tokens opacos (refresh y recuperación de contraseña).</summary>
public sealed class TokenService(AuthOptions options)
{
    private readonly JsonWebTokenHandler _handler = new();

    /// <summary>JWT firmado con el id, correo, nombre y rol del usuario. Devuelve también su vida en segundos.</summary>
    public (string Token, int ExpiresIn) CreateAccessToken(User user)
    {
        var now = DateTime.UtcNow;
        var lifetime = TimeSpan.FromMinutes(options.AccessTokenMinutes);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.Add(lifetime),
            Subject = new ClaimsIdentity(
            [
                new Claim(AuthClaims.UserId, user.Id.ToString()),
                new Claim(AuthClaims.Email, user.Email),
                new Claim(AuthClaims.Name, user.Name),
                new Claim(AuthClaims.Role, user.Role),
            ]),
            SigningCredentials = new SigningCredentials(options.GetSigningKey(), SecurityAlgorithms.HmacSha256),
        };

        return (_handler.CreateToken(descriptor), (int)lifetime.TotalSeconds);
    }

    /// <summary>Token aleatorio de 256 bits, seguro para usar en una cookie o en una URL.</summary>
    public static string NewOpaqueToken() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    /// <summary>Hash SHA-256 en hexadecimal (64 caracteres). Es lo único que se guarda en la base.</summary>
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

/// <summary>Nombres de los claims dentro del JWT (nombres cortos estándar, sin el mapeo de Microsoft).</summary>
public static class AuthClaims
{
    public const string UserId = "sub";
    public const string Email = "email";
    public const string Name = "name";
    public const string Role = "role";

    /// <summary>Id del usuario autenticado, o <c>null</c> si el token no lo trae.</summary>
    public static Guid? GetUserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(UserId), out var id) ? id : null;
}
