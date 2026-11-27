import { test } from "node:test"
import assert from "node:assert/strict"
import { unifiedServerPeople } from "../../src/modules/saas/lib/server-people.ts"
test("professional and account join by professional identifier", () => {
  const rows = unifiedServerPeople([{id:"u",name:"Cuenta",professionalId:"p"}], [{id:"p",name:"Perfil",userId:"u"}])
  assert.equal(rows.length,1); assert.equal(rows[0].id,"u"); assert.equal(rows[0].professional.id,"p")
})
test("reverse stable link works without account-side professional id", () => {
  assert.equal(unifiedServerPeople([{id:"u",name:"A",professionalId:null}], [{id:"p",name:"B",userId:"u"}]).length,1)
})
test("same name never merges unrelated people", () => {
  assert.equal(unifiedServerPeople([{id:"u",name:"Mismo nombre",professionalId:null}], [{id:"p",name:"Mismo nombre",userId:null}]).length,2)
})
test("professional without access keeps a stable row identifier", () => {
  const [row] = unifiedServerPeople([], [{id:"p",name:"Solo profesional",userId:null}])
  assert.equal(row.id,"professional:p"); assert.equal(row.user,null); assert.equal(row.professional.id,"p")
})
test("administrative accounts require no clinical profile", () => {
  const [row] = unifiedServerPeople([{id:"a",name:"Administración",professionalId:null}], [])
  assert.equal(row.professional,null); assert.equal(row.id,"a")
})
