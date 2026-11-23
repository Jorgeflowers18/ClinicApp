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
        ["subtitle"] = "Odontología integral",
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

    /// <summary>Sede para el PUT: <paramref name="id"/> null es una sede nueva.</summary>
    private static object Branch(string? id, string name, bool isMain = false) =>
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

        // Las sedes nuevas van sin id: el servidor les da un UUID.
        var saved = await admin.PutJson("/api/institution/profile",
            Body(Branch(null, "Matriz", isMain: true), Branch("", "Norte")), HttpStatusCode.OK);
        Assert.Equal("contacto@sonrisas.ec", saved.Str("email"));
        Assert.Equal("Odontología integral", saved.Str("subtitle"));
        var created = saved!["branches"]!.AsArray();
        Assert.Equal(["Matriz", "Norte"], created.Select(branch => branch.Str("name")));
        Assert.All(created, branch => Assert.True(Guid.TryParse(branch.Str("id"), out _)));
        var matrizId = created[0].Str("id");
        var norteId = created[1].Str("id");

        // La principal pasa a "Norte", se reordena, se quita la matriz y se agrega otra.
        var changed = await admin.PutJson("/api/institution/profile",
            Body(Branch(null, "Sur"), Branch(norteId, "Norte", isMain: true)), HttpStatusCode.OK);
        var branches = changed!["branches"]!.AsArray();
        Assert.Equal(["Sur", "Norte"], branches.Select(branch => branch.Str("name")));
        Assert.Equal(norteId, branches[1].Str("id"));       // la que se actualizó conserva su id
        Assert.NotEqual(matrizId, branches[0].Str("id"));
        Assert.True(branches[1]!["isMain"]!.GetValue<bool>());

        var read = await admin.GetJson("/api/institution/profile");
        Assert.Equal(2, read!["branches"]!.AsArray().Count);
    }

    [Fact]
    public async Task Sede_sin_nombre_se_muestra_como_Sede_N_segun_su_lugar()
    {
        var admin = await api.As("admin");

        var saved = await admin.PutJson("/api/institution/profile",
            Body(Branch(null, "Matriz"), Branch(null, ""), Branch(null, "  ")), HttpStatusCode.OK);
        var branches = saved!["branches"]!.AsArray();
        Assert.Equal(["Matriz", "Sede 2", "Sede 3"], branches.Select(branch => branch.Str("label")));
        Assert.Equal("", branches[1].Str("name"));

        // Se calcula al leer: al quitar la primera, la que era "Sede 3" pasa a ser "Sede 2". Con nombre, se usa el nombre.
        var changed = await admin.PutJson("/api/institution/profile",
            Body(Branch(branches[1].Str("id"), "Norte"), Branch(branches[2].Str("id"), "")), HttpStatusCode.OK);
        Assert.Equal(["Norte", "Sede 2"], changed!["branches"]!.AsArray().Select(branch => branch.Str("label")));
    }

    [Fact]
    public async Task Ids_de_sede_invalidos_repetidos_o_ajenos_dan_400()
    {
        var admin = await api.As("admin");
        var saved = await admin.PutJson("/api/institution/profile", Body(Branch(null, "Matriz")), HttpStatusCode.OK);
        var id = saved!["branches"]![0].Str("id");

        var notUuid = await admin.PutJson("/api/institution/profile", Body(Branch("branch-1", "Matriz")), HttpStatusCode.BadRequest);
        Assert.True(notUuid.HasError("branches[0].id"));

        var repeated = await admin.PutJson("/api/institution/profile", Body(Branch(id, "A"), Branch(id, "B")), HttpStatusCode.BadRequest);
        Assert.True(repeated.HasError("branches[1].id"));

        var unknown = await admin.PutJson("/api/institution/profile",
            Body(Branch(id, "Matriz"), Branch(Guid.CreateVersion7().ToString(), "Otra")), HttpStatusCode.BadRequest);
        Assert.True(unknown.HasError("branches[1].id"));

        // El 400 no cambió nada: la sede sigue igual.
        var read = await admin.GetJson("/api/institution/profile");
        Assert.Equal([id], read!["branches"]!.AsArray().Select(branch => branch.Str("id")));
    }

    [Theory]
    [InlineData("ruc", "123456789012")]
    [InlineData("ruc", "17987654320AB")]
    [InlineData("email", "no-es-correo")]
    [InlineData("website", "sonrisas.ec")]
    [InlineData("logoImage", "data:image/svg+xml;base64,PHN2Zz4=")]
    [InlineData("logoImage", "https://otro.com/logo.png")]
    [InlineData("name", "")]
    [InlineData("subtitle", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")]
    public async Task Validacion_del_perfil(string field, string value)
    {
        var admin = await api.As("admin");
        var body = Body();
        body[field] = value;

        var error = await admin.PutJson("/api/institution/profile", body, HttpStatusCode.BadRequest);

        Assert.True(error.HasError(field), $"Se esperaba un error en {field}: {error}");
    }

    [Fact]
    public async Task Dos_sedes_principales_o_nombre_largo_dan_400()
    {
        var admin = await api.As("admin");

        var twoMain = await admin.PutJson("/api/institution/profile",
            Body(Branch(null, "Uno", isMain: true), Branch(null, "Dos", isMain: true)), HttpStatusCode.BadRequest);
        Assert.True(twoMain.HasError("branches"));

        var longName = await admin.PutJson("/api/institution/profile", Body(Branch(null, new string('x', 121))), HttpStatusCode.BadRequest);
        Assert.True(longName.HasError("branches[0].name"));
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

        Assert.Equal(["name", "subtitle", "logoText", "logoImage"], body.Select(property => property.Key));
        Assert.Equal("Odontología integral", body.Str("subtitle"));
        Assert.Equal("Clínica Sonrisas", body.Str("name"));
    }
}
