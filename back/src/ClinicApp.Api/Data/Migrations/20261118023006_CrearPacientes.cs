using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearPacientes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,");

            migrationBuilder.CreateSequence<int>(
                name: "patient_record_number_seq");

            migrationBuilder.CreateTable(
                name: "patients",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    record_number = table.Column<int>(type: "integer", nullable: false, defaultValueSql: "nextval('patient_record_number_seq')"),
                    first_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    last_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    document_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: true),
                    gender = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    marital_status = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    occupation = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    company = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    nationality = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    address = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    city = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    notifications_enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    emergency_contact_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    emergency_contact_relationship = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    emergency_contact_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    insurance_provider = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    insurance_policy = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    consent_signed = table.Column<bool>(type: "boolean", nullable: false),
                    treatment_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    last_visit_at = table.Column<DateOnly>(type: "date", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_patients", x => x.id);
                    table.CheckConstraint("ck_patients_gender", "gender IN ('femenino', 'masculino', 'otro')");
                    table.CheckConstraint("ck_patients_marital_status", "marital_status IN ('', 'soltero', 'casado', 'union_libre', 'divorciado', 'viudo')");
                    table.CheckConstraint("ck_patients_treatment_status", "treatment_status IN ('activo', 'en seguimiento', 'pendiente', 'inactivo')");
                    table.ForeignKey(
                        name: "fk_patients_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_patients_users_deleted_by_user_id",
                        column: x => x.deleted_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_patients_users_updated_by_user_id",
                        column: x => x.updated_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_patient_id",
                table: "stock_movements",
                column: "patient_id");

            migrationBuilder.CreateIndex(
                name: "ix_patients_created_at",
                table: "patients",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_patients_created_by_user_id",
                table: "patients",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_patients_deleted_at",
                table: "patients",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "ix_patients_deleted_by_user_id",
                table: "patients",
                column: "deleted_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_patients_document_id",
                table: "patients",
                column: "document_id");

            migrationBuilder.CreateIndex(
                name: "ix_patients_record_number",
                table: "patients",
                column: "record_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_patients_updated_by_user_id",
                table: "patients",
                column: "updated_by_user_id");

            migrationBuilder.AddForeignKey(
                name: "fk_stock_movements_patients_patient_id",
                table: "stock_movements",
                column: "patient_id",
                principalTable: "patients",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_stock_movements_patients_patient_id",
                table: "stock_movements");

            migrationBuilder.DropTable(
                name: "patients");

            migrationBuilder.DropIndex(
                name: "ix_stock_movements_patient_id",
                table: "stock_movements");

            migrationBuilder.DropSequence(
                name: "patient_record_number_seq");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,");
        }
    }
}
