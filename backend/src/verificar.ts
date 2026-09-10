// Chequeos de Gastify.
//   npx tsx src/verificar.ts                 -> asserts de la lógica pura, sin red ni base de datos (gratis)
//   npx tsx src/verificar.ts foto1.jpg ...   -> lee boletas reales y muestra qué entendió (~2 centavos por foto)
import "dotenv/config";
import assert from "node:assert";
import fs from "node:fs";
import { readReceipt, sniffMediaType, toResult } from "./whatsapp/ocr.js";
import { signPayload, verifyPayload, signSession } from "./auth.js";
import { parseFecha } from "./gastos/crear.js";

function selfCheck() {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  assert.equal(sniffMediaType(jpeg), "image/jpeg");
  assert.equal(sniffMediaType(png), "image/png");
  assert.equal(sniffMediaType(Buffer.alloc(40)), null, "bytes basura no son una imagen");
  assert.equal(sniffMediaType(Buffer.from([0xff, 0xd8])), null, "un buffer más corto que la firma no debe leerse fuera de rango");

  const completa = toResult({
    legible: true, monto: 89.5, fecha: "12/03/2026",
    proveedor: "TAMBO SAC", rucEmisor: "20512345678", numeroComprobante: "B001-123",
  });
  assert.deepEqual(completa.camposFaltantes, [], "una boleta completa no deja campos pendientes");
  assert.equal(completa.monto, 89.5);

  const parcial = toResult({
    legible: true, monto: null, fecha: "12/03/2026",
    proveedor: "TAMBO SAC", rucEmisor: null, numeroComprobante: "B001-123",
  });
  // Lo que el modelo no leyó tiene que llegar como pendiente, no como cero ni como "".
  assert.deepEqual(parcial.camposFaltantes.sort(), ["monto", "rucEmisor"]);
  assert.equal(parcial.monto, undefined);

  const ilegible = toResult({ legible: false, monto: 42, fecha: null, proveedor: null, rucEmisor: null, numeroComprobante: null });
  assert.equal(ilegible.legible, false);
  assert.equal(ilegible.camposFaltantes.length, 5, "si la foto no se lee, no se aprovecha ningún dato suelto");

  // Un monto de 0 es un valor leído, no un campo faltante: `if (!valor)` rompería esto.
  const cero = toResult({ legible: true, monto: 0, fecha: null, proveedor: null, rucEmisor: null, numeroComprobante: null });
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

function checkFechas() {
  assert.equal(parseFecha("25/12/2025").toISOString().slice(0, 10), "2025-12-25");
  // Sin fecha legible cae a hoy en vez de romper: un gasto con fecha aproximada se corrige,
  // uno que no se pudo registrar obliga al empleado a repetir todo.
  const hoy = new Date().toISOString().slice(0, 10);
  assert.equal(parseFecha(undefined).toISOString().slice(0, 10), hoy);
  assert.equal(parseFecha("no es fecha").toISOString().slice(0, 10), hoy);
  assert.equal(parseFecha("99/99/2025").toISOString().slice(0, 10), hoy, "una fecha imposible no debe pasar como válida");

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
  checkFechas();
} else await leerFotos(rutas);
