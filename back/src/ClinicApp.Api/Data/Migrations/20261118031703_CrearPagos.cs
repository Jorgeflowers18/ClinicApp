using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearPagos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "financial_payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    treatment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    observations = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    void_reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    registered_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    voided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    voided_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_financial_payments", x => x.id);
                    table.CheckConstraint("ck_financial_payments_amount", "amount > 0");
                    table.CheckConstraint("ck_financial_payments_method", "method IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'deposito', 'cheque', 'otros')");
                    table.CheckConstraint("ck_financial_payments_status", "status IN ('registrado', 'anulado', 'reversado')");
                    table.ForeignKey(
                        name: "fk_financial_payments_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_financial_payments_treatments_treatment_id",
                        column: x => x.treatment_id,
                        principalTable: "treatments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_financial_payments_users_registered_by_user_id",
                        column: x => x.registered_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_financial_payments_users_voided_by_user_id",
                        column: x => x.voided_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_financial_payments_date",
                table: "financial_payments",
                column: "date");

            migrationBuilder.CreateIndex(
                name: "ix_financial_payments_patient_id_treatment_id",
                table: "financial_payments",
                columns: new[] { "patient_id", "treatment_id" });

            migrationBuilder.CreateIndex(
                name: "ix_financial_payments_registered_by_user_id",
                table: "financial_payments",
                column: "registered_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_financial_payments_treatment_id",
                table: "financial_payments",
                column: "treatment_id");

            migrationBuilder.CreateIndex(
                name: "ix_financial_payments_voided_by_user_id",
                table: "financial_payments",
                column: "voided_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "financial_payments");
        }
    }
}
