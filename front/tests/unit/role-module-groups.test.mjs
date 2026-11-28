import { test } from "node:test"
import assert from "node:assert/strict"
import { navigationSections } from "../../src/app/nav-config.ts"
import { groupRoleModules, enabledModuleCount, editableRoleModuleIds, updateRoleModuleSelection } from "../../src/modules/saas/lib/role-module-groups.ts"

test("every real navigation module belongs to exactly one of the three role groups", () => {
  const groups = groupRoleModules(navigationSections)
  assert.deepEqual(groups.map(group => group.id), ["clinical", "operations", "configuration"])
  assert.deepEqual(groups.map(group => group.modules.length), [4, 5, 3])
  const ids = groups.flatMap(group => group.modules.map(module => module.id))
  assert.equal(new Set(ids).size, navigationSections.length)
  assert.deepEqual([...ids].sort(), navigationSections.map(module => module.id).sort())
})
test("role counters ignore unknown and repeated grants without changing the saved selection", () => {
  const selected = ["Pacientes", "Pacientes", "Citas", "not-a-module"]
  assert.equal(enabledModuleCount(navigationSections, selected), 2)
  assert.equal(selected.length, 4)
})
test("category counts reflect the selected modules rather than a fixed total", () => {
  const groups = groupRoleModules(navigationSections)
  const selected = ["Pacientes", "Citas", "Finanzas", "Administración"]
  assert.deepEqual(groups.map(group => enabledModuleCount(group.modules, selected)), [2, 1, 1])
  assert.equal(enabledModuleCount(navigationSections, selected), 4)
})
test("grouping retains original permission IDs and does not mutate the catalog", () => {
  const before = structuredClone(navigationSections)
  groupRoleModules(navigationSections)
  assert.deepEqual(navigationSections, before)
  assert.ok(groupRoleModules(navigationSections)[2].modules.some(module => module.id === "Personal y accesos" && module.label === "Accesos"))
})

test("bulk operations use the real catalog and remain idempotent without mutating the draft", () => {
  const original = ["Pacientes"]
  const editable = editableRoleModuleIds(navigationSections)
  const enabled = updateRoleModuleSelection(original, editable, true)
  assert.deepEqual(new Set(enabled), new Set(navigationSections.map(module => module.id)))
  assert.deepEqual(updateRoleModuleSelection(enabled, editable, true), enabled)
  assert.deepEqual(updateRoleModuleSelection(enabled, editable, false), [])
  assert.deepEqual(original, ["Pacientes"])
})

test("group selection preserves grants in the other categories", () => {
  const group = groupRoleModules(navigationSections)[0]
  const editable = editableRoleModuleIds(group.modules)
  const enabled = updateRoleModuleSelection(["Finanzas", "Administración"], editable, true)
  assert.equal(enabledModuleCount(group.modules, enabled), group.modules.length)
  assert.deepEqual(updateRoleModuleSelection(enabled, editable, false), ["Finanzas", "Administración"])
})

test("protected administrative grants survive clear-all and clear-group", () => {
  const selected = navigationSections.map(module => module.id)
  const editable = editableRoleModuleIds(navigationSections, { protectedRole: true })
  assert.deepEqual(new Set(updateRoleModuleSelection(selected, editable, false)), new Set(["Administración", "Personal y accesos"]))
  const configuration = groupRoleModules(navigationSections)[2]
  const groupEditable = editableRoleModuleIds(configuration.modules, { protectedRole: true })
  assert.deepEqual(groupEditable, ["Perfil institucional"])
})

test("only authorized modules can be bulk targets, preserving already assigned restricted grants", () => {
  const editable = editableRoleModuleIds(navigationSections, { assignableIds: ["Pacientes", "Citas", "not-a-module"] })
  assert.deepEqual(editable, ["Pacientes", "Citas"])
  assert.deepEqual(updateRoleModuleSelection(["Finanzas"], editable, true), ["Finanzas", "Pacientes", "Citas"])
  assert.deepEqual(updateRoleModuleSelection(["Finanzas", "Pacientes"], editable, false), ["Finanzas"])
})

test("an individual change after enable-all updates both category and general counts", () => {
  const enabled = updateRoleModuleSelection([], editableRoleModuleIds(navigationSections), true)
  const changed = updateRoleModuleSelection(enabled, ["Inventario"], false)
  assert.equal(enabledModuleCount(navigationSections, changed), navigationSections.length - 1)
  const operations = groupRoleModules(navigationSections)[1]
  assert.equal(enabledModuleCount(operations.modules, changed), operations.modules.length - 1)
})

test("entirely locked categories have no editable targets", () => {
  assert.deepEqual(editableRoleModuleIds(navigationSections, { assignableIds: [] }), [])
  const editable = editableRoleModuleIds(navigationSections, { protectedRole: true, assignableIds: ["Administración", "Personal y accesos"] })
  assert.deepEqual(editable, [])
  assert.deepEqual(updateRoleModuleSelection(["Administración"], editable, false), ["Administración"])
})

test("bulk changes do not remove unrelated historical identifiers or introduce duplicate modules", () => {
  const selected = ["legacy-section", "Pacientes", "Pacientes"]
  assert.deepEqual(updateRoleModuleSelection(selected, ["Citas", "Citas"], true), ["legacy-section", "Pacientes", "Citas"])
  assert.deepEqual(updateRoleModuleSelection(selected, ["Pacientes"], false), ["legacy-section"])
  assert.deepEqual(selected, ["legacy-section", "Pacientes", "Pacientes"])
})
