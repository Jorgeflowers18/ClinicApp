import { expect, test, type Page } from "@playwright/test"
import { settleCalendarLayout } from "./helpers/calendar-layout"

test.use({ reducedMotion: "reduce", timezoneId: "America/Guayaquil" })
const widths = [320,360,375,390,430,768,1024,1280,1440,1920]
const routes = ["/pacientes","/tratamientos","/inventario","/historial-clinico","/finanzas","/reportes","/notificaciones"]
const reset = (page: Page) => page.getByRole("button", { name: "Restablecer filtros", exact: true })
async function login(page: Page, theme: string) {
  await page.goto("/login"); await page.getByRole("button",{name:theme==="light"?"Tema claro":"Tema oscuro",exact:true}).click()
  await page.locator("#email").fill("admin@clinica.com"); await page.locator("#password").fill("admin123")
  await page.getByRole("button",{name:"Ingresar",exact:true}).click();await page.getByRole("button",{name:"Continuar",exact:true}).click();await expect(page).toHaveURL(/\/$/)
}
async function ready(page: Page, route: string) {
  await page.goto(route); await expect(reset(page)).toHaveCount(1)
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  await settleCalendarLayout(page)
}
async function fixture(page: Page) { await page.evaluate(async()=>{const path="/tests/fixtures/ui-standardization.tsx";const {mount}=await import(path);mount()});await expect(page.locator("[data-ui-fixture]")).toBeVisible() }

for (const theme of ["light","dark"]) {
  test(`reset keeps dimensions and search results return to defaults in ${theme}`,async({page})=>{
    await login(page,theme)
    for(const route of ["/pacientes","/tratamientos","/inventario","/finanzas","/notificaciones"]) {
      await ready(page,route); await expect(reset(page)).toBeDisabled()
      const input=page.locator('main input[placeholder^="Buscar"]').first(),before=(await input.boundingBox())!,button=(await reset(page).boundingBox())!
      expect(Math.abs(button.width-button.height)).toBeLessThan(1)
      await input.fill("sin coincidencias de prueba");await expect(reset(page)).toBeEnabled()
      const after=(await input.boundingBox())!;expect(after.x).toBe(before.x);expect(after.width).toBe(before.width)
      await reset(page).click();await expect(input).toHaveValue("");await expect(reset(page)).toBeDisabled()
      expect((await reset(page).boundingBox())!.width).toBe(button.width)
    }
    await ready(page,"/reportes");await expect(reset(page)).toBeDisabled();await page.getByRole("combobox").first().click();await page.getByRole("option",{name:"Este mes",exact:true}).click();await expect(reset(page)).toBeEnabled();await reset(page).click();await expect(page.getByRole("combobox").first()).toContainText("Últimos 30 días")
  })

  test(`all filter bars fit ten widths and both sidebar states in ${theme}`,async({page},info)=>{
    test.setTimeout(240000);await login(page,theme);const measures=[]
    for(const route of routes){await ready(page,route)
      for(const width of widths){await page.setViewportSize({width,height:900});await settleCalendarLayout(page)
        const rect=(await reset(page).boundingBox())!;expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(width+1)
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        if(width<1024)expect(rect.height).toBeGreaterThanOrEqual(44)
        const outside=await page.locator('main [data-filter-toolbar] button').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}).map(n=>n.textContent));expect(outside).toEqual([])
        if(route === "/inventario" && width >= 1440) for(const value of await page.getByRole("combobox").locator('[data-slot="select-value"]').all()) expect(await value.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true)
        if([320,768,1440,1920].includes(width))await page.screenshot({path:info.outputPath(theme+"-"+width+"-"+route.slice(1)+".png"),animations:"disabled"})
        measures.push({route,width,resetWidth:rect.width,resetHeight:rect.height})
      }
      await page.setViewportSize({width:1440,height:900});await settleCalendarLayout(page);await page.getByRole("button",{name:"Cerrar menú",exact:true}).click();await settleCalendarLayout(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);await page.getByRole("button",{name:"Abrir menú",exact:true}).click()
    }
    await info.attach("layout.json",{body:JSON.stringify(measures,null,2),contentType:"application/json"})
  })

  test(`async labels survive empty options without technical ids or spurious changes in ${theme}`,async({page})=>{
    await login(page,theme);await fixture(page);const control=page.getByRole("combobox",{name:"Profesional asíncrono",exact:true}),label="Dra. Andrea del Camino, especialista en rehabilitación oral integral y odontología avanzada"
    await expect(control.locator('[data-slot="select-value"]')).toHaveText(label);await page.getByRole("button",{name:"Vaciar opciones durante carga",exact:true}).click();await expect(control.locator('[data-slot="select-value"]')).toHaveText(label);await expect(page.getByLabel("Cambios de selección")).toHaveText("0")
    await page.getByRole("button",{name:"Recuperar opciones",exact:true}).click();await control.click();const option=page.getByRole("option",{name:label,exact:true});await expect(option).toBeVisible()
    expect(await option.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);await page.getByRole("option",{name:"Dr. Andrés Vega",exact:true}).click();await expect(control.locator('[data-slot="select-value"]')).toHaveText("Dr. Andrés Vega");await expect(page.getByLabel("Cambios de selección")).toHaveText("1")
    await control.focus();await page.keyboard.press("ArrowDown");await expect(page.getByRole("listbox")).toBeVisible();await page.keyboard.press("Escape");await expect(control).toBeFocused()
  })

  test(`mobile filter panel keeps complete labels, internal scrolling and stable reset actions in ${theme}`,async({page},info)=>{
    await login(page,theme);await ready(page,"/inventario");await page.setViewportSize({width:320,height:480});await settleCalendarLayout(page)
    await page.getByRole("button",{name:"Filtros",exact:true}).click();const panel=page.getByRole("dialog",{name:"Filtros de insumos",exact:true})
    await expect(panel).toBeVisible();await expect(panel.getByRole("combobox")).toHaveCount(4)
    await panel.getByRole("combobox",{name:"Filtrar por categoría",exact:true}).click();await page.getByRole("option",{name:"Bioseguridad",exact:true}).click()
    const button=panel.getByRole("button",{name:"Restablecer filtros",exact:true});await expect(button).toBeEnabled();const before=(await button.boundingBox())!
    expect(before.width).toBe(before.height);expect(before.width).toBeGreaterThanOrEqual(44);expect(before.y+before.height).toBeLessThanOrEqual(480)
    await panel.getByRole("combobox",{name:"Filtrar por stock",exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath("mobile-filters-"+theme+".png"),animations:"disabled"})
    await button.click();await expect(button).toBeDisabled();await expect(panel).toBeVisible();await expect(panel.getByRole("combobox",{name:"Filtrar por categoría",exact:true})).toContainText("Todas las categorías")
    expect((await button.boundingBox())!.width).toBe(before.width);await panel.getByRole("button",{name:"Listo",exact:true}).click();await expect(panel).not.toBeVisible();await expect(page.getByRole("button",{name:"Filtros",exact:true})).toBeFocused()
  })

  test(`a selected clinical patient beyond the initial catalog resolves its real name in ${theme}`,async({page})=>{
    await login(page,theme)
    const selected = await page.evaluate(async()=>{
      const source="/src/modules/patients/api/patients.mock-data.ts",apiPath="/src/modules/patients/api/patients.api.ts"
      const [{mockPatients},{patientsApi}]=await Promise.all([import(source),import(apiPath)])
      const base=mockPatients[0]
      for(let i=0;i<110;i++)mockPatients.push({...base,id:"label-patient-"+i,documentId:"label-document-"+i,firstName:"Paciente",lastName:"Catálogo "+i,createdAt:"2024-01-01T12:00:00Z"})
      const record={...base,id:"selected-outside-catalog",documentId:"label-document-selected",firstName:"Andrea",lastName:"Nombre fuera del catálogo inicial",createdAt:"2000-01-01T12:00:00Z"};mockPatients.push(record)
      const first=await patientsApi.list({page:1,pageSize:100});return {id:record.id,name:record.firstName+" "+record.lastName,absent:!first.items.some((patient:{id:string})=>patient.id===record.id)}
    })
    expect(selected.absent).toBe(true)
    await page.getByRole("link",{name:"Historial clínico",exact:true}).click()
    await page.evaluate(id=>{history.replaceState(history.state,"","/historial-clinico?pacienteId="+id);dispatchEvent(new PopStateEvent("popstate",{state:history.state}))},selected.id)
    const control=page.getByRole("combobox",{name:"Filtrar por paciente",exact:true});await expect(control.locator('[data-slot="select-value"]')).toHaveText(selected.name)
    await expect(page).toHaveURL(new RegExp("pacienteId="+selected.id));await reset(page).click();await expect(control.locator('[data-slot="select-value"]')).toHaveText("Todos los pacientes")
  })

  test(`numeric fields keep native values, decimals, bounds and keyboard while specialist controls opt out in ${theme}`,async({page})=>{
    await login(page,theme);await fixture(page);const input=page.getByRole("spinbutton",{name:"Importe de prueba",exact:true})
    await expect(input).toHaveAttribute("type","number");await expect(input).toHaveCSS("appearance","textfield");await expect(input).toHaveAttribute("min","-20");await expect(input).toHaveAttribute("max","500");await expect(input).toHaveAttribute("step","0.01")
    await input.fill("");await expect(input).toHaveValue("");await input.fill("-1.25");await expect(input).toHaveValue("-1.25");await input.focus();await page.keyboard.press("ArrowUp");await expect(input).toHaveValue("-1.24")
    await input.selectText();await page.keyboard.type("88.73");await expect(input).toHaveValue("88.73");expect(await input.inputValue()).not.toContain("$")
    const duration=page.getByRole("spinbutton",{name:"Duración de prueba",exact:true});await duration.focus();await page.keyboard.press("ArrowUp");await expect(duration).toHaveValue("35")
    const specialist=page.getByRole("spinbutton",{name:"Control especializado",exact:true});await expect(specialist).not.toHaveAttribute("data-numeric-input");expect(await specialist.evaluate(n=>getComputedStyle(n).appearance)).not.toBe("textfield")
    await ready(page,"/tratamientos");await page.getByRole("button",{name:"Nuevo tratamiento",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Nuevo tratamiento",exact:true});await dialog.getByLabel("Precio (USD)",{exact:true}).fill("61.25");await expect(dialog.getByLabel("Precio (USD)",{exact:true})).toHaveValue("61.25");await expect(dialog.getByLabel("Precio (USD)",{exact:true})).toHaveCSS("appearance","textfield")
  })

  test(`shared modal variants keep heading, scroll, actions and focus inside short viewports in ${theme}`,async({page})=>{
    await login(page,theme);await fixture(page)
    for(const width of [320,768,1440]){await page.setViewportSize({width,height:480})
      for(const variant of ["small","medium","wide","complex"]){const trigger=page.getByRole("button",{name:"Abrir "+variant,exact:true});await trigger.click();const dialog=page.getByRole("dialog",{name:"Formulario "+variant,exact:true});await expect(dialog).toBeVisible()
        const rect=(await dialog.boundingBox())!;expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(width);expect(rect.y+rect.height).toBeLessThanOrEqual(480)
        const last=dialog.getByRole("textbox",{name:"Campo 24",exact:true});await last.scrollIntoViewIfNeeded();const field=(await last.boundingBox())!,actions=(await dialog.locator('[data-slot="dialog-footer"]').boundingBox())!;expect(field.y+field.height).toBeLessThanOrEqual(actions.y+1)
        await expect(dialog.getByRole("heading")).toBeVisible();await expect(dialog.getByRole("button",{name:"Guardar prueba",exact:true})).toBeInViewport();await page.keyboard.press("Tab");expect(await dialog.evaluate(n=>n.contains(document.activeElement))).toBe(true)
        await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused()
      }
    }
  })
}
