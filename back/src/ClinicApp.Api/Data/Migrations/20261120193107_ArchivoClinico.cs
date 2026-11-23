using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ArchivoClinico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "clinical_attachments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "category_id",
                table: "clinical_attachments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "clinical_type",
                table: "clinical_attachments",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "digest",
                table: "clinical_attachments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "display_name",
                table: "clinical_attachments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "encounter_id",
                table: "clinical_attachments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "exam_request_id",
                table: "clinical_attachments",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "metadata_updated_at",
                table: "clinical_attachments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "metadata_version",
                table: "clinical_attachments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "clinical_attachments",
                type: "character varying(3000)",
                maxLength: 3000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "professional_id",
                table: "clinical_attachments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "study_date",
                table: "clinical_attachments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "treatment_assignment_id",
                table: "clinical_attachments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "zone",
                table: "clinical_attachments",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "archive_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    archived_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_archive_categories", x => x.id);
                    table.CheckConstraint("ck_archive_categories_color", "color IN ('neutral', 'cyan', 'violet', 'amber', 'green')");
                });

            migrationBuilder.CreateTable(
                name: "archive_tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_archive_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "clinical_attachment_audit",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    attachment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    fields = table.Column<List<string>>(type: "text[]", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    actor_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clinical_attachment_audit", x => x.id);
                    table.CheckConstraint("ck_clinical_attachment_audit_action", "action IN ('adjuntar', 'editar', 'archivar', 'restaurar')");
                    table.ForeignKey(
                        name: "fk_clinical_attachment_audit_clinical_attachments_attachment_id",
                        column: x => x.attachment_id,
                        principalTable: "clinical_attachments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_clinical_attachment_audit_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "clinical_attachment_tags",
                columns: table => new
                {
                    attachment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clinical_attachment_tags", x => new { x.attachment_id, x.tag_id });
                    table.ForeignKey(
                        name: "fk_clinical_attachment_tags_archive_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "archive_tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_clinical_attachment_tags_clinical_attachments_attachment_id",
                        column: x => x.attachment_id,
                        principalTable: "clinical_attachments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_category_id",
                table: "clinical_attachments",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_encounter_id",
                table: "clinical_attachments",
                column: "encounter_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_patient_id_digest",
                table: "clinical_attachments",
                columns: new[] { "patient_id", "digest" });

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_professional_id",
                table: "clinical_attachments",
                column: "professional_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachments_treatment_assignment_id",
                table: "clinical_attachments",
                column: "treatment_assignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachment_audit_actor_user_id",
                table: "clinical_attachment_audit",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachment_audit_attachment_id_at",
                table: "clinical_attachment_audit",
                columns: new[] { "attachment_id", "at" });

            migrationBuilder.CreateIndex(
                name: "ix_clinical_attachment_tags_tag_id",
                table: "clinical_attachment_tags",
                column: "tag_id");

            migrationBuilder.AddForeignKey(
                name: "fk_clinical_attachments_archive_categories_category_id",
                table: "clinical_attachments",
                column: "category_id",
                principalTable: "archive_categories",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_clinical_attachments_clinical_encounters_encounter_id",
                table: "clinical_attachments",
                column: "encounter_id",
                principalTable: "clinical_encounters",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_clinical_attachments_professionals_professional_id",
                table: "clinical_attachments",
                column: "professional_id",
                principalTable: "professionals",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_clinical_attachments_treatment_assignments_treatment_assign",
                table: "clinical_attachments",
                column: "treatment_assignment_id",
                principalTable: "treatment_assignments",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_clinical_attachments_archive_categories_category_id",
                table: "clinical_attachments");

            migrationBuilder.DropForeignKey(
                name: "fk_clinical_attachments_clinical_encounters_encounter_id",
                table: "clinical_attachments");

            migrationBuilder.DropForeignKey(
                name: "fk_clinical_attachments_professionals_professional_id",
                table: "clinical_attachments");

            migrationBuilder.DropForeignKey(
                name: "fk_clinical_attachments_treatment_assignments_treatment_assign",
                table: "clinical_attachments");

            migrationBuilder.DropTable(
                name: "archive_categories");

            migrationBuilder.DropTable(
                name: "clinical_attachment_audit");

            migrationBuilder.DropTable(
                name: "clinical_attachment_tags");

            migrationBuilder.DropTable(
                name: "archive_tags");

            migrationBuilder.DropIndex(
                name: "ix_clinical_attachments_category_id",
                table: "clinical_attachments");

            migrationBuilder.DropIndex(
                name: "ix_clinical_attachments_encounter_id",
                table: "clinical_attachments");

            migrationBuilder.DropIndex(
                name: "ix_clinical_attachments_patient_id_digest",
                table: "clinical_attachments");

            migrationBuilder.DropIndex(
                name: "ix_clinical_attachments_professional_id",
                table: "clinical_attachments");

            migrationBuilder.DropIndex(
                name: "ix_clinical_attachments_treatment_assignment_id",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "category_id",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "clinical_type",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "digest",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "display_name",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "encounter_id",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "exam_request_id",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "metadata_updated_at",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "metadata_version",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "notes",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "professional_id",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "study_date",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "treatment_assignment_id",
                table: "clinical_attachments");

            migrationBuilder.DropColumn(
                name: "zone",
                table: "clinical_attachments");
        }
    }
}
