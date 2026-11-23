using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RefreshTokenPersistent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // "Recordarme" (plan 12, punto 3.1). Las sesiones ya abiertas usaban cookie persistente: quedan en true.
            // La API siempre escribe el valor al crear un token, así que este default solo afecta a esas filas.
            migrationBuilder.AddColumn<bool>(
                name: "persistent",
                table: "refresh_tokens",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "persistent",
                table: "refresh_tokens");
        }
    }
}
