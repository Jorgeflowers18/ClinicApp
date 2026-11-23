namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Archivos de la historia clínica en el disco del servidor.
///
/// <list type="bullet">
/// <item><b>Carpeta raíz:</b> <c>Attachments:RootPath</c> (en producción <c>/var/lib/clinicapp/attachments</c>,
/// fuera de la carpeta de la app y dentro de los respaldos; en desarrollo <c>App_Data/attachments</c>).</item>
/// <item><b>Ruta:</b> <c>{patientId}/{attachmentId}.{ext}</c>. El nombre lo genera el servidor; el del usuario
/// (alias) queda en la base.</item>
/// <item><b>Tipo:</b> lo decide el servidor por los primeros bytes del archivo, no por su extensión.</item>
/// <item><b>Escritura segura:</b> mientras se recibe se llama <c>.tmp</c> y se renombra al terminar.</item>
/// </list>
/// </summary>
public class AttachmentStorage
{
    public const long MaxSize = 20 * 1024 * 1024;

    private readonly string _root;

    public AttachmentStorage(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configured = configuration["Attachments:RootPath"];
        _root = Path.GetFullPath(string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, "App_Data", "attachments")
            : Path.IsPathRooted(configured) ? configured : Path.Combine(environment.ContentRootPath, configured));
    }

    /// <summary>Tipos aceptados y su extensión en disco.</summary>
    public static readonly IReadOnlyDictionary<string, string> Extensions = new Dictionary<string, string>
    {
        ["image/jpeg"] = "jpg",
        ["image/png"] = "png",
        ["image/webp"] = "webp",
        ["application/pdf"] = "pdf",
    };

    /// <summary>
    /// Reconoce el tipo por los primeros bytes: FF D8 FF = JPG, 89 50 4E 47 = PNG, RIFF....WEBP = WebP,
    /// %PDF- = PDF. Cualquier otra cosa (por ejemplo, un .txt renombrado a .png) devuelve null.
    /// </summary>
    public static string? DetectMime(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return "image/jpeg";
        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return "image/png";
        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8)) return "image/webp";
        if (header.Length >= 5 && header[..5].SequenceEqual("%PDF-"u8)) return "application/pdf";
        return null;
    }

    /// <summary>Nombre del usuario, limpio: sin carpetas, sin caracteres de control y de hasta 255 caracteres.</summary>
    public static string CleanAlias(string? fileName)
    {
        var name = Path.GetFileName((fileName ?? "").Replace('\\', '/'));
        name = new string(name.Where(character => !char.IsControl(character)).ToArray()).Trim();
        if (name.Length == 0) name = "archivo";
        return name.Length <= 255 ? name : name[..255];
    }

    /// <summary>
    /// Guarda el archivo y devuelve su ruta relativa y su tipo, o null si el contenido no es JPG, PNG, WebP
    /// o PDF. El tamaño ya viene controlado por el límite del formulario.
    /// </summary>
    public async Task<(string StoragePath, string Mime)?> SaveAsync(Guid patientId, Guid attachmentId, Stream content, CancellationToken cancellationToken)
    {
        var header = new byte[12];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        var mime = DetectMime(header.AsSpan(0, read));
        if (mime is null) return null;

        var relative = $"{patientId}/{attachmentId}.{Extensions[mime]}";
        var final = FullPath(relative);
        var temporary = Path.ChangeExtension(final, ".tmp");
        Directory.CreateDirectory(Path.GetDirectoryName(final)!);

        await using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            await file.WriteAsync(header.AsMemory(0, read), cancellationToken);
            await content.CopyToAsync(file, cancellationToken);
        }
        File.Move(temporary, final);

        return (relative, mime);
    }

    /// <summary>Ruta completa en disco. Comprueba que quede dentro de la carpeta raíz.</summary>
    public string FullPath(string storagePath)
    {
        var full = Path.GetFullPath(Path.Combine(_root, storagePath));
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new InvalidOperationException("Ruta de adjunto fuera de la carpeta raíz.");
        return full;
    }

    public bool Exists(string storagePath) => File.Exists(FullPath(storagePath));

    /// <summary>SHA-256 del archivo guardado, en hexadecimal minúscula (como el que calcula el frontend).</summary>
    public async Task<string> DigestAsync(string storagePath, CancellationToken cancellationToken)
    {
        await using var file = new FileStream(FullPath(storagePath), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Convert.ToHexStringLower(await System.Security.Cryptography.SHA256.HashDataAsync(file, cancellationToken));
    }

    /// <summary>Borra el archivo si existe. Devuelve false si no se pudo.</summary>
    public bool TryDelete(string storagePath, out Exception? error)
    {
        error = null;
        try
        {
            var path = FullPath(storagePath);
            if (File.Exists(path)) File.Delete(path);
            return true;
        }
        catch (Exception exception)
        {
            error = exception;
            return false;
        }
    }
}
