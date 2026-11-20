using ClinicApp.Api.Modules.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Institution;

/// <summary>
/// Perfil de la clínica. Tabla <c>institutions</c>, con <b>una sola fila</b> por ahora (una clínica).
/// Si se aprueba la multi-clínica (docs/plan-multiclinica.md, M1), esta misma tabla tendrá una fila por clínica.
/// </summary>
public class InstitutionProfile
{
    /// <summary>Id fijo de la única clínica.</summary>
    public static readonly Guid SingleId = Guid.Parse("00000000-0000-7000-8000-0000000000c1");

    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string LegalName { get; set; } = "";
    public string Ruc { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string Address { get; set; } = "";
    public string Website { get; set; } = "";
    public string LogoText { get; set; } = "";

    /// <summary>Logo como data URL (PNG, JPG o WebP de hasta ~500 KB), o null.</summary>
    public string? LogoImage { get; set; }

    public string Notes { get; set; } = "";
    public string Hours { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }

    public List<InstitutionBranch> Branches { get; set; } = [];
}

/// <summary>Sede de la clínica. Tabla <c>institution_branches</c>.</summary>
public class InstitutionBranch
{
    /// <summary>UUID v7 que genera el servidor al crear la sede.</summary>
    public Guid Id { get; set; }

    public Guid InstitutionId { get; set; }

    /// <summary>Orden en la pantalla. También da el número de "Sede N" cuando la sede no tiene nombre.</summary>
    public int Position { get; set; }

    /// <summary>Opcional: si está vacío se muestra "Sede N" (lo calcula <see cref="InstitutionBranchDto"/>).</summary>
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Hours { get; set; } = "";
    public bool IsMain { get; set; }
}

public class InstitutionProfileConfiguration : IEntityTypeConfiguration<InstitutionProfile>
{
    public void Configure(EntityTypeBuilder<InstitutionProfile> builder)
    {
        builder.ToTable("institutions", table =>
            table.HasCheckConstraint("ck_institutions_ruc", "ruc = '' OR ruc ~ '^[0-9]{13}$'"));

        builder.Property(profile => profile.Name).HasMaxLength(160);
        builder.Property(profile => profile.LegalName).HasMaxLength(200);
        builder.Property(profile => profile.Ruc).HasMaxLength(13);
        builder.Property(profile => profile.Phone).HasMaxLength(30);
        builder.Property(profile => profile.Email).HasMaxLength(254);
        builder.Property(profile => profile.Address).HasMaxLength(250);
        builder.Property(profile => profile.Website).HasMaxLength(200);
        builder.Property(profile => profile.LogoText).HasMaxLength(10);
        builder.Property(profile => profile.LogoImage).HasColumnType("text");
        builder.Property(profile => profile.Notes).HasMaxLength(1000);
        builder.Property(profile => profile.Hours).HasMaxLength(500);

        builder.HasOne<User>().WithMany().HasForeignKey(profile => profile.UpdatedByUserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(profile => profile.Branches).WithOne().HasForeignKey(branch => branch.InstitutionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class InstitutionBranchConfiguration : IEntityTypeConfiguration<InstitutionBranch>
{
    public void Configure(EntityTypeBuilder<InstitutionBranch> builder)
    {
        builder.ToTable("institution_branches");
        builder.HasKey(branch => branch.Id);
        builder.Property(branch => branch.Id).ValueGeneratedNever();

        builder.Property(branch => branch.Name).HasMaxLength(120);
        builder.Property(branch => branch.Address).HasMaxLength(250);
        builder.Property(branch => branch.Phone).HasMaxLength(30);
        builder.Property(branch => branch.Hours).HasMaxLength(500);

        // Como máximo una sede principal por clínica.
        builder.HasIndex(branch => branch.InstitutionId).IsUnique().HasFilter("is_main").HasDatabaseName("ix_institution_branches_main");
    }
}
