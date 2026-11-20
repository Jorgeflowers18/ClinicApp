using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <summary>
    /// El id de las sedes pasa de texto generado por el frontend ("branch-1731…") a UUID generado por el servidor.
    /// Las sedes que ya existen y no tienen un UUID reciben uno nuevo.
    /// </summary>
    public partial class SedesConUuid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "pk_institution_branches",
                table: "institution_branches");

            migrationBuilder.Sql("""
                ALTER TABLE institution_branches ALTER COLUMN id TYPE uuid USING (
                    CASE WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         THEN id::uuid ELSE gen_random_uuid() END);
                """);

            migrationBuilder.AddPrimaryKey(
                name: "pk_institution_branches",
                table: "institution_branches",
                column: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "pk_institution_branches",
                table: "institution_branches");

            migrationBuilder.AlterColumn<string>(
                name: "id",
                table: "institution_branches",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddPrimaryKey(
                name: "pk_institution_branches",
                table: "institution_branches",
                columns: new[] { "institution_id", "id" });
        }
    }
}
