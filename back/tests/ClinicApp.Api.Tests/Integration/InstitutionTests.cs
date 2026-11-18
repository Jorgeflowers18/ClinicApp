using System.Net;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>El perfil es una sola fila compartida: estas pruebas no corren en paralelo entre sí.</summary>
[Collection(ApiCollection.Name)]
public class InstitutionTests(ApiFactory api)
{
    private const string TinyPng =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    private static Dictionary<string, object?> Body(params object[] branches) => new()
    {
        ["name"] = "Clínica Sonrisas",
        ["legalName"] = "Sonrisas S.A.",
        ["ruc"] = "1798765432001",
        ["phone"] = "+593 98 123 4567",
        ["email"] = "Contacto@Sonrisas.ec",
        ["address"] = "Av. Amazonas N45-120, Quito",
        ["website"] = "https://sonrisas.ec",
        ["logoText"] = "CS",
        ["logoImage"] = TinyPng,
        ["notes"] = "Notas internas",
        ["hours"] = "Lunes a viernes: 08:00 - 18:00",
        ["branches"] = branches,
    };

    private static object Branch(string id, string name, bool isMain = false) =>
        new { id, name, address = "Quito", phone = "022222222", hours = "08:00 - 18:00", isMain };

    [Fact]
    public async Task El_perfil_existe_desde_el_arranque_y_lo_leen_los_tres_roles()
    {
        foreach (var role in new[] { "admin", "recepcion", "medico" })
        {
            var profile = await (await api.As(role)).GetJson("/api/institution/profile");
            Assert.False(string.IsNullOrWhiteSpace(profile.Str("name")));
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.Anonymous().GetAsync("/api/institution/profile")).StatusCode);
    }

    [Fact]
    public async Task Guardar_sedes_reordenar_quitar_y_cambiar_la_principal()
    {
        var admin = await api.As("admin");

        var saved = await admin.PutJson("/api/institution/profile",
            Body(Branch("branch-1", "Matriz", isMain: true), Branch("branch-2", "Norte")), HttpStatusCode.OK);
        Assert.Equal("contacto@sonrisas.ec", saved.Str("email"));
        Assert.Equal(["branch-1", "branch-2"], saved!["branches"]!.AsArray().Select(branch => branch.Str("id")));

        // La principal pasa a "Norte", se reordena, se quita la matriz y se agrega otra.
        var changed = await admin.PutJson("/api/institution/profile",
            Body(Branch("branch-3", "Sur"), Branch("branch-2", "Norte", isMain: true)), HttpStatusCode.OK);
        var branches = changed!["branches"]!.AsArray();
        Assert.Equal(["branch-3", "branch-2"], branches.Select(branch => branch.Str("id")));
        Assert.True(branches[1]!["isMain"]!.GetValue<bool>());

        var read = await admin.GetJson("/api/institution/profile");
        Assert.Equal(2, read!["branches"]!.AsArray().Count);
    }

    [Theory]
    [InlineData("ruc", "123456789012")]
    [InlineData("ruc", "17987654320AB")]
    [InlineData("email", "no-es-correo")]
    [InlineData("website", "sonrisas.ec")]
    [InlineData("logoImage", "data:image/svg+xml;base64,PHN2Zz4=")]
    [InlineData("logoImage", "https://otro.com/logo.png")]
    [InlineData("name", "")]
    public async Task Validacion_del_perfil(string field, string value)
    {
        var admin = await api.As("admin");
        var body = Body();
        body[field] = value;

        var error = await admin.PutJson("/api/institution/profile", body, HttpStatusCode.BadRequest);

        Assert.True(error.HasError(field), $"Se esperaba un error en {field}: {error}");
    }

    [Fact]
    public async Task Dos_sedes_principales_o_sin_nombre_dan_400()
    {
        var admin = await api.As("admin");

        var twoMain = await admin.PutJson("/api/institution/profile",
            Body(Branch("a", "Uno", isMain: true), Branch("b", "Dos", isMain: true)), HttpStatusCode.BadRequest);
        Assert.True(twoMain.HasError("branches"));

        var noName = await admin.PutJson("/api/institution/profile", Body(Branch("a", "")), HttpStatusCode.BadRequest);
        Assert.True(noName.HasError("branches[0].name"));
    }

    [Fact]
    public async Task Solo_admin_guarda()
    {
        await (await api.As("recepcion")).PutJson("/api/institution/profile", Body(), HttpStatusCode.Forbidden);
        await (await api.As("medico")).PutJson("/api/institution/profile", Body(), HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task El_endpoint_publico_no_pide_sesion_y_solo_trae_nombre_y_logo()
    {
        var admin = await api.As("admin");
        await admin.PutJson("/api/institution/profile", Body(), HttpStatusCode.OK);

        var response = await api.Anonymous().GetAsync("/api/institution/public");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = (await response.JsonAsync()).AsObject();

        Assert.Equal(["name", "logoText", "logoImage"], body.Select(property => property.Key));
        Assert.Equal("Clínica Sonrisas", body.Str("name"));
    }
}
