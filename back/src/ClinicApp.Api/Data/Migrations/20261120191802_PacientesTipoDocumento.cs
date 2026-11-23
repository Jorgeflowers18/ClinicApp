using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PacientesTipoDocumento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "document_type",
                table: "patients",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddCheckConstraint(
                name: "ck_patients_document_type",
                table: "patients",
                sql: "document_type IN ('', 'cedula', 'pasaporte', 'otro')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_patients_document_type",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "document_type",
                table: "patients");
        }
    }
}
