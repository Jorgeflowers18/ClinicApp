using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearCitas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "appointments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_id = table.Column<Guid>(type: "uuid", nullable: false),
                    treatment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    room_id = table.Column<Guid>(type: "uuid", nullable: true),
                    start = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status_changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status_changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_appointments", x => x.id);
                    table.CheckConstraint("ck_appointments_range", "\"end\" > start");
                    table.CheckConstraint("ck_appointments_status", "status IN ('programada', 'confirmada', 'cancelada', 'completada', 'no_asistio')");
                    table.ForeignKey(
                        name: "fk_appointments_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_appointments_professionals_professional_id",
                        column: x => x.professional_id,
                        principalTable: "professionals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_appointments_rooms_room_id",
                        column: x => x.room_id,
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_appointments_treatments_treatment_id",
                        column: x => x.treatment_id,
                        principalTable: "treatments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_appointments_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_appointments_users_status_changed_by_user_id",
                        column: x => x.status_changed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "schedule_blocks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_id = table.Column<Guid>(type: "uuid", nullable: true),
                    room_id = table.Column<Guid>(type: "uuid", nullable: true),
                    start = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_schedule_blocks", x => x.id);
                    table.CheckConstraint("ck_schedule_blocks_range", "\"end\" > start");
                    table.CheckConstraint("ck_schedule_blocks_target", "professional_id IS NOT NULL OR room_id IS NOT NULL");
                    table.ForeignKey(
                        name: "fk_schedule_blocks_professionals_professional_id",
                        column: x => x.professional_id,
                        principalTable: "professionals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_schedule_blocks_rooms_room_id",
                        column: x => x.room_id,
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_schedule_blocks_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_appointments_created_by_user_id",
                table: "appointments",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_appointments_patient_id_start",
                table: "appointments",
                columns: new[] { "patient_id", "start" });

            migrationBuilder.CreateIndex(
                name: "ix_appointments_professional_id_start",
                table: "appointments",
                columns: new[] { "professional_id", "start" });

            migrationBuilder.CreateIndex(
                name: "ix_appointments_room_id_start",
                table: "appointments",
                columns: new[] { "room_id", "start" });

            migrationBuilder.CreateIndex(
                name: "ix_appointments_start",
                table: "appointments",
                column: "start");

            migrationBuilder.CreateIndex(
                name: "ix_appointments_status_changed_by_user_id",
                table: "appointments",
                column: "status_changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_appointments_treatment_id",
                table: "appointments",
                column: "treatment_id");

            migrationBuilder.CreateIndex(
                name: "ix_schedule_blocks_created_by_user_id",
                table: "schedule_blocks",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_schedule_blocks_professional_id",
                table: "schedule_blocks",
                column: "professional_id");

            migrationBuilder.CreateIndex(
                name: "ix_schedule_blocks_room_id",
                table: "schedule_blocks",
                column: "room_id");

            migrationBuilder.CreateIndex(
                name: "ix_schedule_blocks_start",
                table: "schedule_blocks",
                column: "start");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "appointments");

            migrationBuilder.DropTable(
                name: "schedule_blocks");
        }
    }
}
