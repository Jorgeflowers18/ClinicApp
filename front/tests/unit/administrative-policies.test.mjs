import { test } from "node:test"
import assert from "node:assert/strict"
import { emptyBranchWeek,branchHoursErrors,formatBranchHours,parseBranchHours,branchOpenFor,branchDeletionReason,hasRemovedKnownBranch } from "../../src/modules/institution/lib/branch-hours.ts"
import { specialtyCompatible,specialtySelectionError,normalizedCatalogName } from "../../src/modules/saas/lib/specialty-policy.ts"
const week=()=>{const value=emptyBranchWeek();value[0]={open:true,intervals:[{start:"08:00",end:"12:00"},{start:"14:00",end:"18:00"}]};return value}
test("branch hours preserve split intervals and closed days on round trip",()=>assert.deepEqual(parseBranchHours(formatBranchHours(week())),week()))
test("closed days do not require hours",()=>assert.deepEqual(branchHoursErrors(emptyBranchWeek()),{}))
test("open days require a complete interval",()=>{const value=week();value[0].intervals=[{start:"08:00",end:""}];assert.match(branchHoursErrors(value)[0],/Completa/)})
test("empty open days require an interval",()=>{const value=week();value[0].intervals=[];assert.match(branchHoursErrors(value)[0],/intervalo/)})
test("reversed and overnight intervals are rejected explicitly",()=>{const value=week();value[0].intervals=[{start:"22:00",end:"02:00"}];assert.match(branchHoursErrors(value)[0],/medianoche/)})
test("overlapping intervals and exact duplicates are rejected",()=>{const value=week();for(const interval of [{start:"11:00",end:"15:00"},{start:"08:00",end:"12:00"}]){value[0].intervals[1]=interval;assert.match(branchHoursErrors(value)[0],/solaparse/)}})
test("adjacent intervals remain valid",()=>{const value=week();value[0].intervals[1]={start:"12:00",end:"18:00"};assert.deepEqual(branchHoursErrors(value),{})})
test("legacy free text hours remain unknown rather than interpreted",()=>{assert.equal(parseBranchHours("Lunes a viernes de 8 a 6"),null);assert.equal(branchOpenFor("", "2026-11-30","09:00","10:00"),null)})
test("known branch hours distinguish closed, split break and open periods",()=>{const hours=formatBranchHours(week());assert.equal(branchOpenFor(hours,"2026-11-30","09:00","10:00"),true);assert.equal(branchOpenFor(hours,"2026-11-30","12:30","13:00"),false);assert.equal(branchOpenFor(hours,"2026-12-01","09:00","10:00"),false)})
const deletion=()=>({server:false,id:"site-1",branches:[{id:"site-1",isMain:false}],assignments:[]})
test("server deletion cannot be authorized by a local absence of references",()=>assert.match(branchDeletionReason({...deletion(),server:true}),/backend/))
test("inactive/historical staff assignments also prevent demo branch deletion",()=>assert.match(branchDeletionReason({...deletion(),assignments:[{siteId:"site-1"}]}),/asignaciones/))
test("nested operational references prevent demo deletion",()=>assert.match(branchDeletionReason({...deletion(),operations:{appointments:[{siteId:"site-1"}]}}),/registros/))
test("unrelated operations do not fabricate branch relations",()=>assert.equal(branchDeletionReason({...deletion(),operations:{rooms:[{id:"room-1",name:"QA"}]}}),""))
test("principal must be changed before deleting it among other branches",()=>assert.match(branchDeletionReason({...deletion(),branches:[{id:"site-1",isMain:true},{id:"site-2",isMain:false}]}),/principal/))
const catalog=[{id:"specialty-1",organizationId:"scope",name:"Especialidad QA",description:"",active:true,professionalTypeIds:["type-1"]}]
test("configured types filter compatible specialties",()=>{assert.equal(specialtyCompatible(catalog[0],"type-1"),true);assert.equal(specialtyCompatible(catalog[0],"type-2"),false)})
test("unclassified existing specialties do not invent type classifications",()=>assert.equal(specialtyCompatible({...catalog[0],professionalTypeIds:[]},"type-2"),true))
test("new incompatible assignments fail without dropping historical values",()=>{assert.notEqual(specialtySelectionError(catalog,["specialty-1"],"type-2"),"");assert.equal(specialtySelectionError(catalog,["specialty-1"],"type-2",["specialty-1"],"type-2"),"");assert.notEqual(specialtySelectionError(catalog,["specialty-1"],"type-2",["specialty-1"],"type-1"),"")})
test("inactive specialties retain historical assignments and reject new ones",()=>{const values=[{...catalog[0],active:false}];assert.notEqual(specialtySelectionError(values,["specialty-1"],"type-1"),"");assert.equal(specialtySelectionError(values,["specialty-1"],"type-1",["specialty-1"],"type-1"),"")})
test("catalog name comparison normalizes accents, case and external spaces",()=>assert.equal(normalizedCatalogName("  Odontólogo  "),normalizedCatalogName("odontologo")))
test("stale institutional saves cannot omit known server branches",()=>assert.equal(hasRemovedKnownBranch([{id:"old-site"},{id:"new-site"}],[{id:"old-site"}]),true))
test("editing and adding branches retain every known identifier",()=>assert.equal(hasRemovedKnownBranch([{id:"old-site"}],[{id:"old-site"},{id:""}]),false))
