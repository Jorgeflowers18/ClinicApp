using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearProfesionalesYConsultorios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "professionals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    specialty = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    registration_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_professionals", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "rooms",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rooms", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_users_professional_id",
                table: "users",
                column: "professional_id",
                unique: true,
                filter: "professional_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_sterilization_cycles_responsible_professional_id",
                table: "sterilization_cycles",
                column: "responsible_professional_id");

            migrationBuilder.CreateIndex(
                name: "ix_professionals_name",
                table: "professionals",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "ix_rooms_name_active",
                table: "rooms",
                column: "name",
                unique: true,
                filter: "active");

            // Datos existentes, antes de crear las llaves foráneas:
            // 1) Los ciclos de esterilización cuyo responsable no existe (antes no se validaba) pasan a un
            //    profesional inactivo "Responsable no registrado", para no perder el ciclo.
            // 2) Los usuarios con un profesional inexistente quedan sin profesional.
            migrationBuilder.Sql("""
                INSERT INTO professionals (id, name, specialty, registration_number, active, created_at)
                SELECT '00000000-0000-7000-8000-000000000001', 'Responsable no registrado', 'Sin especialidad', '', false, now()
                WHERE EXISTS (SELECT 1 FROM sterilization_cycles);

                UPDATE sterilization_cycles
                SET responsible_professional_id = '00000000-0000-7000-8000-000000000001'
                WHERE responsible_professional_id NOT IN (SELECT id FROM professionals);

                DELETE FROM professionals
                WHERE id = '00000000-0000-7000-8000-000000000001'
                  AND NOT EXISTS (SELECT 1 FROM sterilization_cycles WHERE responsible_professional_id = '00000000-0000-7000-8000-000000000001');

                UPDATE users SET professional_id = NULL
                WHERE professional_id IS NOT NULL AND professional_id NOT IN (SELECT id FROM professionals);
                """);

            migrationBuilder.AddForeignKey(
                name: "fk_sterilization_cycles_professionals_responsible_professional",
                table: "sterilization_cycles",
                column: "responsible_professional_id",
                principalTable: "professionals",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_users_professionals_professional_id",
                table: "users",
                column: "professional_id",
                principalTable: "professionals",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_sterilization_cycles_professionals_responsible_professional",
                table: "sterilization_cycles");

            migrationBuilder.DropForeignKey(
                name: "fk_users_professionals_professional_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "professionals");

            migrationBuilder.DropTable(
                name: "rooms");

            migrationBuilder.DropIndex(
                name: "ix_users_professional_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "ix_sterilization_cycles_responsible_professional_id",
                table: "sterilization_cycles");
        }
    }
}
