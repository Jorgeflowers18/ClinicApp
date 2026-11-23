using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>
/// Gestión de usuarios (/api/users, solo admin). Las pruebas crean sus propias cuentas: las de la semilla
/// (admin, recepción y médico) las usan las demás pruebas y no se tocan.
/// </summary>
[Collection(ApiCollection.Name)]
public class UsersTests(ApiFactory api)
{
    private const string Password = "contrasena-segura-1";

    [Theory]
    [InlineData("recepcion")]
    [InlineData("medico")]
    public async Task Solo_admin_gestiona_usuarios(string role)
    {
        var client = await api.As(role);
        var someone = Guid.NewGuid();

        await client.GetJson("/api/users", HttpStatusCode.Forbidden);
        await client.PostJson("/api/users", NewUser("medico"), HttpStatusCode.Forbidden);
        await client.PutJson($"/api/users/{someone}", NewUser("medico"), HttpStatusCode.Forbidden);
        await client.PostJson($"/api/users/{someone}/password-link", null, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Crear_una_cuenta_y_entrar_con_el_enlace()
    {
        var admin = await api.As("admin");
        var body = NewUser("recepcion", email: $"  Nueva.{TestData.Next()}@Clinica.com ");

        var created = await admin.PostJson("/api/users", body, HttpStatusCode.Created);
        var user = created!["user"];
        var email = user.Str("email");
        Assert.Equal(((string)body["email"]!).Trim().ToLowerInvariant(), email);
        Assert.Equal("recepcion", user.Str("role"));
        Assert.True(user!["active"]!.GetValue<bool>());
        Assert.Null(user["lastLoginAt"]?.GetValue<string>());

        var link = created["passwordLink"].Str("url");
        Assert.Contains("/restablecer-contrasena?token=", link);
        var expiresAt = created["passwordLink"]!["expiresAt"]!.GetValue<DateTime>();
        Assert.InRange(expiresAt - DateTime.UtcNow, TimeSpan.FromHours(71), TimeSpan.FromHours(73));

        // Sin elegir contraseña no puede entrar.
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, Password)).Status);

        await SetPasswordAsync(link, HttpStatusCode.NoContent);
        var login = await LoginAsync(email, Password);
        Assert.Equal(HttpStatusCode.OK, login.Status);
        Assert.Equal("recepcion", login.Body!["user"].Str("role"));

        // El listado lo trae con su último ingreso y sin datos de la contraseña.
        var listed = (await admin.GetJson("/api/users"))!.AsArray().Single(item => item.Str("email") == email);
        Assert.NotNull(listed!["lastLoginAt"]?.GetValue<DateTime>());
        Assert.Null(listed["passwordHash"]);
        Assert.Equal(9, listed.AsObject().Count);
    }

    [Fact]
    public async Task Correo_rol_y_profesional_se_validan_en_su_campo()
    {
        var admin = await api.As("admin");

        var invalid = await admin.PostJson("/api/users", new { name = "Ab", email = "no-es-correo", role = "jefe" }, HttpStatusCode.BadRequest);
        Assert.True(invalid.HasError("name"));
        Assert.True(invalid.HasError("email"));
        Assert.True(invalid.HasError("role"));

        // El correo se compara sin mayúsculas: el de la semilla ya existe.
        var duplicate = await admin.PostJson("/api/users", NewUser("medico", email: "ADMIN@clinica.com"), HttpStatusCode.Conflict);
        Assert.True(duplicate.HasError("email"));

        var missing = await admin.PostJson("/api/users", NewUser("medico", professionalId: Guid.NewGuid()), HttpStatusCode.BadRequest);
        Assert.True(missing.HasError("professionalId"));
    }

    [Fact]
    public async Task Vincular_un_profesional_lo_muestra_en_el_catalogo_y_no_se_repite()
    {
        var admin = await api.As("admin");
        var professionalId = await admin.ProfessionalIdAsync();

        var created = await admin.PostJson("/api/users", NewUser("medico", professionalId: professionalId), HttpStatusCode.Created);
        var user = created!["user"];
        Assert.Equal(professionalId.ToString(), user.Str("professionalId"));
        Assert.StartsWith("Dr. Prueba", user.Str("professionalName"));
        Assert.Equal(user.Id().ToString(), await LinkedUserAsync(admin, professionalId));

        var conflict = await admin.PostJson("/api/users", NewUser("medico", professionalId: professionalId), HttpStatusCode.Conflict);
        Assert.True(conflict.HasError("professionalId"));

        // Desvincular lo quita del catálogo.
        await admin.PutJson($"/api/users/{user.Id()}", Edit(user, unlink: true), HttpStatusCode.OK);
        Assert.Equal("", await LinkedUserAsync(admin, professionalId));
    }

    [Fact]
    public async Task Desactivar_o_cambiar_el_rol_cierra_sus_sesiones()
    {
        var admin = await api.As("admin");
        var (user, email) = await CreateWithPasswordAsync(admin, "medico");
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, Password)).Status);
        Assert.True(await OpenSessionsAsync(user.Id()) > 0);

        var changed = await admin.PutJson($"/api/users/{user.Id()}", Edit(user, role: "recepcion"), HttpStatusCode.OK);
        Assert.Equal("recepcion", changed.Str("role"));
        Assert.Equal(0, await OpenSessionsAsync(user.Id()));

        // Vuelve a entrar con el rol nuevo; al desactivarla se cierra otra vez y ya no puede entrar.
        Assert.Equal("recepcion", (await LoginAsync(email, Password)).Body!["user"].Str("role"));
        await admin.PutJson($"/api/users/{user.Id()}", Edit(changed, active: false), HttpStatusCode.OK);
        Assert.Equal(0, await OpenSessionsAsync(user.Id()));

        var blocked = await LoginAsync(email, Password);
        Assert.Equal(HttpStatusCode.Forbidden, blocked.Status);
        Assert.Equal("Tu cuenta está desactivada", blocked.Body.Str("title"));

        // Sin sesión para una cuenta desactivada tampoco hay enlace nuevo.
        var link = await admin.PostJson($"/api/users/{user.Id()}/password-link", null, HttpStatusCode.Conflict);
        Assert.True(link.HasError("active"));
    }

    [Fact]
    public async Task El_admin_no_puede_desactivarse_ni_quitarse_el_rol()
    {
        var admin = await api.As("admin");
        var me = (await admin.GetJson("/api/auth/me"))!;
        var self = new { name = me.Str("name"), email = me.Str("email"), role = "admin", professionalId = (Guid?)null, active = true };

        var demote = await admin.PutJson($"/api/users/{me.Id()}", self with { role = "recepcion" }, HttpStatusCode.Conflict);
        Assert.True(demote.HasError("role"));
        var deactivate = await admin.PutJson($"/api/users/{me.Id()}", self with { active = false }, HttpStatusCode.Conflict);
        Assert.True(deactivate.HasError("active"));
    }

    [Fact]
    public async Task Siempre_queda_un_admin_activo_aunque_el_token_de_otro_no_haya_vencido()
    {
        var admin = await api.As("admin");
        var seedAdmin = (await admin.GetJson("/api/auth/me"))!;
        var (other, email) = await CreateWithPasswordAsync(admin, "admin");
        var otherClient = api.Anonymous();
        otherClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            (await LoginAsync(email, Password)).Body.Str("accessToken"));

        // Se le quita el rol, pero su token (con rol admin) sigue valiendo hasta 15 minutos: no puede dejar la clínica sin admins.
        await admin.PutJson($"/api/users/{other.Id()}", Edit(other, role: "recepcion"), HttpStatusCode.OK);
        var body = new { name = seedAdmin.Str("name"), email = seedAdmin.Str("email"), role = "medico", professionalId = (Guid?)null, active = true };
        var conflict = await otherClient.PutJson($"/api/users/{seedAdmin.Id()}", body, HttpStatusCode.Conflict);
        Assert.Equal("Debe quedar al menos un administrador activo", conflict.Str("title"));

        var stillAdmin = (await admin.GetJson("/api/users"))!.AsArray().Single(item => item.Id() == seedAdmin.Id());
        Assert.Equal("admin", stillAdmin.Str("role"));
    }

    [Fact]
    public async Task Un_enlace_nuevo_invalida_el_anterior()
    {
        var admin = await api.As("admin");
        var created = await admin.PostJson("/api/users", NewUser("recepcion"), HttpStatusCode.Created);
        var first = created!["passwordLink"].Str("url");

        var second = (await admin.PostJson($"/api/users/{created["user"].Id()}/password-link", null, HttpStatusCode.OK)).Str("url");
        Assert.NotEqual(first, second);

        await SetPasswordAsync(first, HttpStatusCode.BadRequest);
        await SetPasswordAsync(second, HttpStatusCode.NoContent);
        // De un solo uso.
        await SetPasswordAsync(second, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Una_cuenta_desactivada_no_puede_usar_su_enlace()
    {
        var admin = await api.As("admin");
        var created = await admin.PostJson("/api/users", NewUser("medico"), HttpStatusCode.Created);
        await admin.PutJson($"/api/users/{created!["user"].Id()}", Edit(created["user"], active: false), HttpStatusCode.OK);

        await SetPasswordAsync(created["passwordLink"].Str("url"), HttpStatusCode.BadRequest);
    }

    // ───────────── Ayudantes ─────────────

    private static Dictionary<string, object?> NewUser(string role, string? email = null, Guid? professionalId = null) => new()
    {
        ["name"] = $"Usuario Prueba {TestData.Next()}",
        ["email"] = email ?? $"usuario{TestData.Next()}@clinica.com",
        ["role"] = role,
        ["professionalId"] = professionalId,
    };

    /// <summary>El cuerpo del PUT a partir de una cuenta, con los cambios pedidos.</summary>
    private static Dictionary<string, object?> Edit(JsonNode? user, string? role = null, bool? active = null, bool unlink = false)
    {
        var current = user.Str("professionalId");
        return new()
        {
            ["name"] = user.Str("name"),
            ["email"] = user.Str("email"),
            ["role"] = role ?? user.Str("role"),
            ["professionalId"] = !unlink && current.Length > 0 ? Guid.Parse(current) : null,
            ["active"] = active ?? user!["active"]!.GetValue<bool>(),
        };
    }

    private async Task<(JsonNode User, string Email)> CreateWithPasswordAsync(HttpClient admin, string role)
    {
        var created = await admin.PostJson("/api/users", NewUser(role), HttpStatusCode.Created);
        await SetPasswordAsync(created!["passwordLink"].Str("url"), HttpStatusCode.NoContent);
        return (created["user"]!, created["user"].Str("email"));
    }

    private async Task SetPasswordAsync(string link, HttpStatusCode expected)
    {
        var token = Uri.UnescapeDataString(link[(link.IndexOf("token=", StringComparison.Ordinal) + "token=".Length)..]);
        await api.Anonymous().PostJson("/api/auth/password-reset", new { token, password = Password }, expected);
    }

    private async Task<(HttpStatusCode Status, JsonNode? Body)> LoginAsync(string email, string password)
    {
        var response = await api.Anonymous().PostAsJsonAsync("/api/auth/login", new { email, password });
        return (response.StatusCode, await response.JsonAsync());
    }

    private static async Task<string> LinkedUserAsync(HttpClient admin, Guid professionalId) =>
        (await admin.GetJson($"/api/professionals/{professionalId}")).Str("userId");

    private async Task<int> OpenSessionsAsync(Guid userId)
    {
        await using var scope = api.Db();
        return await scope.Context.RefreshTokens.CountAsync(token => token.UserId == userId && token.RevokedAt == null);
    }
}
