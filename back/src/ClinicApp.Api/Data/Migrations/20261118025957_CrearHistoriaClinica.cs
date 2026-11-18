using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearHistoriaClinica : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "clinical_attachments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    alias = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    mime = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    size = table.Column<long>(type: "bigint", nullable: false),
                    storage_path = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    linked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    removed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    purged_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    uploaded_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clinical_attachments", x => x.id);
                    table.CheckConstraint("ck_clinical_attachments_kind", "kind IN ('radiografia_periapical', 'bitewing', 'panoramica', 'cbct', 'fotografias', 'modelos', 'pruebas_pulpares', 'laboratorio', 'interconsulta', 'biopsia', 'consentimiento', 'otro')");
                    table.CheckConstraint("ck_clinical_attachments_mime", "mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')");
                    table.CheckConstraint("ck_clinical_attachments_size", "size BETWEEN 1 AND 20971520");
                    table.ForeignKey(
                        name: "fk_clinical_attachments_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_clinical_attachments_users_uploaded_by_user_id",
                        column: x => x.uploaded_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "clinical_encounters",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    professional_id = table.Column<Guid>(type: "uuid", nullable: false),
                    legacy_professional_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    appointment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    present_illness = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    vitals = table.Column<string>(type: "jsonb", nullable: false),
                    asa = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    risk_assessment = table.Column<string>(type: "jsonb", nullable: false),
                    extraoral_exam = table.Column<string>(type: "jsonb", nullable: false),
                    intraoral_exam = table.Column<string>(type: "jsonb", nullable: false),
                    pain = table.Column<string>(type: "jsonb", nullable: false),
                    caries_risk = table.Column<string>(type: "jsonb", nullable: false),
                    periodontal_risk = table.Column<string>(type: "jsonb", nullable: false),
                    diagnoses = table.Column<string>(type: "jsonb", nullable: false),
                    diagnosis_summary = table.Column<string>(type: "text", nullable: false),
                    prognosis = table.Column<string>(type: "jsonb", nullable: false),
                    periodontal_diagnosis = table.Column<string>(type: "jsonb", nullable: false),
                    maintenance_interval = table.Column<string>(type: "jsonb", nullable: false),
                    procedures = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    materials = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    requested_exams = table.Column<string>(type: "jsonb", nullable: false),
                    exam_findings = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    evolution = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    next_visit = table.Column<DateOnly>(type: "date", nullable: true),
                    performed_treatments = table.Column<string>(type: "jsonb", nullable: false),
                    chart_snapshot = table.Column<string>(type: "jsonb", nullable: true),
                    clinical_snapshot = table.Column<string>(type: "jsonb", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clinical_encounters", x => x.id);
                    table.CheckConstraint("ck_clinical_encounters_asa", "asa IN ('', 'I', 'II', 'III', 'IV')");
                    table.ForeignKey(
                        name: "fk_clinical_encounters_appointments_appointment_id",
                        column: x => x.appointment_id,
                        principalTable: "appointments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_clinical_encounters_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_clinical_encounters_professionals_professional_id",
                        column: x => x.professional_id,
                        principalTable: "professionals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_clinical_encounters_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "clinical_records",
                columns: table => new
                {
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    revision = table.Column<int>(type: "integer", nullable: false),
                    chart = table.Column<string>(type: "jsonb", nullable: true),
                    medical_background = table.Column<string>(type: "jsonb", nullable: false),
                    allergies_and_medication = table.Column<string>(type: "jsonb", nullable: false),
                    habits = table.Column<string>(type: "jsonb", nullable: false),
                    dental_background = table.Column<string>(type: "jsonb", nullable: false),
                    periodontal_background = table.Column<string>(type: "jsonb", nullable: false),
                    plan = table.Column<string>(type: "jsonb", nullable: false),
                    data_consent = table.Column<string>(type: "jsonb", nullable: false),
                    truth_declaration = table.Column<string>(type: "jsonb", nullable: false),
                    exam_requests = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clinical_records", x => x.patient_id);
                    table.ForeignKey(
                        name: "fk_clinical_records_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_clinical_records_users_updated_by_user_id",
                        column: x => x.updated_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "encounter_notes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    encounter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    author_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    author_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_encounter_notes", x => x.id);
                    table.ForeignKey(
                        name: "fk_encounter_notes_clinical_encounters_encounter_id",
                        column: x => x.encounter_id,
                        principalTable: "clinical_encounters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_encounter_notes_users_author_user_id",
                        column: x => x.author_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "clinical_record_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    revision = table.Column<int>(type: "integer", nullable: false),
                    data = table.Column<string>(type: "jsonb", nullable: true),
                    saved_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    saved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clinical_record_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_clinical_record_versions_clinical_records_patient_id",
                        column: x => x.patient_id,
                        principalTable: "clinical_records",
                        principalColumn: "patient_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_clinical_record_versions_users_saved_by_user_id",
                        column: x => x.saved_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_linked_at_created_at",
                table: "clinical_attachments",
                columns: new[] { "linked_at", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_patient_id",
                table: "clinical_attachments",
                column: "patient_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_uploaded_by_user_id",
                table: "clinical_attachments",
                column: "uploaded_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_encounters_appointment_id",
                table: "clinical_encounters",
                column: "appointment_id",
                unique: true,
                filter: "appointment_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_encounters_created_by_user_id",
                table: "clinical_encounters",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_encounters_date",
                table: "clinical_encounters",
                column: "date");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_encounters_patient_id_date",
                table: "clinical_encounters",
                columns: new[] { "patient_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_clinical_encounters_professional_id",
                table: "clinical_encounters",
                column: "professional_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_record_versions_patient_id_revision",
                table: "clinical_record_versions",
                columns: new[] { "patient_id", "revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_clinical_record_versions_saved_by_user_id",
                table: "clinical_record_versions",
                column: "saved_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_records_updated_by_user_id",
                table: "clinical_records",
                column: "updated_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_encounter_notes_author_user_id",
                table: "encounter_notes",
                column: "author_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_encounter_notes_encounter_id",
                table: "encounter_notes",
                column: "encounter_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "clinical_attachments");

            migrationBuilder.DropTable(
                name: "clinical_record_versions");

            migrationBuilder.DropTable(
                name: "encounter_notes");

            migrationBuilder.DropTable(
                name: "clinical_records");

            migrationBuilder.DropTable(
                name: "clinical_encounters");
        }
    }
}
