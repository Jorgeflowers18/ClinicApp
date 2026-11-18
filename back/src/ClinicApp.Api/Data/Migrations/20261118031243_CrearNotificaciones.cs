using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearNotificaciones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notification_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    appointment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: false),
                    channel = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    recipient = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    message = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: false),
                    error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_logs", x => x.id);
                    table.CheckConstraint("ck_notification_logs_channel", "channel IN ('email', 'sms', 'whatsapp')");
                    table.CheckConstraint("ck_notification_logs_status", "status IN ('pendiente', 'enviada', 'fallida')");
                    table.CheckConstraint("ck_notification_logs_type", "type IN ('recordatorio_cita', 'confirmacion_cita', 'cancelacion_cita')");
                    table.ForeignKey(
                        name: "fk_notification_logs_appointments_appointment_id",
                        column: x => x.appointment_id,
                        principalTable: "appointments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notification_logs_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "notification_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_templates", x => x.id);
                    table.ForeignKey(
                        name: "fk_notification_templates_users_updated_by_user_id",
                        column: x => x.updated_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.InsertData(
                table: "notification_templates",
                columns: new[] { "id", "message", "updated_at", "updated_by_user_id" },
                values: new object[] { new Guid("00000000-0000-7000-8000-0000000000d1"), "Hola [nombre del cliente], te escribimos desde [nombre de la clínica] para recordarte tu cita del [fecha de la cita] a las [hora de la cita] con [profesional]. Si necesitas reprogramar, contáctanos con anticipación. ¡Te esperamos!", new DateTime(2026, 11, 17, 0, 0, 0, 0, DateTimeKind.Utc), null });

            migrationBuilder.CreateIndex(
                name: "ix_notification_logs_appointment_id_type",
                table: "notification_logs",
                columns: new[] { "appointment_id", "type" },
                unique: true,
                filter: "appointment_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_notification_logs_patient_id",
                table: "notification_logs",
                column: "patient_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_logs_sent_at",
                table: "notification_logs",
                column: "sent_at");

            migrationBuilder.CreateIndex(
                name: "ix_notification_logs_status_created_at",
                table: "notification_logs",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_templates_updated_by_user_id",
                table: "notification_templates",
                column: "updated_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification_logs");

            migrationBuilder.DropTable(
                name: "notification_templates");
        }
    }
}
