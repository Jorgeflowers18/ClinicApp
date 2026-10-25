import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const root = path.resolve("test-results")
const prefix = process.argv[2] || "design-system"
if (!["design-system", "premium"].includes(prefix)) throw new Error("Use design-system or premium")
const before = JSON.parse(await readFile(path.join(root, `${prefix}-before/manifest.json`), "utf8"))
const after = JSON.parse(await readFile(path.join(root, `${prefix}-after/manifest.json`), "utf8"))
const pairs = after.filter((current) => before.some((old) => old.file === current.file))
const allLabels = { panel: "Panel", patients: "Pacientes", appointments: "Citas", inventory: "Inventario", finance: "Finanzas", reports: "Reportes", clinical: "Historia clínica", login: "Login", recovery: "Recuperar contraseña", request: "Solicitar acceso", setup: "Configuración inicial", profile: "Mi perfil", institution: "Perfil institucional" }
const labels = Object.fromEntries(Object.entries(allLabels).filter(([name]) => pairs.some((pair) => pair.name === name)))
const data = JSON.stringify(pairs)
const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClinicApp · Comparación visual</title>
<style>
body{margin:0;background:#f5f6f8;color:#161718;font:15px/1.5 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:24px}h1{font-size:24px;margin:0 0 8px}p{color:#59616b}.controls{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0}label{display:grid;gap:4px}select{font:inherit;padding:10px;border:1px solid #858c97;border-radius:6px;background:white;color:#161718}.images{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;min-width:0}figcaption{margin-bottom:8px;font-weight:600}img{width:100%;height:auto;display:block;border:1px solid #d9dde4;border-radius:12px;background:white}a{color:#5350cc}select:focus-visible,a:focus-visible{outline:2px solid #6366f1;outline-offset:3px}@media(max-width:760px){main{padding:16px}.images{grid-template-columns:1fr}}
</style></head><body><main>
<h1>ClinicApp · Antes y después</h1><p>Capturas del mismo módulo, tema y ancho. Los datos utilizados son los de prueba del proyecto.</p>
<div class="controls"><label>Módulo<select id="module">${Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
<label>Tema<select id="theme"><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
<label>Ancho<select id="width"><option value="390">Móvil · 390 px</option><option value="1440" selected>Escritorio · 1440 px</option></select></label></div>
<div class="images"><figure><figcaption>Antes · <a id="before-link" target="_blank" rel="noopener">Abrir captura</a></figcaption><img id="before" alt="Estado anterior"></figure><figure><figcaption>Después · <a id="after-link" target="_blank" rel="noopener">Abrir captura</a></figcaption><img id="after" alt="Estado actualizado"></figure></div>
<p id="description" aria-live="polite"></p>
<script>
const pairs=${data};const fields=['module','theme','width'].map(id=>document.getElementById(id));
function update(){const [module,theme,width]=fields.map(field=>field.value);const pair=pairs.find(item=>item.name===module&&item.theme===theme&&item.width===Number(width));if(!pair)return;for(const phase of ['before','after']){const src='${prefix}-'+phase+'/'+pair.file;document.getElementById(phase).src=src;document.getElementById(phase+'-link').href=src;}document.getElementById('description').textContent=pair.route+' · '+width+' px · '+(theme==='dark'?'Oscuro':'Claro');}fields.forEach(field=>field.addEventListener('change',update));update();
</script></main></body></html>`
await writeFile(path.join(root, `${prefix}-comparison.html`), html)
console.log(JSON.stringify({ comparisons: pairs.length, output: path.join(root, `${prefix}-comparison.html`) }))
