import { expect, test, type Page } from "@playwright/test"
import { settleCalendarLayout } from "./helpers/calendar-layout"
import { openUserMenu } from "./helpers/app-navigation"
declare global { interface Window { messagingModule: (path:string)=>Promise<any>; releaseTemplate?:()=>void; templateWrites?:number; messageReads?:number; patientReads?:number } }
test.use({reducedMotion:"reduce",timezoneId:"America/Guayaquil"})
test.describe.configure({mode:"parallel"})
const bell=(p:Page)=>p.getByRole("button",{name:/^Notificaciones:/})
const center=(p:Page)=>p.getByRole("dialog",{name:"Notificaciones",exact:true})
async function login(page:Page,theme:string,role="admin"){
  await page.addInitScript(()=>{window.messagingModule=path=>{const resource=performance.getEntriesByType("resource").findLast(entry=>new URL(entry.name).pathname===path);return import(/* @vite-ignore */ resource?.name??path)}})
  await page.clock.install({time:new Date("2026-11-19T12:00:00Z")})
  await page.goto("/login");await page.getByRole("button",{name:theme==="light"?"Tema claro":"Tema oscuro",exact:true}).click()
  await page.locator("#email").fill(role+"@clinica.com");await page.locator("#password").fill(role+"123")
  await page.getByRole("button",{name:"Ingresar",exact:true}).click();await page.getByRole("button",{name:"Continuar",exact:true}).click()
  await expect(page).toHaveURL(/\/$/);await expect(bell(page)).toHaveAttribute("aria-label",/\d+ sin leer/)
}
async function module(page:Page){await page.getByRole("link",{name:"Mensajería",exact:true}).click();await expect(page.getByRole("heading",{name:"Mensajería",exact:true})).toBeVisible();await expect(page.locator(".messaging-metrics .clinic-kpi-value")).toHaveCount(4)}
async function tab(page:Page,name:string){const t=page.getByRole("tab",{name,exact:true});if(await t.count()&&await t.getAttribute("aria-selected")==="true")return;if(await t.count()&&(await t.boundingBox())!.width>4)await t.click();else{await page.getByRole("button",{name:/^Más pestañas/}).click();await page.getByRole("menuitemradio",{name,exact:true}).click()}}
async function refresh(page:Page){await bell(page).click();await center(page).getByRole("button",{name:"Actualizar notificaciones",exact:true}).click();await expect(center(page).getByRole("button",{name:"Actualizar notificaciones",exact:true})).toBeEnabled();await page.keyboard.press("Escape")}
async function snapshot(page:Page){return page.evaluate(async()=>{const a=await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts"),b=await window.messagingModule("/src/modules/inventory/api/inventory.mock-data.ts"),c=await window.messagingModule("/src/modules/appointments/api/appointments.mock-data.ts");return JSON.stringify({logs:a.mockNotifications,items:b.mockInventoryItems,lots:b.mockStockLots,moves:b.mockStockMovements,appointments:c.mockAppointments})})}
for(const theme of ["light","dark"]){
test("complete metrics and combined filters include records after page 100 in "+theme,async({page})=>{
  await login(page,theme)
  await page.evaluate(async()=>{
    const {mockPatients}=await window.messagingModule("/src/modules/patients/api/patients.mock-data.ts"),{mockNotifications}=await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts")
    for(let i=0;i<121;i++)mockPatients.push({...mockPatients[0],id:"remote-patient-"+i,firstName:"Paciente",lastName:"Remoto "+i,documentId:String(7000000000+i)})
    for(let i=0;i<121;i++)mockNotifications.push({...mockNotifications[0],id:"remote-message-"+i,patientId:"remote-patient-"+i,channel:"sms",type:"confirmacion_cita",status:i===120?"fallida":"enviada",sentAt:"2026-11-19T13:00:00.000Z"})
    const {notificationsApi}=await window.messagingModule("/src/modules/notifications/api/notifications.api.ts"),{patientsApi}=await window.messagingModule("/src/modules/patients/api/patients.api.ts")
    const messages=notificationsApi.list,patients=patientsApi.list;window.messageReads=0;window.patientReads=0
    notificationsApi.list=async(query:any)=>{window.messageReads!++;return messages(query)}
    patientsApi.list=async(query:any)=>{window.patientReads!++;return patients(query)}
  })
  await refresh(page);await module(page)
  await expect(page.locator(".messaging-metrics .clinic-kpi-value")).toHaveText(["129","127","2","98%"])
  expect(await page.evaluate(()=>window.messageReads)).toBe(2);expect(await page.evaluate(()=>window.patientReads)).toBe(2)
  const original=await snapshot(page)
  await page.getByLabel("Buscar mensajes por paciente o identificación").fill("7000000120")
  await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("de 1")
  await expect(page.getByText("Paciente Remoto 120",{exact:true}).filter({visible:true})).toBeVisible()
  await page.getByRole("button",{name:/^Filtros/}).click()
  for(const [field,value]of[["Canal","SMS"],["Estado","Fallido"],["Tipo de mensaje","Confirmación de cita"]]){await page.getByLabel(field,{exact:true}).click();await page.getByRole("option",{name:value,exact:true}).click()}
  await page.getByLabel("Desde",{exact:true}).fill("2026-11-19");await page.getByLabel("Hasta",{exact:true}).fill("2026-11-19");await page.getByRole("button",{name:"Listo",exact:true}).click()
  await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("de 1");await expect(page.locator(".messaging-active-filters")).toContainText("Estado: Fallido")
  await expect(page.locator(".messaging-metrics .clinic-kpi-value")).toHaveText(["129","127","2","98%"])
  await page.getByRole("button",{name:"Restablecer filtros",exact:true}).click();await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("de 129")
  await page.getByRole("button",{name:"Siguiente",exact:true}).click();await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("11")
  expect(await snapshot(page)).toBe(original)
})
test("template insertion, drafts, background refresh and failed saves preserve content in "+theme,async({page})=>{
  await login(page,theme);await module(page);await tab(page,"Plantillas de mensajes")
  const message=page.getByLabel("Mensaje",{exact:true}),save=page.getByRole("button",{name:"Guardar plantilla",exact:true})
  await expect(save).toBeDisabled();await message.fill("Hola borrar, [desconocida].")
  await message.evaluate((node:HTMLTextAreaElement)=>{node.focus();node.setSelectionRange(5,11)})
  await page.getByRole("button",{name:"Nombre del paciente",exact:true}).click()
  await expect(message).toHaveValue("Hola [nombre del cliente], [desconocida].");await expect(message).toBeFocused()
  await expect(page.getByRole("region",{name:"Vista previa del mensaje"})).toContainText("Hola María González, [desconocida].")
  const draft=await message.inputValue();await tab(page,"Historial de envíos");await tab(page,"Plantillas de mensajes");await expect(message).toHaveValue(draft)
  await page.evaluate(async()=>{const {queryClient}=await window.messagingModule("/src/shared/lib/query-client.ts");await queryClient.invalidateQueries({queryKey:["notifications","template"]})});await expect(message).toHaveValue(draft)
  for(const [label,token]of[["Clínica","[nombre de la clínica]"],["Fecha de cita","[fecha de la cita]"],["Hora de cita","[hora de la cita]"],["Profesional","[profesional]"]]){
    await message.evaluate((node:HTMLTextAreaElement)=>{node.focus();node.setSelectionRange(node.value.length,node.value.length)})
    await page.getByRole("group",{name:"Insertar variable"}).getByRole("button",{name:label,exact:true}).click();expect((await message.inputValue()).endsWith(token)).toBe(true)
  }
  const finalDraft=await message.inputValue();await expect(page.locator("#message-count")).toContainText(String(finalDraft.length))
  await page.evaluate(async()=>{
    const {notificationsApi}=await window.messagingModule("/src/modules/notifications/api/notifications.api.ts"),original=notificationsApi.updateTemplate;window.templateWrites=0
    notificationsApi.updateTemplate=async(values:any)=>{window.templateWrites!++;if(window.templateWrites===1)throw new Error("Guardado rechazado de prueba");return new Promise(resolve=>{window.releaseTemplate=()=>{notificationsApi.updateTemplate=original;void original(values).then(resolve)}})}
  })
  await save.click();await expect(page.getByRole("alert")).toContainText("Guardado rechazado de prueba");await expect(message).toHaveValue(finalDraft);await expect(save).toBeEnabled()
  await save.click();await expect(page.getByRole("button",{name:"Guardando...",exact:true})).toBeDisabled();await expect(message).toBeDisabled();expect(await page.evaluate(()=>window.templateWrites)).toBe(2)
  await page.evaluate(()=>window.releaseTemplate!());await expect(page.getByText("Plantilla de mensaje actualizada",{exact:true})).toBeVisible();await expect(save).toBeDisabled();await expect(message).toHaveValue(finalDraft)
  expect(await page.evaluate(async()=>{const {notificationsApi}=await window.messagingModule("/src/modules/notifications/api/notifications.api.ts");return(await notificationsApi.getTemplate()).message})).toBe(finalDraft)
})
test("draft confirmation covers sidebar, programmatic navigation, reload and browser back in "+theme,async({page})=>{
  await login(page,theme);await module(page);await tab(page,"Plantillas de mensajes")
  const message=page.getByLabel("Mensaje",{exact:true}),saved=await message.inputValue();await message.fill("Plantilla pendiente de conservar")
  await page.getByRole("link",{name:"Pacientes",exact:true}).click();await expect(page.getByRole("alertdialog")).toBeVisible();await expect(page).toHaveURL(/\/notificaciones$/)
  await page.getByRole("button",{name:"Continuar editando",exact:true}).click();await expect(message).toHaveValue("Plantilla pendiente de conservar")
  const menu=await openUserMenu(page);await menu.getByRole("menuitem",{name:"Mi perfil",exact:true}).click();await expect(page.getByRole("alertdialog")).toBeVisible();await page.keyboard.press("Escape");await expect(page).toHaveURL(/\/notificaciones$/)
  const reloadDialog=page.waitForEvent("dialog"),reload=page.reload({timeout:3000}).catch(()=>null),native=await reloadDialog
  expect(native.type()).toBe("beforeunload");await native.dismiss();await reload;await expect(message).toHaveValue("Plantilla pendiente de conservar")
  await page.goBack();await expect(page.getByRole("alertdialog")).toBeVisible();await expect(page).toHaveURL(/\/notificaciones$/)
  await page.getByRole("button",{name:"Continuar editando",exact:true}).click();await expect(message).toHaveValue("Plantilla pendiente de conservar")
  await page.goBack();await expect(page.getByRole("alertdialog")).toBeVisible();await page.getByRole("button",{name:"Descartar cambios",exact:true}).click();await expect(page).toHaveURL(/\/$/)
  await page.goForward();await expect(page).toHaveURL(/\/notificaciones$/);await tab(page,"Plantillas de mensajes");await expect(message).toHaveValue(saved)
})
test("notification reading, filtered mark-all and linked failed message preserve source data in "+theme,async({page})=>{
  await login(page,theme);const before=await snapshot(page)
  await module(page);await page.getByRole("button",{name:/^Filtros/}).click();await page.getByLabel("Canal",{exact:true}).click();await page.getByRole("option",{name:"Correo",exact:true}).click();await page.getByRole("button",{name:"Listo",exact:true}).click()
  await expect(bell(page).locator("[data-notification-count]")).toHaveText("5");await expect(bell(page).locator("[data-notification-count]")).toHaveCount(1)
  await bell(page).click();const panel=center(page);await expect(panel.locator("[data-alert-kind]")).toHaveCount(5)
  await expect(panel.locator('[data-alert-kind="inventory"]').first()).toContainText("3 litros disponibles · Mínimo: 5 litros")
  await expect(panel.locator('[data-alert-kind="appointment"]').first()).toContainText("Próxima cita · 09:00")
  await panel.locator('[data-alert-kind="delivery"]').getByRole("link").click();await expect(page).toHaveURL(/\/notificaciones\?envio=ntf_4$/)
  await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("de 1");await expect(page.getByText("Jorge Flores",{exact:true}).filter({visible:true})).toBeVisible()
  await page.getByRole("button",{name:"Restablecer filtros",exact:true}).click();await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("de 8")
  await bell(page).click();await panel.getByRole("button",{name:/^Marcar como leída:/}).first().click()
  await expect(bell(page)).toHaveAttribute("aria-label",/4 sin leer/);await expect(panel.locator("[data-alert-kind]")).toHaveCount(4)
  await panel.getByRole("button",{name:"Todas",exact:true}).click();await expect(panel.locator('[data-alert-read="true"]')).toHaveCount(1)
  await panel.getByLabel("Tipo de notificación",{exact:true}).click();await page.getByRole("option",{name:"Inventario",exact:true}).click();await expect(panel.locator("[data-alert-kind]")).toHaveCount(2)
  await panel.getByRole("button",{name:"Marcar todas como leídas",exact:true}).click();await expect(bell(page).locator("[data-notification-count]")).toHaveCount(0)
  await panel.getByRole("button",{name:"No leídas",exact:true}).click();await expect(panel.getByText("No hay notificaciones de este tipo",{exact:true})).toBeVisible()
  await panel.getByLabel("Tipo de notificación",{exact:true}).click();await page.getByRole("option",{name:"Todos los tipos",exact:true}).click();await expect(panel.getByText("Estás al día",{exact:true})).toBeVisible()
  await page.keyboard.press("Escape");await expect(bell(page)).toBeFocused();expect(await snapshot(page)).toBe(before)
  await page.reload();await expect(bell(page)).toHaveAttribute("aria-label","Notificaciones: 0 sin leer");await bell(page).click();await center(page).getByRole("button",{name:"Todas",exact:true}).click();await expect(center(page).locator('[data-alert-read="true"]')).toHaveCount(5)
})
test("counts support zero, one and more than 99 notifications without moving the bell in "+theme,async({page})=>{
  await login(page,theme);const original=await bell(page).boundingBox()
  await page.evaluate(async()=>{
    const a=await window.messagingModule("/src/modules/inventory/api/inventory.mock-data.ts"),b=await window.messagingModule("/src/modules/appointments/api/appointments.mock-data.ts"),c=await window.messagingModule("/src/modules/patients/api/patients.mock-data.ts"),d=await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts")
    a.mockInventoryItems.forEach((item:any)=>{item.stock=50;item.minStock=0});b.mockAppointments.splice(0);c.mockPatients.forEach((patient:any)=>patient.birthDate="2000-01-01")
    const log={...d.mockNotifications[0],status:"fallida"};d.mockNotifications.splice(0,d.mockNotifications.length,...Array.from({length:105},(_,i)=>({...log,id:"notice-"+i})))
  })
  await refresh(page);await expect(bell(page)).toHaveAttribute("aria-label",/105 sin leer/);await expect(bell(page).locator("[data-notification-count]")).toHaveText("99+");expect(await bell(page).boundingBox()).toEqual(original)
  await bell(page).click();await expect(center(page).locator("[data-alert-kind]")).toHaveCount(105)
  const ids=await center(page).locator("[data-alert-id]").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("data-alert-id")));expect(new Set(ids).size).toBe(105)
  await center(page).getByRole("button",{name:"Marcar todas como leídas",exact:true}).click();await expect(bell(page).locator("[data-notification-count]")).toHaveCount(0)
  await center(page).getByRole("button",{name:"Todas",exact:true}).click();await expect(center(page).locator('[data-alert-read="true"]')).toHaveCount(105);await page.keyboard.press("Escape")
  await page.evaluate(async()=>{const {mockNotifications}=await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts");mockNotifications.splice(0,mockNotifications.length,{...mockNotifications[0],id:"single-new-notice"})})
  await refresh(page);await expect(bell(page).locator("[data-notification-count]")).toHaveText("1")
  await page.evaluate(async()=>{const {mockNotifications}=await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts");mockNotifications.splice(0)})
  await refresh(page);await expect(bell(page).locator("[data-notification-count]")).toHaveCount(0)
})
test("history, template and notification selectors fit eleven widths and short screens in "+theme,async({page},testInfo)=>{
  test.setTimeout(180000);await login(page,theme);const matrix=[]
  for(const width of [320,360,375,390,430,600,768,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:900});await settleCalendarLayout(page);await page.goto("/notificaciones");await expect(page.locator(".messaging-metrics .clinic-kpi-value")).toHaveText(["8","7","1","88%"])
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const heights=await page.locator(".messaging-metrics .clinic-kpi-card").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(2)
    await page.getByRole("button",{name:/^Filtros/}).click();await page.getByLabel("Canal",{exact:true}).click()
    const options=await page.getByRole("listbox").boundingBox();expect(options!.x).toBeGreaterThanOrEqual(-1);expect(options!.x+options!.width).toBeLessThanOrEqual(width+1)
    await page.keyboard.press("Escape");await page.keyboard.press("Escape");await tab(page,"Plantillas de mensajes");await expect(page.getByLabel("Mensaje",{exact:true})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await bell(page).click();const bounds=(await center(page).boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(-1);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);expect(bounds.y+bounds.height).toBeLessThanOrEqual(901)
    await center(page).getByLabel("Tipo de notificación",{exact:true}).click();await expect(page.getByRole("option",{name:"Todos los tipos",exact:true})).toBeVisible()
    await page.keyboard.press("Escape");await page.keyboard.press("Escape");await expect(bell(page)).toBeFocused();matrix.push({width,heights,panel:bounds})
  }
  for(const size of [{width:390,height:380},{width:720,height:450}]){await page.setViewportSize(size);await settleCalendarLayout(page);await bell(page).click();const bounds=(await center(page).boundingBox())!;expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height+1);await center(page).locator('[data-alert-kind]').last().scrollIntoViewIfNeeded();await expect(center(page).locator('[data-alert-kind]').last()).toBeInViewport();await page.keyboard.press("Escape")}
  await testInfo.attach("messaging-responsive",{body:JSON.stringify(matrix),contentType:"application/json"})
})
test("failed queries never show false metrics or a blank template and can recover in "+theme,async({page})=>{
  await login(page,theme)
  await page.evaluate(async()=>{
    const {notificationsApi}=await window.messagingModule("/src/modules/notifications/api/notifications.api.ts"),{queryClient}=await window.messagingModule("/src/shared/lib/query-client.ts")
    queryClient.setDefaultOptions({queries:{retry:false}});const original=notificationsApi.getTemplate
    notificationsApi.getTemplate=async()=>{notificationsApi.getTemplate=original;throw new Error("Lectura rechazada")}
  })
  await module(page);await tab(page,"Plantillas de mensajes");await expect(page.getByRole("alert")).toContainText("No se pudo cargar la plantilla");await expect(page.getByLabel("Mensaje",{exact:true})).toHaveCount(0)
  await page.getByRole("button",{name:"Reintentar carga de plantilla",exact:true}).click();await expect(page.getByLabel("Mensaje",{exact:true})).toHaveValue(/Hola/)
  await page.evaluate(async()=>{const {notificationsApi}=await window.messagingModule("/src/modules/notifications/api/notifications.api.ts");notificationsApi.list=async()=>{throw new Error("Catálogo no disponible")}})
  await refresh(page);await expect(bell(page)).toHaveAttribute("aria-label","Notificaciones: consulta incompleta");await expect(page.getByText(/Los indicadores no están disponibles/)).toBeVisible();await expect(page.locator(".messaging-metrics")).toHaveCount(0)
  await bell(page).click();await expect(center(page).getByRole("button",{name:"Marcar todas como leídas",exact:true})).toBeDisabled()
})
}
for(const role of ["admin","recepcion","medico"])test("messaging and notification permissions remain unchanged for "+role,async({page})=>{
  await login(page,"light",role);await expect(page.getByRole("link",{name:"Mensajería",exact:true})).toHaveCount(role==="medico"?0:1)
  await bell(page).click();await center(page).getByLabel("Tipo de notificación",{exact:true}).click()
  for(const name of ["Inventario","Mensajería"])await expect(page.getByRole("option",{name,exact:true})).toHaveCount(role==="medico"?0:1)
  await page.keyboard.press("Escape");await expect(center(page).getByRole("link",{name:"Ir a Mensajería",exact:true})).toHaveCount(role==="medico"?0:1)
  await page.keyboard.press("Escape");await page.goto("/notificaciones");await expect(page).toHaveURL(role==="medico"?/\/403$/:/\/notificaciones$/)
})

test("notification generation retains original ids, order, thresholds, importance and destinations",async({page})=>{
  await page.goto("/login")
  const result=await page.evaluate(async()=>{
    const current=await import(/* @vite-ignore */ "/src/modules/notifications/components/use-global-alerts.ts")
    const original=await import(/* @vite-ignore */ "/tests/fixtures/original-global-alerts.ts")
    const a=await import(/* @vite-ignore */ "/src/modules/appointments/api/appointments.mock-data.ts"),p=await import(/* @vite-ignore */ "/src/modules/patients/api/patients.mock-data.ts"),i=await import(/* @vite-ignore */ "/src/modules/inventory/api/inventory.mock-data.ts"),n=await import(/* @vite-ignore */ "/src/modules/notifications/api/notifications.mock-data.ts")
    const now=new Date("2026-11-19T12:00:00Z"),patient={...p.mockPatients[0],birthDate:"1990-11-19"}
    const input={
      now,patients:[patient],inventory:[{...i.mockInventoryItems[0],id:"equal",stock:1,minStock:1},{...i.mockInventoryItems[0],id:"empty",stock:0,minStock:0},{...i.mockInventoryItems[0],id:"above",stock:2,minStock:1}],
      appointments:["programada","confirmada","cancelada","completada","no_asistio"].map((status,index)=>({...a.mockAppointments[0],id:"apt-"+index,patientId:patient.id,status,start:"2026-11-19T14:00:00Z"})).concat([{...a.mockAppointments[0],id:"past",patientId:patient.id,status:"programada",start:"2026-11-19T10:00:00Z"}]),
      deliveries:[{...n.mockNotifications[0],id:"failed",patientId:patient.id,status:"fallida"},{...n.mockNotifications[0],id:"sent",patientId:patient.id,status:"enviada"}],
    }
    const before=JSON.stringify(input),simplify=(rows:any[])=>rows.map(row=>({id:row.id,kind:row.kind,important:row.important,path:new URL(row.to,location.origin).pathname}))
    const updated=current.buildGlobalAlerts(input)
    return {before:simplify(original.buildGlobalAlerts(input)),after:simplify(updated),unchanged:before===JSON.stringify(input),pastTitle:updated.find((row:any)=>row.id.startsWith("appointment:past"))?.title,futureTitle:updated.find((row:any)=>row.id.startsWith("appointment:apt-0"))?.title}
  })
  expect(result.after).toEqual(result.before);expect(result.unchanged).toBe(true);expect(result.pastTitle).toContain("Cita de hoy");expect(result.pastTitle).not.toContain("Próxima");expect(result.futureTitle).toContain("Próxima cita")
})

for(const theme of ["light","dark"])test("a failed background template refresh preserves a long draft and zero metrics stay honest in "+theme,async({page})=>{
  await login(page,theme);await module(page);await tab(page,"Plantillas de mensajes")
  const message=page.getByLabel("Mensaje",{exact:true}),draft=("Texto extenso con ñ y 🙂 [desconocida]. ").repeat(150)
  await message.fill(draft)
  await page.evaluate(async()=>{
    const {notificationsApi}=await window.messagingModule("/src/modules/notifications/api/notifications.api.ts"),{queryClient}=await window.messagingModule("/src/shared/lib/query-client.ts"),original=notificationsApi.getTemplate
    notificationsApi.getTemplate=async()=>{throw new Error("Refresco rechazado")}
    const query=queryClient.getQueryCache().find({queryKey:["notifications","template"]});query.setOptions({...query.options,retry:false})
    window.releaseTemplate=()=>{notificationsApi.getTemplate=original}
    await queryClient.invalidateQueries({queryKey:["notifications","template"]})
  })
  await expect(page.getByRole("alert")).toContainText("Tu borrador se conserva")
  await expect(message).toHaveValue(draft);await expect(page.locator("#message-count")).toContainText(String(draft.length))
  await expect(page.getByRole("region",{name:"Vista previa del mensaje"})).toContainText("[desconocida]")
  await page.evaluate(async()=>{window.releaseTemplate!();const {queryClient}=await window.messagingModule("/src/shared/lib/query-client.ts");await queryClient.invalidateQueries({queryKey:["notifications","template"]});const {mockNotifications}=await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts");mockNotifications.splice(0);await queryClient.invalidateQueries({queryKey:["notifications","list"]})})
  await expect(page.getByRole("alert")).toHaveCount(0);await expect(message).toHaveValue(draft)
  await expect(page.locator(".messaging-metrics .clinic-kpi-value")).toHaveText(["0","0","0","—"])
})

test("long patient and inventory names wrap inside the notification panel in both themes",async({page})=>{
  await login(page,"light")
  await page.evaluate(async()=>{
    const {mockInventoryItems}=await window.messagingModule("/src/modules/inventory/api/inventory.mock-data.ts"),{mockPatients}=await window.messagingModule("/src/modules/patients/api/patients.mock-data.ts")
    mockInventoryItems.find((item:any)=>item.stock<=item.minStock).name="Insumo de prueba "+ "PresentaciónExtensa".repeat(14)
    mockPatients[0].firstName="Paciente con nombres extensos";mockPatients[0].lastName="Apellido".repeat(20)
  })
  await refresh(page);await page.setViewportSize({width:375,height:800});await settleCalendarLayout(page)
  for(const dark of [false,true]){
    await page.getByRole("switch",{name:"Modo oscuro",exact:true}).setChecked(dark)
    await bell(page).click();await expect(center(page).locator('[data-alert-kind="inventory"]').filter({hasText:"PresentaciónExtensa"}).first()).toContainText("PresentaciónExtensa")
    const overflow=await center(page).locator("li, a, strong, small").evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>node.tagName))
    expect(overflow).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    for(const button of await center(page).getByRole("button",{name:/^Marcar como leída:/}).all()){const b=(await button.boundingBox())!;expect(b.x+b.width).toBeLessThanOrEqual(376)}
    await page.keyboard.press("Escape")
  }
})
