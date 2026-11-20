using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicApp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CrearInventario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    min_stock = table.Column<int>(type: "integer", nullable: false),
                    unit_cost = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    supplier = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    stock = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_items", x => x.id);
                    table.CheckConstraint("ck_inventory_items_kind", "kind IN ('consumible', 'instrumental')");
                    table.CheckConstraint("ck_inventory_items_min_stock", "min_stock >= 0");
                    table.CheckConstraint("ck_inventory_items_stock", "stock >= 0");
                    table.CheckConstraint("ck_inventory_items_unit_cost", "unit_cost >= 0");
                });

            migrationBuilder.CreateTable(
                name: "sterilization_cycles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    performed_at = table.Column<DateOnly>(type: "date", nullable: false),
                    result = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    responsible_professional_id = table.Column<Guid>(type: "uuid", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sterilization_cycles", x => x.id);
                    table.CheckConstraint("ck_sterilization_cycles_result", "result IN ('aprobado', 'fallido')");
                    table.ForeignKey(
                        name: "fk_sterilization_cycles_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "suppliers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    contact_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    address = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_suppliers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "treatment_consumptions",
                columns: table => new
                {
                    treatment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_treatment_consumptions", x => new { x.treatment_id, x.item_id });
                    table.CheckConstraint("ck_treatment_consumptions_quantity", "quantity >= 1");
                    table.ForeignKey(
                        name: "fk_treatment_consumptions_inventory_items_item_id",
                        column: x => x.item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_treatment_consumptions_treatments_treatment_id",
                        column: x => x.treatment_id,
                        principalTable: "treatments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sterilization_cycle_items",
                columns: table => new
                {
                    cycle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sterilization_cycle_items", x => new { x.cycle_id, x.item_id });
                    table.ForeignKey(
                        name: "fk_sterilization_cycle_items_inventory_items_item_id",
                        column: x => x.item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_sterilization_cycle_items_sterilization_cycles_cycle_id",
                        column: x => x.cycle_id,
                        principalTable: "sterilization_cycles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "purchase_orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    supplier_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_purchase_orders", x => x.id);
                    table.CheckConstraint("ck_purchase_orders_status", "status IN ('pendiente', 'recibida', 'cancelada')");
                    table.ForeignKey(
                        name: "fk_purchase_orders_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_purchase_orders_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "purchase_order_lines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    purchase_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_cost = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    expiration_date = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_purchase_order_lines", x => x.id);
                    table.CheckConstraint("ck_purchase_order_lines_quantity", "quantity >= 1");
                    table.CheckConstraint("ck_purchase_order_lines_unit_cost", "unit_cost >= 0");
                    table.ForeignKey(
                        name: "fk_purchase_order_lines_inventory_items_item_id",
                        column: x => x.item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_purchase_order_lines_purchase_orders_purchase_order_id",
                        column: x => x.purchase_order_id,
                        principalTable: "purchase_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_lots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    expiration_date = table.Column<DateOnly>(type: "date", nullable: true),
                    purchase_order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_lots", x => x.id);
                    table.CheckConstraint("ck_stock_lots_quantity", "quantity >= 0");
                    table.ForeignKey(
                        name: "fk_stock_lots_inventory_items_item_id",
                        column: x => x.item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_lots_purchase_orders_purchase_order_id",
                        column: x => x.purchase_order_id,
                        principalTable: "purchase_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stock_movements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    lot_id = table.Column<Guid>(type: "uuid", nullable: true),
                    purchase_order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    treatment_assignment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_movements", x => x.id);
                    table.CheckConstraint("ck_stock_movements_quantity", "quantity > 0");
                    table.CheckConstraint("ck_stock_movements_type", "type IN ('entrada', 'salida')");
                    table.ForeignKey(
                        name: "fk_stock_movements_inventory_items_item_id",
                        column: x => x.item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_movements_purchase_orders_purchase_order_id",
                        column: x => x.purchase_order_id,
                        principalTable: "purchase_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_movements_stock_lots_lot_id",
                        column: x => x.lot_id,
                        principalTable: "stock_lots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_movements_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_items_name",
                table: "inventory_items",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_order_lines_item_id",
                table: "purchase_order_lines",
                column: "item_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_order_lines_purchase_order_id",
                table: "purchase_order_lines",
                column: "purchase_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_orders_created_at",
                table: "purchase_orders",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_orders_created_by_user_id",
                table: "purchase_orders",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_orders_supplier_id",
                table: "purchase_orders",
                column: "supplier_id");

            migrationBuilder.CreateIndex(
                name: "ix_sterilization_cycle_items_item_id",
                table: "sterilization_cycle_items",
                column: "item_id");

            migrationBuilder.CreateIndex(
                name: "ix_sterilization_cycles_created_by_user_id",
                table: "sterilization_cycles",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_sterilization_cycles_performed_at",
                table: "sterilization_cycles",
                column: "performed_at");

            migrationBuilder.CreateIndex(
                name: "ix_stock_lots_item_id_expiration_date",
                table: "stock_lots",
                columns: new[] { "item_id", "expiration_date" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_lots_purchase_order_id",
                table: "stock_lots",
                column: "purchase_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_created_by_user_id",
                table: "stock_movements",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_item_id_created_at",
                table: "stock_movements",
                columns: new[] { "item_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_lot_id",
                table: "stock_movements",
                column: "lot_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_purchase_order_id",
                table: "stock_movements",
                column: "purchase_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_treatment_consumptions_item_id",
                table: "treatment_consumptions",
                column: "item_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "purchase_order_lines");

            migrationBuilder.DropTable(
                name: "sterilization_cycle_items");

            migrationBuilder.DropTable(
                name: "stock_movements");

            migrationBuilder.DropTable(
                name: "treatment_consumptions");

            migrationBuilder.DropTable(
                name: "sterilization_cycles");

            migrationBuilder.DropTable(
                name: "stock_lots");

            migrationBuilder.DropTable(
                name: "inventory_items");

            migrationBuilder.DropTable(
                name: "purchase_orders");

            migrationBuilder.DropTable(
                name: "suppliers");
        }
    }
}
