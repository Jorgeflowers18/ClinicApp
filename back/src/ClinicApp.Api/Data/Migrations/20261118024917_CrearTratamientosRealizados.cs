using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearTratamientosRealizados : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "treatment_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    treatment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    total_sessions = table.Column<int>(type: "integer", nullable: false),
                    completed_sessions = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    tooth = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    source_encounter_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    professional_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_treatment_assignments", x => x.id);
                    table.CheckConstraint("ck_treatment_assignments_price", "price IS NULL OR price >= 0");
                    table.CheckConstraint("ck_treatment_assignments_sessions", "total_sessions >= 1 AND completed_sessions >= 0 AND completed_sessions <= total_sessions");
                    table.CheckConstraint("ck_treatment_assignments_status", "status IN ('en_progreso', 'completado', 'suspendido')");
                    table.ForeignKey(
                        name: "fk_treatment_assignments_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_treatment_assignments_professionals_professional_id",
                        column: x => x.professional_id,
                        principalTable: "professionals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_treatment_assignments_treatments_treatment_id",
                        column: x => x.treatment_id,
                        principalTable: "treatments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_treatment_assignments_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_treatment_assignment_id",
                table: "stock_movements",
                column: "treatment_assignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_treatment_assignments_created_by_user_id",
                table: "treatment_assignments",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_treatment_assignments_patient_id_start_date",
                table: "treatment_assignments",
                columns: new[] { "patient_id", "start_date" });

            migrationBuilder.CreateIndex(
                name: "ix_treatment_assignments_professional_id",
                table: "treatment_assignments",
                column: "professional_id");

            migrationBuilder.CreateIndex(
                name: "ix_treatment_assignments_source_key",
                table: "treatment_assignments",
                column: "source_key",
                unique: true,
                filter: "source_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_treatment_assignments_treatment_id_start_date",
                table: "treatment_assignments",
                columns: new[] { "treatment_id", "start_date" });

            migrationBuilder.AddForeignKey(
                name: "fk_stock_movements_treatment_assignments_treatment_assignment_",
                table: "stock_movements",
                column: "treatment_assignment_id",
                principalTable: "treatment_assignments",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_stock_movements_treatment_assignments_treatment_assignment_",
                table: "stock_movements");

            migrationBuilder.DropTable(
                name: "treatment_assignments");

            migrationBuilder.DropIndex(
                name: "ix_stock_movements_treatment_assignment_id",
                table: "stock_movements");
        }
    }
}
