// Chequeos de Gastify.
//   npx tsx src/verificar.ts                 -> asserts de la lógica pura, sin red ni base de datos (gratis)
//   npx tsx src/verificar.ts foto1.jpg ...   -> lee boletas reales y muestra qué entendió (~2 centavos por foto)
import "dotenv/config";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { readReceipt, sniffMediaType, toResult } from "./whatsapp/ocr.js";
import { signPayload, verifyPayload, signSession } from "./auth.js";
import { parseFecha } from "./gastos/crear.js";
import { toCsv } from "./csv.js";
import { inferirTipoComprobante, calcularIgv, requiereBancarizacion, igvTrasEdicion } from "./gastos/comprobante.js";

function selfCheck() {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  assert.equal(sniffMediaType(jpeg), "image/jpeg");
  assert.equal(sniffMediaType(png), "image/png");
  assert.equal(sniffMediaType(Buffer.alloc(40)), null, "bytes basura no son una imagen");
  assert.equal(sniffMediaType(Buffer.from([0xff, 0xd8])), null, "un buffer más corto que la firma no debe leerse fuera de rango");

  const completa = toResult({
    legible: true, monto: 89.5, fecha: "12/03/2026", igv: null,
    proveedor: "TAMBO SAC", rucEmisor: "20512345678", numeroComprobante: "B001-123",
  });
  assert.deepEqual(completa.camposFaltantes, [], "una boleta completa no deja campos pendientes");
  assert.equal(completa.monto, 89.5);

  const parcial = toResult({
    legible: true, monto: null, fecha: "12/03/2026", igv: null,
    proveedor: "TAMBO SAC", rucEmisor: null, numeroComprobante: "B001-123",
  });
  // Lo que el modelo no leyó tiene que llegar como pendiente, no como cero ni como "".
  assert.deepEqual(parcial.camposFaltantes.sort(), ["monto", "rucEmisor"]);
  assert.equal(parcial.monto, undefined);

  const ilegible = toResult({ legible: false, monto: 42, fecha: null, proveedor: null, rucEmisor: null, numeroComprobante: null, igv: null });
  assert.equal(ilegible.legible, false);
  assert.equal(ilegible.camposFaltantes.length, 5, "si la foto no se lee, no se aprovecha ningún dato suelto");

  // Un monto de 0 es un valor leído, no un campo faltante: `if (!valor)` rompería esto.
  const cero = toResult({ legible: true, monto: 0, fecha: null, proveedor: null, rucEmisor: null, numeroComprobante: null, igv: null });
  assert.ok(!cero.camposFaltantes.includes("monto"), "monto 0 es un dato leído, no un campo vacío");

  console.log("✓ ocr");
}

function checkTokens() {
  // Un borrador de gasto no puede pasar por invitación ni al revés: si `proposito` no se
  // comprobara, un empleado podría canjear su propio borrador como link de invitación.
  const borrador = signPayload("borrador", { usuarioId: "u1", imagenUrl: "https://x/y.jpg" }, 60);
  assert.equal(verifyPayload<any>("borrador", borrador)?.usuarioId, "u1");
  assert.equal(verifyPayload("invitacion", borrador), null, "un borrador no sirve como invitación");

  const invitacion = signPayload("invitacion", { usuarioId: "u1", huella: "abc" }, 60);
  assert.equal(verifyPayload("borrador", invitacion), null, "una invitación no sirve como borrador");

  // Un token de sesión no lleva `proposito`, así que tampoco entra por esta puerta.
  const sesion = signSession({ id: "u1", rol: "empleado", empresaId: "e1" });
  assert.equal(verifyPayload("borrador", sesion), null, "una sesión no sirve como borrador");

  assert.equal(verifyPayload("borrador", borrador.slice(0, -2) + "xy"), null, "firma alterada se rechaza");
  assert.equal(verifyPayload("borrador", "no-es-un-jwt"), null);
  assert.equal(verifyPayload("borrador", signPayload("borrador", { usuarioId: "u1" }, -1)), null, "token vencido se rechaza");

  console.log("✓ tokens");
}

function checkComprobantes() {
  assert.equal(inferirTipoComprobante("F001-00001234"), "factura");
  assert.equal(inferirTipoComprobante("B001-123"), "boleta");
  assert.equal(inferirTipoComprobante("f001-9"), "factura", "la serie en minúscula es la misma serie");
  assert.equal(inferirTipoComprobante("R001-5"), "recibo_honorarios");
  // Ante la duda, `otro`: clasificar de más hace que el cliente reclame crédito fiscal que no
  // le toca, y eso lo encuentra SUNAT. Clasificar de menos solo espera a que alguien corrija.
  assert.equal(inferirTipoComprobante("0001-123"), "otro", "una serie numérica no se asume factura");
  assert.equal(inferirTipoComprobante(undefined), "otro");
  assert.equal(inferirTipoComprobante(""), "otro");

  // Solo las facturas dan crédito fiscal.
  assert.equal(calcularIgv(118, "boleta"), null, "una boleta no genera IGV reclamable");
  assert.equal(calcularIgv(118, "otro"), null);
  assert.equal(calcularIgv(118, "factura"), 18, "118 con IGV incluido son 100 + 18");
  // El IGV impreso manda sobre el derivado: hay operaciones exoneradas donde la cuenta no aplica.
  assert.equal(calcularIgv(118, "factura", 5), 5, "si el comprobante desglosa el IGV, se respeta");
  assert.equal(calcularIgv(118, "factura", 0), 0, "un IGV de cero es un dato leído, no un dato ausente");

  assert.equal(requiereBancarizacion(2000), false, "el umbral es 'más de', no 'desde'");
  assert.equal(requiereBancarizacion(2000.01), true);

  console.log("✓ comprobantes");
}

function checkIgvAlEditar() {
  const factura = { monto: 118, tipoComprobante: "factura" as const, igv: 18 };

  // Nada que afecte al impuesto se movió: se respeta lo guardado, incluso si no es el 18% exacto.
  assert.equal(igvTrasEdicion(factura, 118, "factura"), 18);
  const exonerada = { monto: 118, tipoComprobante: "factura" as const, igv: 0 };
  assert.equal(igvTrasEdicion(exonerada, 118, "factura"), 0, "un IGV impreso de 0 no se debe 'corregir' a 18");

  // Corregir el monto sin recalcular dejaría 18 de IGV sobre un total de 236: el error que
  // aparece recién cuando el contador cuadra el mes.
  assert.equal(igvTrasEdicion(factura, 236, "factura"), 36, "cambiar el total recalcula el IGV");

  // Reclasificar a boleta borra el crédito fiscal, porque una boleta no lo otorga.
  assert.equal(igvTrasEdicion(factura, 118, "boleta"), null);
  // Y al revés: una boleta reclasificada a factura pasa a tener IGV reclamable.
  const boleta = { monto: 118, tipoComprobante: "boleta" as const, igv: null };
  assert.equal(igvTrasEdicion(boleta, 118, "factura"), 18);

  // Quien revisa manda sobre el cálculo...
  assert.equal(igvTrasEdicion(factura, 118, "factura", 7), 7);
  // ...pero no puede inventar crédito fiscal en un comprobante que no lo da.
  assert.equal(igvTrasEdicion(boleta, 118, "boleta", 18), null, "ni a mano se le pone IGV a una boleta");
  // Poner el IGV explícitamente en null lo borra, no se confunde con "no lo tocaron".
  assert.equal(igvTrasEdicion(factura, 118, "factura", null), 18, "null explícito vuelve a derivar del total");

  console.log("✓ igv al editar");
}

function checkCsv() {
  const csv = toCsv([
    {
      fechaGasto: new Date("2026-03-12T00:00:00Z"), usuario: { nombre: "María Ñañez" },
      categoria: "alimentacion", tipoComprobante: "factura", monto: "1180", igv: "180",
      rucEmisor: "20512345678", razonSocialEmisor: "TAMBO; S.A.C.", numeroComprobante: "F001-9",
      estado: "pagado", fechaPago: new Date("2026-03-20T00:00:00Z"),
    },
    {
      fechaGasto: new Date("2026-03-13T00:00:00Z"), usuario: { nombre: "Jorge" },
      categoria: "movilidad", tipoComprobante: "boleta", monto: "2500.5", igv: null,
      rucEmisor: null, razonSocialEmisor: null, numeroComprobante: null,
      estado: "aprobado", fechaPago: null,
    },
  ]);
  const [cabecera, f1, f2] = csv.split("\r\n");

  assert.ok(csv.startsWith("\uFEFF"), "sin BOM, Excel muestra 'AlimentaciÃ³n' en vez de 'Alimentación'");
  assert.ok(cabecera.includes("IGV;Total"), "el contador necesita el IGV separado del total");

  // Factura: 1180 con 180 de IGV son 1000 de subtotal, con coma decimal para el Excel peruano.
  assert.ok(f1.includes(";1000,00;180,00;1180,00;"), `subtotal/igv/total mal formateados: ${f1}`);
  // La razón social trae el mismo carácter que separa columnas: si no se entrecomilla, la fila
  // entera se corre una columna y el contador ve montos donde van RUC.
  assert.ok(f1.includes('"TAMBO; S.A.C."'), "un ; dentro de un campo debe ir entrecomillado");

  // Boleta: no da crédito fiscal, así que IGV va vacío y subtotal iguala al total.
  assert.ok(f2.includes(";2500,50;;2500,50;"), `una boleta no debe declarar IGV: ${f2}`);
  // Sobre S/ 2000 SUNAT exige medio de pago bancarizado para que el gasto sea deducible.
  assert.ok(f2.includes(";Sí;"), "un gasto sobre S/ 2000 debe quedar marcado para bancarización");
  assert.ok(!f1.includes(";Sí;"), "1180 no llega al umbral de bancarización");

  console.log("✓ csv");
}

function checkGuardaDeStorage() {
  // Sin Supabase, las boletas irían al disco del contenedor, que Vercel y Render borran en cada
  // despliegue. Perder la foto deja un gasto sin sustento ante SUNAT y nadie lo nota hasta que un
  // contador pide el comprobante meses después. En producción el servidor tiene que negarse a
  // arrancar, no funcionar a medias.
  const modulo = path.resolve(import.meta.dirname, "whatsapp/media.ts");
  const correr = (env: Record<string, string>) =>
    spawnSync("npx", ["tsx", "-e", `import(${JSON.stringify(modulo)})`], {
      encoding: "utf8",
      // Se limpia el entorno heredado para que un .env local no falsee el resultado.
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", ...env },
    });

  const sinStorage = correr({ NODE_ENV: "production" });
  assert.notEqual(sinStorage.status, 0, "en producción sin Supabase el arranque debe fallar");
  assert.match(sinStorage.stderr, /Supabase Storage/, "y el error debe decir qué falta");

  const conStorage = correr({ NODE_ENV: "production", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" });
  assert.equal(conStorage.status, 0, `con Supabase configurado debe arrancar: ${conStorage.stderr}`);

  const enDesarrollo = correr({});
  assert.equal(enDesarrollo.status, 0, "en desarrollo sigue funcionando con disco local");

  console.log("✓ guarda de storage");
}

function checkFechas() {
  assert.equal(parseFecha("25/12/2025").toISOString().slice(0, 10), "2025-12-25");
  // Sin fecha legible cae a hoy en vez de romper: un gasto con fecha aproximada se corrige,
  // uno que no se pudo registrar obliga al empleado a repetir todo.
  const hoy = new Date().toISOString().slice(0, 10);
  assert.equal(parseFecha(undefined).toISOString().slice(0, 10), hoy);
  assert.equal(parseFecha("no es fecha").toISOString().slice(0, 10), hoy);
  assert.equal(parseFecha("99/99/2025").toISOString().slice(0, 10), hoy, "una fecha imposible no debe pasar como válida");

  // El <input type="date"> del panel manda AAAA-MM-DD. Sin soportarlo, corregir una fecha a mano
  // la mandaba a hoy sin decir nada.
  assert.equal(parseFecha("2026-03-12").toISOString().slice(0, 10), "2026-03-12");
  // JS acomoda el 30 de febrero al 2 de marzo en vez de fallar; eso no es la fecha que se pidió.
  assert.equal(parseFecha("2025-02-30").toISOString().slice(0, 10), hoy, "el 30 de febrero no existe");
  assert.equal(parseFecha("2025-13-01").toISOString().slice(0, 10), hoy, "no hay mes 13");
  assert.equal(parseFecha("12/03/2026").toISOString().slice(0, 10), "2026-03-12", "DD/MM/AAAA sigue funcionando");

  console.log("✓ fechas");
}

async function leerFotos(rutas: string[]) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Falta ANTHROPIC_API_KEY o ANTHROPIC_AUTH_TOKEN. Ponla en backend/.env y vuelve a correr.");
    process.exit(1);
  }
  for (const ruta of rutas) {
    const t0 = Date.now();
    const r = await readReceipt(fs.readFileSync(ruta));
    console.log(`\n${ruta}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (!r.legible) {
      console.log("  ilegible -> se le pide otra foto al empleado");
      continue;
    }
    console.log(`  monto        ${r.monto ?? "— falta"}`);
    console.log(`  fecha        ${r.fecha ?? "— falta"}`);
    console.log(`  proveedor    ${r.proveedor ?? "— falta"}`);
    console.log(`  RUC          ${r.rucEmisor ?? "— falta"}`);
    console.log(`  comprobante  ${r.numeroComprobante ?? "— falta"}`);
    if (r.camposFaltantes.length) console.log(`  -> le pregunta al empleado: ${r.camposFaltantes.join(", ")}`);
  }
}

const rutas = process.argv.slice(2);
if (rutas.length === 0) {
  selfCheck();
  checkTokens();
  checkComprobantes();
  checkIgvAlEditar();
  checkCsv();
  checkGuardaDeStorage();
  checkFechas();
} else await leerFotos(rutas);
