// Prueba de extremo a extremo contra un servidor vivo y la base de desarrollo.
//
//   1) PORT=4100 npx tsx src/index.ts
//   2) npx tsx src/verificar-e2e.ts
//
// Es repetible: cada corrida usa correos y bytes de imagen distintos, y borra lo que creó. Sin
// credenciales de OCR toda subida cae al paso "falta el monto", lo que la vuelve determinista
// y gratis. Complementa a verificar.ts, que prueba la lógica pura sin red ni base de datos.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

// Rutas relativas al módulo y no al cwd, para que el script corra desde donde sea.
const RAIZ = path.resolve(import.meta.dirname, "../..");
const BACKEND = path.resolve(import.meta.dirname, "..");
const API = "http://localhost:4100";
let fallos = 0;
const SUFIJO = Date.now();

function check(nombre: string, ok: boolean, detalle: unknown = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${nombre}${ok ? "" : "  <-- " + JSON.stringify(detalle)}`);
  if (!ok) fallos++;
}
function seccion(t: string) { console.log(`\n${t}`); }

// Cuenta lo que hay guardado, sea en Supabase o en el disco de desarrollo.
async function contarArchivos(): Promise<number> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/boletas`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1000 }),
    });
    return ((await r.json()) as unknown[]).length;
  }
  const dir = path.join(BACKEND, "uploads");
  return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
}

async function borrarImagen(imagenUrl: string) {
  const local = imagenUrl.split("/uploads/")[1];
  if (local) {
    fs.rmSync(path.join(BACKEND, "uploads", local), { force: true });
    return;
  }
  const nombre = imagenUrl.split("/boletas/")[1];
  if (nombre && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/boletas/${nombre}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
  }
}

async function j(path: string, opts: RequestInit = {}, token?: string) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}
const post = (p: string, b: unknown, t?: string) => j(p, { method: "POST", body: JSON.stringify(b) }, t);
const patch = (p: string, b: unknown, t?: string) => j(p, { method: "PATCH", body: JSON.stringify(b) }, t);

const ARCHIVOS = ["066A42A6-746F-4361-952C-55CCC3A24631.jpg", "50A77318-25F3-49BF-A5F3-AD0BB167199A.jpg", "5E077763-C405-4F37-B38E-97FE2FD12AFA.jpg"].map((f) => path.join(RAIZ, f));

// Cada corrida usa bytes distintos: si no, la segunda choca contra las fotos que subió la
// primera y el detector de duplicados —haciendo bien su trabajo— vuelve la prueba irrepetible.
// El sufijo va al final del JPEG, donde los decodificadores lo ignoran.
const cache = new Map<number, Buffer>();
function foto(i: number): Buffer {
  if (!cache.has(i)) cache.set(i, Buffer.concat([fs.readFileSync(ARCHIVOS[i % ARCHIVOS.length]), Buffer.from(`e2e-${SUFIJO}-${i}`)]));
  return cache.get(i)!;
}

// Sube una foto y completa el monto. Sin credenciales de OCR todo cae al paso "falta_monto",
// lo que hace la prueba determinista y gratis.
async function crearGasto(token: string, indice: number, monto: number) {
  const form = new FormData();
  form.append("foto", new Blob([new Uint8Array(foto(indice))], { type: "image/jpeg" }), "b.jpg");
  const subida = await j("/gastos", { method: "POST", body: form }, token);
  if (subida.body.estado !== "falta_monto") return subida;
  return post("/gastos/borrador", { borrador: subida.body.borrador, monto }, token);
}

// ---------------------------------------------------------------- preparación
const owner = (await post("/auth/login", { email: "owner@gastify.test", password: "gastify2026" })).body.token;
const admin = (await post("/auth/login", { email: "akirasan.office@gmail.com", password: "gastify2026" })).body.token;
check("super_admin y admin entran", Boolean(owner && admin));

const emp = (await post("/usuarios", { nombre: `E2E ${SUFIJO}`, email: `e2e-emp-${SUFIJO}@t.test`, rol: "empleado" }, admin)).body;
const apr = (await post("/usuarios", { nombre: `A2E ${SUFIJO}`, email: `e2e-apr-${SUFIJO}@t.test`, rol: "aprobador" }, admin)).body;
await patch(`/usuarios/${emp.id}`, { aprobadorId: apr.id }, admin);

async function activar(id: string, password: string) {
  const url = (await post(`/usuarios/${id}/invitacion`, {}, admin)).body.url;
  const token = new URL(url).searchParams.get("token")!;
  return (await post("/auth/invitacion", { token, password })).body.token as string;
}
const tEmp = await activar(emp.id, "clave-empleado-1");
const tApr = await activar(apr.id, "clave-aprobador-1");
check("empleado y aprobador activados por link", Boolean(tEmp && tApr));

// ---------------------------------------------------------------- A3 duplicados
seccion("A3 · duplicados");
const g1 = await crearGasto(tEmp, 0, 118);
check("primer gasto se registra", g1.status === 201, g1.body);

const g1bis = await crearGasto(tEmp, 0, 250);
check("la MISMA foto se rechaza aunque el monto sea otro", g1bis.status === 409, g1bis.body);

// La imagen se sube ANTES de saber que el comprobante está duplicado, así que un rechazo tiene
// que llevarse su archivo. Sin esto, cada intento repetido deja basura en el almacenamiento del
// cliente, que además la paga.
const huerfanas = await contarArchivos();
const g1ter = await crearGasto(tEmp, 0, 300);
check("un tercer intento también se rechaza", g1ter.status === 409, g1ter.body);
check("y el rechazo no deja la foto huérfana en el almacenamiento", (await contarArchivos()) === huerfanas, `antes ${huerfanas}, después ${await contarArchivos()}`);

const g2 = await crearGasto(tEmp, 1, 118);
const detalle2 = await j(`/gastos/${g2.body.gastoId}`, {}, tEmp);
// Mismo empleado, mismo monto, mismo día: no se bloquea, se manda a revisión humana.
check("mismo monto+día del mismo empleado va a revisión", detalle2.body.estado === "pendiente_validacion", detalle2.body.estado);

// ---------------------------------------------------------------- B1 comprobante e IGV
seccion("B1 · tipo de comprobante e IGV");
const conFactura = await patch(`/gastos/${g1.body.gastoId}`, { numeroComprobante: "F001-123", rucEmisor: "20512345678" }, tApr);
check("corregir la serie reclasifica a factura", conFactura.body.tipoComprobante === "factura", conFactura.body.tipoComprobante);
check("y calcula el IGV: 118 -> 18", Number(conFactura.body.igv) === 18, conFactura.body.igv);

const subeMonto = await patch(`/gastos/${g1.body.gastoId}`, { monto: 236 }, tApr);
check("cambiar el total recalcula el IGV a 36", Number(subeMonto.body.igv) === 36, subeMonto.body.igv);

const aBoleta = await patch(`/gastos/${g1.body.gastoId}`, { numeroComprobante: "B001-9" }, tApr);
check("reclasificar a boleta borra el crédito fiscal", aBoleta.body.igv === null && aBoleta.body.tipoComprobante === "boleta", aBoleta.body);

// El bug que tumbaba el servidor: editar hacia un comprobante que ya existe choca contra el
// índice único, Express 4 no atrapaba el rechazo del handler async y Node mataba el proceso.
const gastoRival = await crearGasto(tEmp, 2, 77);
// g1 quedó como (20512345678, B001-9) en el paso anterior. Empujar otro gasto a esa misma
// identidad es lo que hace saltar el índice único.
const choque = await patch(`/gastos/${gastoRival.body.gastoId}`, { rucEmisor: "20512345678", numeroComprobante: "B001-9" }, tApr);
check("editar hacia un comprobante repetido responde 409, no 500", choque.status === 409, choque.body);
const vivo = await j("/health");
check("y el servidor sigue en pie después", vivo.status === 200, vivo.body);

// ---------------------------------------------------------------- A1 permisos de edición
seccion("A1 · quién puede editar qué");
const ajeno = await crearGasto(tEmp, 3, 50);
const otroEmpleado = (await post("/usuarios", { nombre: `X ${SUFIJO}`, email: `e2e-x-${SUFIJO}@t.test`, rol: "empleado" }, admin)).body;
const tOtro = await activar(otroEmpleado.id, "clave-otro-111");
const intentoAjeno = await patch(`/gastos/${ajeno.body.gastoId}`, { monto: 999 }, tOtro);
check("un empleado no puede editar el gasto de otro", intentoAjeno.status === 403, intentoAjeno.body);

const empleadoContable = await patch(`/gastos/${ajeno.body.gastoId}`, { tipoComprobante: "factura" }, tEmp);
check("un empleado no fija el tipo de comprobante", empleadoContable.status === 403, empleadoContable.body);

const empleadoMonto = await patch(`/gastos/${ajeno.body.gastoId}`, { monto: 75.5 }, tEmp);
check("pero sí corrige su propio monto", empleadoMonto.status === 200 && Number(empleadoMonto.body.monto) === 75.5, empleadoMonto.body);

const fechaMal = await patch(`/gastos/${ajeno.body.gastoId}`, { fechaGasto: "2026-02-30" }, tEmp);
check("una fecha imposible no revienta el endpoint", fechaMal.status === 200, fechaMal.body);

// ---------------------------------------------------------------- auditoría
seccion("A1 · auditoría");
const conHistorial = await j(`/gastos/${g1.body.gastoId}`, {}, admin);
check("cada cambio queda registrado con autor", conHistorial.body.ediciones?.length >= 4, conHistorial.body.ediciones?.length);
const edicionMonto = conHistorial.body.ediciones?.find((e: any) => e.campo === "monto");
check("el historial guarda el valor anterior", edicionMonto?.valorAnterior === "118", edicionMonto);
check("y quién lo hizo", edicionMonto?.usuario?.nombre?.startsWith("A2E"), edicionMonto?.usuario);

const sinCambios = await patch(`/gastos/${g1.body.gastoId}`, { monto: 236 }, tApr);
const trasNoop = await j(`/gastos/${g1.body.gastoId}`, {}, admin);
check("guardar sin cambiar nada no ensucia el historial", trasNoop.body.ediciones.length === conHistorial.body.ediciones.length, sinCambios.body);

// ---------------------------------------------------------------- B2 pagos
seccion("B2 · aprobar y pagar");
const pagarSinAprobar = await post("/gastos/pagar", { ids: [g1.body.gastoId] }, admin);
check("no se puede pagar algo que nadie aprobó", pagarSinAprobar.body.pagados === 0 && pagarSinAprobar.body.omitidos === 1, pagarSinAprobar.body);

await post(`/gastos/${g1.body.gastoId}/decision`, { decision: true }, tApr);
const pagado = await post("/gastos/pagar", { ids: [g1.body.gastoId] }, admin);
check("un gasto aprobado se marca como pagado", pagado.body.pagados === 1, pagado.body);

const trasPago = await j(`/gastos/${g1.body.gastoId}`, {}, admin);
check("queda en estado pagado con fecha", trasPago.body.estado === "pagado" && Boolean(trasPago.body.fechaPago), trasPago.body.estado);

const editarPagado = await patch(`/gastos/${g1.body.gastoId}`, { monto: 1 }, admin);
check("un gasto pagado ya no se puede modificar", editarPagado.status === 403, editarPagado.body);

const pagarPorAprobador = await post("/gastos/pagar", { ids: [g2.body.gastoId] }, tApr);
check("un aprobador no registra pagos", pagarPorAprobador.status === 403, pagarPorAprobador.body);

// ---------------------------------------------------------------- anulación
seccion("A1 · anular");
const anularPorEmpleado = await post(`/gastos/${g2.body.gastoId}/anular`, { motivo: "porque sí" }, tEmp);
check("un empleado no puede anular", anularPorEmpleado.status === 403, anularPorEmpleado.body);

const sinMotivo = await post(`/gastos/${g2.body.gastoId}/anular`, { motivo: "" }, admin);
check("anular exige un motivo", sinMotivo.status === 400, sinMotivo.body);

const anulado = await post(`/gastos/${g2.body.gastoId}/anular`, { motivo: "cargado dos veces" }, admin);
check("el admin anula con motivo", anulado.status === 200 && anulado.body.estado === "anulado", anulado.body);

const anularPagado = await post(`/gastos/${g1.body.gastoId}/anular`, { motivo: "x" }, admin);
check("un gasto ya pagado no se anula", anularPagado.status === 400, anularPagado.body);

const reSubir = await crearGasto(tEmp, 1, 300);
check("tras anular, la misma foto se puede volver a subir", reSubir.status === 201, reSubir.body);

// ---------------------------------------------------------------- A2 recuperación
seccion("A2 · recuperación de acceso del admin");
const empresas = await j("/empresas", {}, owner);
const empresaId = empresas.body[0].id;
const admins = await j(`/empresas/${empresaId}/administradores`, {}, owner);
check("el super_admin lista los admins de una empresa", admins.status === 200 && admins.body.length > 0, admins.body);

const porAdmin = await j(`/empresas/${empresaId}/administradores`, {}, admin);
check("un admin de empresa no accede a esa ruta", porAdmin.status === 403, porAdmin.status);

const accesoAjeno = await post(`/empresas/${empresaId}/administradores/${emp.id}/acceso`, {}, owner);
check("no se genera acceso para quien no es admin de esa empresa", accesoAjeno.status === 404, accesoAjeno.body);

// ---------------------------------------------------------------- B3 intentos
seccion("B3 · límite de intentos");
const victima = (await post("/usuarios", { nombre: `V ${SUFIJO}`, email: `e2e-v-${SUFIJO}@t.test`, rol: "empleado", password: "clave-victima-9" }, admin)).body;
let ultimo: any;
for (let i = 0; i < 9; i++) ultimo = await post("/auth/login", { email: victima.email, password: "incorrecta" });
check("los intentos fallidos siguen respondiendo lo mismo", ultimo.status === 401, ultimo.body);

const bloqueado = await post("/auth/login", { email: victima.email, password: "clave-victima-9" });
check("tras 8 fallos, la contraseña correcta avisa del bloqueo", bloqueado.status === 429, bloqueado.body);

const inexistente = await post("/auth/login", { email: `no-existe-${SUFIJO}@t.test`, password: "x" });
check("un correo inexistente responde igual que uno bloqueado", inexistente.status === 401, inexistente.body);

const urlRescate = (await post(`/usuarios/${victima.id}/invitacion`, {}, admin)).body.url;
const tokRescate = new URL(urlRescate).searchParams.get("token")!;
const rescatado = await post("/auth/invitacion", { token: tokRescate, password: "clave-nueva-77" });
check("el link de invitación desbloquea la cuenta", rescatado.status === 200 && Boolean(rescatado.body.token), rescatado.body);

// ---------------------------------------------------------------- regresiones
seccion("Regresiones");
const mios = await j("/gastos", {}, tEmp);
check("el empleado sigue viendo solo lo suyo", mios.body.every((g: any) => g.usuarioId === emp.id), mios.body.length);

const csv = await fetch(`${API}/gastos/export.csv`, { headers: { Authorization: `Bearer ${admin}` } });
const bytes = new Uint8Array(await csv.arrayBuffer());
const texto = new TextDecoder().decode(bytes);
check("el CSV se exporta", csv.status === 200);
// Se comprueba en bytes: Response.text() de fetch elimina el BOM por especificación, así que
// mirar la cadena decodificada diría que no está aunque sí viaje.
check("con BOM para que Excel lea los acentos", bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, [...bytes.slice(0, 3)]);
check("y declara charset utf-8", (csv.headers.get("content-type") ?? "").includes("charset=utf-8"), csv.headers.get("content-type"));
check("y con las columnas del contador", texto.includes("IGV;Total;Requiere bancarización"), texto.split("\r\n")[0]);

const csvEmpleado = await fetch(`${API}/gastos/export.csv`, { headers: { Authorization: `Bearer ${tEmp}` } });
check("un empleado no exporta la contabilidad", csvEmpleado.status === 403);

const sinAuth = await j("/gastos/pagar", { method: "POST", body: JSON.stringify({ ids: ["x"] }) });
check("las rutas nuevas exigen sesión", sinAuth.status === 401);

seccion("Limpieza");
const { db } = await import("./db.js");
const usuariosPrueba = await db.usuario.findMany({ where: { email: { startsWith: "e2e-" } }, select: { id: true } });
const ids = usuariosPrueba.map((u) => u.id);
const gastosPrueba = await db.gasto.findMany({ where: { usuarioId: { in: ids } }, select: { id: true, imagenUrl: true } });
await db.edicionGasto.deleteMany({ where: { gastoId: { in: gastosPrueba.map((g) => g.id) } } });
await db.aprobacion.deleteMany({ where: { gastoId: { in: gastosPrueba.map((g) => g.id) } } });
await db.gasto.deleteMany({ where: { usuarioId: { in: ids } } });
await db.usuario.deleteMany({ where: { id: { in: ids } } });
const empresasPrueba = await db.empresa.findMany({ where: { razonSocial: "X", ruc: "20512345678" }, select: { id: true } });
for (const e of empresasPrueba) {
  await db.usuario.deleteMany({ where: { empresaId: e.id } });
  await db.empresa.delete({ where: { id: e.id } });
}
// Con Supabase configurado las fotos de prueba van al bucket real, así que hay que borrarlas
// de ahí también: si no, cada corrida deja basura en el almacenamiento de producción.
for (const g of gastosPrueba) {
  await borrarImagen(g.imagenUrl);
}
await db.$disconnect();
console.log(`  ✓ borrados ${gastosPrueba.length} gastos y ${ids.length} usuarios de prueba`);

// ---------------------------------------------------------------- filtros y monitoreo
seccion("Filtros del servidor");
// La pantalla de aprobaciones ya no se baja todos los gastos para filtrarlos en el navegador.
const pendientes = await j("/gastos?estado=pendiente,pendiente_validacion", {}, admin);
check("se pueden pedir varios estados a la vez", pendientes.status === 200 && pendientes.body.every((g: any) => ["pendiente", "pendiente_validacion"].includes(g.estado)), pendientes.body.map?.((g: any) => g.estado));

const unoSolo = await j("/gastos?estado=aprobado", {}, admin);
check("y un estado suelto sigue funcionando", unoSolo.status === 200 && unoSolo.body.every((g: any) => g.estado === "aprobado"));

// Antes el valor iba crudo a Prisma y un estado inventado reventaba la consulta.
const inventado = await j("/gastos?estado=inventado", {}, admin);
check("un estado inexistente da 400, no un 500", inventado.status === 400, inventado.body);
const mezcla = await j("/gastos?estado=pendiente,inventado", {}, admin);
check("y basta uno malo en la lista para rechazarla", mezcla.status === 400, mezcla.body);

seccion("Monitoreo");
const dupEmail = `e2e-dup-${SUFIJO}@t.test`;
await post("/usuarios", { nombre: "Dup", email: dupEmail, rol: "empleado" }, admin);
const repetido = await post("/usuarios", { nombre: "Dup", email: dupEmail, rol: "empleado" }, admin);
check("un correo repetido explica el problema en vez de dar 500", repetido.status === 409, repetido.body);

const empresaRepetida = await post("/empresas", { razonSocial: "X", ruc: "20512345678", adminNombre: "A", adminEmail: `e2e-adm-${SUFIJO}@t.test`, adminPassword: "clave-larga-1" }, owner);
const empresaOtraVez = await post("/empresas", { razonSocial: "X", ruc: "20512345678", adminNombre: "A", adminEmail: `e2e-adm2-${SUFIJO}@t.test`, adminPassword: "clave-larga-1" }, owner);
check("un RUC de empresa repetido también", empresaOtraVez.status === 409, empresaOtraVez.body);

const erroresComoAdmin = await j("/monitoreo/errores", {}, admin);
check("un admin de empresa no ve los errores de la plataforma", erroresComoAdmin.status === 403, erroresComoAdmin.status);
const erroresSinSesion = await j("/monitoreo/errores");
check("ni nadie sin sesión", erroresSinSesion.status === 401);
const erroresComoOwner = await j("/monitoreo/errores", {}, owner);
check("el dueño de la plataforma sí", erroresComoOwner.status === 200 && Array.isArray(erroresComoOwner.body), erroresComoOwner.status);

// El registro agrupa por huella: el mismo fallo repetido suma al contador en vez de crear filas.
const { registrarError } = await import("./monitoreo.js");
const { db: dbErr } = await import("./db.js");
const rutaPrueba = `/prueba-${SUFIJO}`;
await registrarError(new Error("fallo de prueba"), rutaPrueba, "GET");
await registrarError(new Error("fallo de prueba"), rutaPrueba, "GET");
await registrarError(new Error("otro fallo"), rutaPrueba, "GET");
const guardados = await dbErr.errorRegistrado.findMany({ where: { ruta: rutaPrueba } });
check("el mismo error dos veces es una fila con contador 2", guardados.length === 2 && guardados.some((e) => e.conteo === 2), guardados.map((e) => e.conteo));
await dbErr.errorRegistrado.deleteMany({ where: { ruta: rutaPrueba } });

// ---------------------------------------------------------------- WhatsApp
// El bot comparte la creación de gastos con el panel (gastos/crear.ts). Sin esta regresión, un
// refactor de esa lógica compartida puede romper WhatsApp sin que nadie se entere.
seccion("WhatsApp");
const { db: dbWa } = await import("./db.js");
const MEDIA_DIR = path.join(BACKEND, "test-media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const SUF = Date.now();
const origen = ARCHIVOS[0];
fs.writeFileSync(`${MEDIA_DIR}/wa-${SUF}.jpg`, Buffer.concat([fs.readFileSync(origen), Buffer.from(`wa-${SUF}`)]));

const empresaWa = await dbWa.empresa.findFirstOrThrow();
const tel = `51900${String(SUF).slice(-6)}`;
const usuarioWa = await dbWa.usuario.create({
  data: { empresaId: empresaWa.id, nombre: `WA ${SUF}`, email: `e2e-wa-${SUF}@t.test`, rol: "empleado", telefonoWhatsapp: tel, passwordHash: "x" },
});

// El webhook responde 200 al instante y procesa después, así que hay que esperar al EFECTO, no
// a un reloj. Con un sleep fijo la prueba se rompía en cuanto el trabajo de fondo creció —pasó
// al agregar las consultas a SUNAT— y el fallo parecía del bot, no del cronómetro.
async function esperarA(condicion: () => Promise<boolean>, segundos = 25): Promise<boolean> {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    if (await condicion()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function enviarWa(mensaje: unknown, hasta?: () => Promise<boolean>) {
  await fetch(`${API}/whatsapp/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry: [{ changes: [{ value: { messages: [mensaje] } }] }] }),
  });
  if (hasta) await esperarA(hasta);
  else await new Promise((r) => setTimeout(r, 250));
}

const conversacionAbierta = () => dbWa.conversacionWA.findUnique({ where: { usuarioId: usuarioWa.id } }).then(Boolean);
await enviarWa({ from: tel, type: "image", image: { id: `wa-${SUF}.jpg` } }, conversacionAbierta);
check("la foto abre una conversación", await conversacionAbierta());

// Sin OCR configurado el bot pide cada campo a mano, que es el mismo camino de una boleta ilegible.
// Cada respuesta avanza un paso de la conversación; se espera a que el paso cambie en la base.
let pasoPrevio = (await dbWa.conversacionWA.findUnique({ where: { usuarioId: usuarioWa.id } }))?.datos;
for (const valor of ["118", "12/03/2026", "TAMBO SAC", "20512345678", "F001-500"]) {
  await enviarWa({ from: tel, type: "text", text: { body: valor } }, async () => {
    const c = await dbWa.conversacionWA.findUnique({ where: { usuarioId: usuarioWa.id } });
    const cambio = JSON.stringify(c?.datos) !== JSON.stringify(pasoPrevio);
    if (cambio) pasoPrevio = c?.datos;
    return cambio;
  });
}
await enviarWa({ from: tel, type: "interactive", interactive: { button_reply: { id: "confirmar" } } }, async () =>
  (await dbWa.conversacionWA.findUnique({ where: { usuarioId: usuarioWa.id } }))?.paso === "esperando_categoria");

// El último paso consulta SUNAT dos veces, así que puede tardar varios segundos.
await enviarWa({ from: tel, type: "interactive", interactive: { button_reply: { id: "alimentacion" } } }, () =>
  dbWa.gasto.findFirst({ where: { usuarioId: usuarioWa.id } }).then(Boolean));

const gastoWa = await dbWa.gasto.findFirst({ where: { usuarioId: usuarioWa.id } });
check("el bot sigue creando gastos tras el refactor", Boolean(gastoWa), gastoWa);
check("con el monto que dictó el empleado", Number(gastoWa?.monto) === 118, gastoWa?.monto);
check("y la categoría que eligió", gastoWa?.categoria === "alimentacion", gastoWa?.categoria);
check("clasifica F001 como factura", gastoWa?.tipoComprobante === "factura", gastoWa?.tipoComprobante);
check("y le calcula el IGV", Number(gastoWa?.igv) === 18, gastoWa?.igv);
check("guarda la huella de la imagen", Boolean(gastoWa?.imagenHash), gastoWa?.imagenHash);

// El comprobante F001-500 del RUC de prueba no existe en SUNAT. Con la key configurada, eso tiene
// que quedar anotado y el gasto irse a revisión humana — nunca aprobarse solo ni rechazarse solo.
if (process.env.SUNAT_VALIDATION_API_KEY) {
  check("un comprobante que SUNAT no reconoce queda observado", Boolean(gastoWa?.observacionSunat), gastoWa?.observacionSunat);
  check("y el gasto va a revisión, no pasa derecho", gastoWa?.estado === "pendiente_validacion", gastoWa?.estado);
  check("sin marcarlo como validado", gastoWa?.validadoSunat === false, gastoWa?.validadoSunat);
} else {
  console.log("  – sin SUNAT_VALIDATION_API_KEY: no se comprueba la verificación de comprobantes");
}

if (gastoWa) await dbWa.gasto.delete({ where: { id: gastoWa.id } });
await dbWa.conversacionWA.deleteMany({ where: { usuarioId: usuarioWa.id } });
await dbWa.usuario.delete({ where: { id: usuarioWa.id } });
fs.rmSync(`${MEDIA_DIR}/wa-${SUF}.jpg`, { force: true });
if (gastoWa) await borrarImagen(gastoWa.imagenUrl);
await dbWa.$disconnect();

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
