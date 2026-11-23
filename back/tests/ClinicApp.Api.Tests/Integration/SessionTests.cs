using System.Net;
using System.Net.Http.Json;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>
/// "Recordarme" (plan 12, punto 3.1). Sin marcar, la cookie de renovación es de sesión (sin fecha: el navegador
/// la borra al cerrarse) y el token vence en 12 horas sin actividad. Marcado, la cookie dura 7 días. La sesión
/// renovada conserva el modo con el que se inició.
/// </summary>
[Collection(ApiCollection.Name)]
public class SessionTests(ApiFactory api)
{
    [Fact]
    public async Task Sin_recordarme_la_cookie_es_de_sesion_y_vence_en_12_horas()
    {
        var cookie = await LoginAsync(rememberMe: false);
        Assert.DoesNotContain("expires=", cookie.Header, StringComparison.OrdinalIgnoreCase);
        await AssertTokenAsync(cookie.Value, persistent: false, TimeSpan.FromHours(12));

        var renewed = await RefreshAsync(cookie.Value);
        Assert.DoesNotContain("expires=", renewed.Header, StringComparison.OrdinalIgnoreCase);
        await AssertTokenAsync(renewed.Value, persistent: false, TimeSpan.FromHours(12));
    }

    [Fact]
    public async Task Con_recordarme_la_cookie_dura_7_dias_y_se_conserva_al_renovar()
    {
        var cookie = await LoginAsync(rememberMe: true);
        Assert.Contains("expires=", cookie.Header, StringComparison.OrdinalIgnoreCase);
        await AssertTokenAsync(cookie.Value, persistent: true, TimeSpan.FromDays(7));

        var renewed = await RefreshAsync(cookie.Value);
        Assert.Contains("expires=", renewed.Header, StringComparison.OrdinalIgnoreCase);
        await AssertTokenAsync(renewed.Value, persistent: true, TimeSpan.FromDays(7));
    }

    [Fact]
    public async Task Sin_indicarlo_no_recuerda()
    {
        using var client = Client();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "medico@clinica.com", password = "medico123" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cookie = RefreshCookie(response);
        await AssertTokenAsync(cookie.Value, persistent: false, TimeSpan.FromHours(12));
    }

    // ───────────── Ayudantes ─────────────

    private sealed record Cookie(string Header, string Value);

    // Sin el manejo automático de cookies: la cookie es Secure y el servidor de pruebas usa http.
    private HttpClient Client() => api.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<Cookie> LoginAsync(bool rememberMe)
    {
        using var client = Client();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "recepcion@clinica.com", password = "recepcion123", rememberMe });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return RefreshCookie(response);
    }

    private async Task<Cookie> RefreshAsync(string token)
    {
        using var client = Client();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add("Cookie", $"{AuthController.RefreshCookieName}={token}");
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return RefreshCookie(response);
    }

    private static Cookie RefreshCookie(HttpResponseMessage response)
    {
        var header = response.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith(AuthController.RefreshCookieName + "="));
        var value = header[(AuthController.RefreshCookieName.Length + 1)..header.IndexOf(';')];
        return new Cookie(header, Uri.UnescapeDataString(value));
    }

    private async Task AssertTokenAsync(string token, bool persistent, TimeSpan lifetime)
    {
        await using var scope = api.Db();
        var hash = TokenService.Hash(token);
        var stored = await scope.Context.RefreshTokens.SingleAsync(entry => entry.TokenHash == hash);
        Assert.Equal(persistent, stored.Persistent);
        Assert.InRange(stored.ExpiresAt - stored.CreatedAt, lifetime - TimeSpan.FromSeconds(1), lifetime + TimeSpan.FromSeconds(1));
    }
}
