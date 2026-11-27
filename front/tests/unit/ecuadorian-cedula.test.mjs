import { test } from "node:test"
import assert from "node:assert/strict"
import { validateEcuadorianCedula, validateEcuadorianCedulaDetailed, documentValidationMessage } from "../../src/shared/lib/ecuadorian-cedula.ts"

// Synthetic prefixes; no patient data. Compute the check digit independently.
function synthetic(prefix) {
  const sum = Array.from(prefix, Number).map((digit, i) => digit * [2,1,2,1,2,1,2,1,2][i]).map(n => n > 9 ? n - 9 : n).reduce((a,b) => a+b,0)
  return prefix + (10 - sum % 10) % 10
}
test("synthetic valid checksum and consular code", () => {
  for (const prefix of ["010000091", "245000083", "304000072", "305000061"]) assert.equal(validateEcuadorianCedula(synthetic(prefix)), true)
})
for (const [name, value, code] of [
  ["empty", "", "empty"], ["short", "010000091", "length"], ["long", "01000009100", "length"],
  ["letters", "01000009AB", "numeric"], ["special characters", "01000-0910", "numeric"],
  ["province", synthetic("250000091"), "province"], ["zero province", synthetic("000000091"), "province"],
  ["third digit", synthetic("016000091"), "third-digit"], ["consular third digit", synthetic("301000091"), "third-digit"],
  ["sequence", "1111111111", "sequence"],
]) test(name, () => assert.equal(validateEcuadorianCedulaDetailed(value).code, code))
test("wrong check digit", () => {
  const valid = synthetic("010000091")
  assert.equal(validateEcuadorianCedulaDetailed(valid.slice(0,9) + (Number(valid[9])+1)%10).code, "checksum")
})
test("foreign and non-cedula documents bypass the cedula algorithm", () => {
  for (const type of ["pasaporte", "ruc", "extranjero", "otro"]) assert.equal(documentValidationMessage(type, "AB-19-XYZ"), "")
  assert.notEqual(documentValidationMessage("cedula", "AB-19-XYZ"), "")
})
