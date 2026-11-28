import test from "node:test"
import assert from "node:assert/strict"
import { resolveSectionValue } from "../../src/shared/lib/section-selection.ts"

const sections = [{ value: "sedes" }, { value: "consultorios" }, { value: "especialidades" }]

test("a valid direct section takes priority over the module default", () => {
  assert.equal(resolveSectionValue(sections, "consultorios", "sedes"), "consultorios")
})
test("a missing or invalid section opens the module default", () => {
  for (const value of [null, undefined, "", "unknown"]) assert.equal(resolveSectionValue(sections, value, "consultorios"), "consultorios")
})
test("unauthorized and disabled defaults fall back to the first usable section", () => {
  const items = [{ value: "sedes", permitted: false }, { value: "consultorios", disabled: true }, { value: "especialidades" }]
  assert.equal(resolveSectionValue(items, "sedes", "consultorios"), "especialidades")
})
test("an empty or wholly restricted catalogue never selects confidential content", () => {
  assert.equal(resolveSectionValue([], "sedes", "sedes"), "")
  assert.equal(resolveSectionValue([{ value: "sedes", permitted: false }, { value: "consultorios", disabled: true }], "sedes", "consultorios"), "")
})
