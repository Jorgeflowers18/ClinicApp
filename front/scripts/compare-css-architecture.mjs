import { chromium } from "@playwright/test"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const phase = process.argv[2] || "after"
if (!["pilot", "after"].includes(phase)) throw new Error("Use pilot or after")
const root = path.resolve("test-results")
const beforeDir = path.join(root, "css-architecture-before")
const afterDir = path.join(root, `css-architecture-${phase}`)
const before = JSON.parse(await readFile(path.join(beforeDir, "computed.json"), "utf8"))
const after = JSON.parse(await readFile(path.join(afterDir, "computed.json"), "utf8"))
const key = (row) => `${row.name}/${row.theme}/${row.width}`
const original = new Map(before.map((row) => [key(row), row]))
const differences = []
for (const row of after) {
  const reference = original.get(key(row))
  if (JSON.stringify(row) !== JSON.stringify(reference)) differences.push({ key: key(row), before: reference, after: row })
}
const shots = JSON.parse(await readFile(path.join(afterDir, "manifest.json"), "utf8"))
const images = []
for (const shot of shots) {
  const first = await readFile(path.join(beforeDir, shot.file))
  const last = await readFile(path.join(afterDir, shot.file))
  const hash = (data) => createHash("sha256").update(data).digest("hex")
  images.push({ file: shot.file, equal: hash(first) === hash(last), changedPixels: null })
}
const pending = images.filter((row) => !row.equal)
if (pending.length) {
  const browser = await chromium.launch({ channel: "chrome", headless: true })
  try {
    const page = await browser.newPage()
    const origin = process.env.CLINIC_TEST_URL || "http://localhost:5173"
    await page.goto(`${origin}/test-results/css-architecture-before/manifest.json`)
    for (const row of pending) {
      const result = await page.evaluate(async ({ file, phase }) => {
        const load = (url) => new Promise((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = url
        })
        const [before, after] = await Promise.all([
          load(`/test-results/css-architecture-before/${file}`),
          load(`/test-results/css-architecture-${phase}/${file}`),
        ])
        if (before.width !== after.width || before.height !== after.height) return { equal: false, changedPixels: -1 }
        const canvas = document.createElement("canvas")
        canvas.width = before.width
        canvas.height = before.height
        const context = canvas.getContext("2d")
        context.drawImage(before, 0, 0)
        const first = context.getImageData(0, 0, canvas.width, canvas.height).data
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(after, 0, 0)
        const last = context.getImageData(0, 0, canvas.width, canvas.height).data
        let changedPixels = 0
        for (let index = 0; index < first.length; index += 4) {
          if (first[index] !== last[index] || first[index + 1] !== last[index + 1] || first[index + 2] !== last[index + 2] || first[index + 3] !== last[index + 3]) changedPixels++
        }
        return { equal: changedPixels === 0, changedPixels }
      }, { file: row.file, phase })
      Object.assign(row, result)
    }
  } finally {
    await browser.close()
  }
}
const report = { phase, references: before.length, compared: after.length, differentMeasurements: differences.length, images: images.length, differentImages: images.filter((row) => !row.equal).length, differences, imageResults: images }
await writeFile(path.join(root, `css-architecture-${phase}-comparison.json`), JSON.stringify(report, null, 2))

const labels = { login: "Login", recovery: "Recuperar contraseña", request: "Solicitar acceso", setup: "Configuración inicial", panel: "Panel", patients: "Pacientes", appointments: "Citas", finance: "Finanzas y Cartera activa", profile: "Mi perfil", institution: "Perfil institucional", clinical: "Historia clínica" }
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClinicApp · Arquitectura CSS</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:0;background:#f7f7f8;color:#17191c}main{max-width:1600px;padding:24px;margin:auto}h1{font-size:24px}nav{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}label{display:grid;gap:4px}select{font:inherit;padding:8px;background:white;color:#17191c;border:1px solid #858c97;border-radius:6px}.images{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{min-width:0;margin:0}img{width:100%;border:1px solid #e1e3e6;border-radius:12px}figcaption{margin-bottom:8px}select:focus-visible{outline:2px solid #007fbd;outline-offset:2px}@media(max-width:768px){.images{grid-template-columns:1fr}}</style>
<main><h1>ClinicApp · Refactorización CSS</h1><p>${report.compared} estados comparados; ${report.differentMeasurements} con diferencias. ${report.images} pares de capturas; ${report.differentImages} con diferencias de píxeles.</p>
<nav aria-label="Comparación"><label>Pantalla<select id="name">${Object.entries(labels).map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label><label>Tema<select id="theme"><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><label>Ancho<select id="width"><option value="390">390 px</option><option value="1440" selected>1440 px</option></select></label></nav>
<div class="images"><figure><figcaption>Antes</figcaption><img id="before" alt="Referencia anterior"></figure><figure><figcaption>Después · ${phase}</figcaption><img id="after" alt="Resultado de la refactorización"></figure></div>
<script>const fields=['name','theme','width'].map(id=>document.getElementById(id));function update(){const [name,theme,width]=fields.map(field=>field.value);const file=name+'-'+theme+'-'+width+'.png';document.getElementById('before').src='css-architecture-before/'+file;document.getElementById('after').src='css-architecture-${phase}/'+file;}fields.forEach(field=>field.addEventListener('change',update));update();</script></main></html>`
await writeFile(path.join(root, `css-architecture-${phase === "after" ? "comparison" : "pilot"}.html`), html)
console.log(JSON.stringify({ phase, compared: report.compared, differentMeasurements: report.differentMeasurements, images: report.images, differentImages: report.differentImages, changedImageFiles: images.filter((row) => !row.equal) }))
if (report.differentMeasurements || report.differentImages) process.exitCode = 1
