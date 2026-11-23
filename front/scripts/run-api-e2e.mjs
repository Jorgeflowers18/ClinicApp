// Pruebas E2E contra el back real, con una base de datos propia que se crea al empezar y se borra al terminar.
//
//   npm run test:e2e                       todas las pruebas
//   npm run test:e2e -- tests/auth.spec.ts  argumentos extra para Playwright
//
// Pasos: 1) borra `clinicapp_e2e` si quedó de una corrida anterior, 2) la crea con todas las migraciones,
// 3) levanta la API (Development: crea las cuentas de prueba, profesionales y consultorios) y un Vite propio,
// 4) corre Playwright y 5) SIEMPRE apaga todo y borra la base, aunque las pruebas fallen o se corte con Ctrl+C.
//
// Seguridad: el nombre de la base es fijo (`clinicapp_e2e`) y el servidor debe ser local. Si la cadena de
// conexión apunta a otra base o a otro servidor, el script se niega a correr: nunca puede tocar la base de
// desarrollo (`clinicapp`), la de las pruebas del back (`clinicapp_test`) ni la de producción.
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, realpathSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const DATABASE = "clinicapp_e2e"
const API_PORT = 5100
const WEB_PORT = 5185
// Ruta real del disco: en Windows, "c:\…" y "C:\…" son la misma carpeta pero Vite las trataría como módulos distintos.
const front = realpathSync.native(resolve(dirname(fileURLToPath(import.meta.url)), ".."))
const back = resolve(front, "../back")
const apiProject = resolve(back, "src/ClinicApp.Api")

// Mismo servidor que el contenedor de desarrollo (`clinicapp-db`). Solo se pueden cambiar el puerto y las
// credenciales locales; el nombre de la base y el servidor no.
const host = process.env.E2E_DB_HOST ?? "localhost"
const port = process.env.E2E_DB_PORT ?? "5433"
const user = process.env.E2E_DB_USER ?? "clinicapp"
const password = process.env.E2E_DB_PASSWORD ?? "clinicapp_dev"
/** El contenedor de PostgreSQL de desarrollo (`back/docker-compose.yml`). */
const container = process.env.E2E_DB_CONTAINER ?? "clinicapp-db"
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`E2E: el servidor de la base debe ser local (es "${host}"). No se corre nada.`)
  process.exit(2)
}
const connection = `Host=${host};Port=${port};Database=${DATABASE};Username=${user};Password=${password}`
if (!connection.includes(`;Database=${DATABASE};`)) process.exit(2)

const isWindows = process.platform === "win32"
const children = []
const attachments = mkdtempSync(join(tmpdir(), "clinicapp-e2e-"))
let cleaned = false

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: isWindows, ...options })
  return result.status ?? 1
}

function start(command, args, env) {
  const child = spawn(command, args, { cwd: front, env: { ...process.env, ...env }, shell: isWindows, stdio: ["ignore", "pipe", "pipe"] })
  child.stdout.on("data", (chunk) => { if (process.env.E2E_VERBOSE) process.stdout.write(chunk) })
  child.stderr.on("data", (chunk) => { if (process.env.E2E_VERBOSE) process.stderr.write(chunk) })
  children.push(child)
  return child
}

/** Aplica las migraciones a la base E2E (el nombre se verificó arriba). `dotnet ef` es una herramienta local del back. */
function migrate() {
  return run("dotnet", ["ef", "database", "update", "--project", apiProject, "--connection", `"${connection}"`, "--no-build"], { cwd: back })
}

/** SQL en la base `postgres` del contenedor. Solo se usa con sentencias sobre `clinicapp_e2e`, escritas aquí. */
function psql(sql) {
  return spawnSync("docker", ["exec", container, "psql", "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" })
}

/** ¿Existe todavía la base E2E? `null` si no se pudo consultar. */
function databaseExists() {
  const result = psql(`SELECT 1 FROM pg_database WHERE datname = '${DATABASE}'`)
  return result.status === 0 ? result.stdout.trim() === "1" : null
}

function dropDatabase() {
  console.log(`E2E: borrando la base ${DATABASE}…`)
  // WITH (FORCE) cierra las conexiones que pudieran quedar abiertas.
  const result = psql(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`)
  if (result.status !== 0 || databaseExists() !== false) {
    console.error(`E2E: NO se pudo borrar ${DATABASE}. Bórrala a mano: docker exec ${container} psql -U ${user} -d postgres -c "DROP DATABASE ${DATABASE} WITH (FORCE)"`)
    process.exitCode = 1
  } else {
    console.log(`E2E: base ${DATABASE} borrada.`)
  }
}

function cleanup() {
  if (cleaned) return
  cleaned = true
  for (const child of children) {
    if (child.exitCode !== null) continue
    // En Windows, `shell: true` deja procesos hijos: se cierra el árbol completo.
    if (isWindows) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
    else child.kill("SIGTERM")
  }
  dropDatabase()
  rmSync(attachments, { recursive: true, force: true })
}

process.on("SIGINT", () => { cleanup(); process.exit(130) })
process.on("SIGTERM", () => { cleanup(); process.exit(143) })

async function waitFor(url, label, timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try { if ((await fetch(url)).ok) return } catch { /* aún no responde */ }
    await new Promise((done) => setTimeout(done, 1000))
  }
  throw new Error(`${label} no respondió en ${timeoutMs / 1000} s (${url})`)
}

/**
 * Abre la app antes de las pruebas: Vite optimiza las dependencias en la primera carga y no durante las pruebas.
 * Si la optimización termina a mitad de la carga, la página puede quedar en blanco: se reintenta recargando.
 * Si no carga, muestra los errores de la página y lo que se ve en ella.
 */
async function warmUp(url, attempts = 3) {
  const { chromium } = await import("@playwright/test")
  const browser = await chromium.launch({ channel: "chrome" })
  try {
    const page = await browser.newPage()
    const problems = []
    page.on("pageerror", (error) => problems.push(`error: ${error.message}`))
    page.on("console", (message) => { if (message.type() === "error") problems.push(`consola: ${message.text()}`) })
    page.on("requestfailed", (request) => problems.push(`petición fallida: ${request.url()} (${request.failure()?.errorText})`))
    for (let attempt = 1; ; attempt++) {
      try {
        await page.goto(url)
        await page.locator("#email").waitFor({ timeout: 60_000 })
        return
      } catch (error) {
        for (const problem of problems.splice(0, 10)) console.log(`E2E:   ${problem}`)
        const shown = await page.evaluate(() => `${location.pathname} · ${document.body.innerText.replace(/\s+/g, " ").slice(0, 200)}`).catch(() => "")
        console.log(`E2E:   la página muestra: ${shown || "(nada)"}`)
        if (attempt >= attempts) throw error
        console.log(`E2E: la app aún no carga (intento ${attempt} de ${attempts}), se recarga…`)
      }
    }
  } finally {
    await browser.close()
  }
}

let status = 1
try {
  console.log("E2E: compilando la API…")
  if (run("dotnet", ["build", apiProject, "-v", "q", "-nologo"]) !== 0) throw new Error("No compila la API")
  dropDatabase() // por si quedó de una corrida anterior
  console.log(`E2E: creando ${DATABASE} con las migraciones…`)
  if (migrate() !== 0) throw new Error(`No se pudo crear ${DATABASE}`)

  start("dotnet", ["run", "--project", apiProject, "--no-build", "--no-launch-profile"], {
    ASPNETCORE_ENVIRONMENT: "Development",
    ASPNETCORE_URLS: `http://127.0.0.1:${API_PORT}`,
    ConnectionStrings__Default: connection,
    Cors__AllowedOrigins__0: `http://127.0.0.1:${WEB_PORT}`,
    Attachments__RootPath: attachments,
    Notifications__Provider: "log",
    // La suite inicia sesión desde la pantalla más de 20 veces por minuto: solo esta API sube el límite.
    RateLimits__AuthPerMinute: "1000",
    Logging__LogLevel__Default: "Warning",
  })
  // Caché de dependencias nueva en cada corrida (ver scripts/vite.e2e.config.ts).
  rmSync(join(front, "node_modules", ".vite-e2e"), { recursive: true, force: true, maxRetries: 5 })
  start("npx", ["vite", "--config", "scripts/vite.e2e.config.ts", "--host", "127.0.0.1", "--port", String(WEB_PORT), "--strictPort"], {
    VITE_API_BASE_URL: `http://127.0.0.1:${API_PORT}/api`,
  })
  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`, "La API")
  await waitFor(`http://127.0.0.1:${WEB_PORT}/`, "Vite")
  await warmUp(`http://127.0.0.1:${WEB_PORT}/login`)

  console.log("E2E: corriendo Playwright…")
  status = run("npx", ["playwright", "test", ...process.argv.slice(2)], {
    cwd: front,
    env: { ...process.env, CLINIC_TEST_URL: `http://127.0.0.1:${WEB_PORT}`, E2E_API_URL: `http://127.0.0.1:${API_PORT}/api` },
  })
} catch (error) {
  console.error(`E2E: ${error instanceof Error ? error.message : error}`)
  status = 1
} finally {
  cleanup()
}
process.exit(status || Number(process.exitCode ?? 0))
