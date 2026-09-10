import "dotenv/config";
import { db } from "./db.js";
import { hashPassword } from "./auth.js";

// ponytail: throwaway test-data script for manual QA, not part of the real seed flow.
const PASSWORD = "gastify2026";

async function main() {
  const empresa = await db.empresa.findFirst();
  if (!empresa) throw new Error("No hay ninguna empresa. Corre `npm run seed` primero.");

  const passwordHash = await hashPassword(PASSWORD);

  const maria = await db.usuario.upsert({
    where: { email: "admin@acme-demo.test" },
    update: {},
    create: {
      empresaId: empresa.id,
      nombre: "María Torres",
      email: "admin@acme-demo.test",
      rol: "aprobador",
      telefonoWhatsapp: "51900000099",
      passwordHash,
    },
  });

  const empleado = await db.usuario.upsert({
    where: { email: "empleado.maria@acme.test" },
    update: { aprobadorId: maria.id },
    create: {
      empresaId: empresa.id,
      nombre: "Empleado de María",
      email: "empleado.maria@acme.test",
      rol: "empleado",
      telefonoWhatsapp: "51900000098",
      aprobadorId: maria.id,
      passwordHash,
    },
  });

  const pendientes = [
    { monto: 55.0, categoria: "movilidad" as const, proveedor: "Taxi Seguro SAC", dias: 0 },
    { monto: 320.0, categoria: "hospedaje" as const, proveedor: "Hotel Costa del Sol", dias: 1 },
    { monto: 89.9, categoria: "alimentacion" as const, proveedor: "Restaurante El Fogón", dias: 2 },
    { monto: 12500.0, categoria: "hospedaje" as const, proveedor: "Hotel Marriott Lima", dias: 3 },
    { monto: 18900.0, categoria: "otros" as const, proveedor: "Consultora Andina SAC", dias: 4 },
    { monto: 24300.5, categoria: "otros" as const, proveedor: "Equipos Industriales del Perú", dias: 5 },
    { monto: 15750.0, categoria: "movilidad" as const, proveedor: "Flota Corporativa Lima", dias: 6 },
    { monto: 32800.0, categoria: "hospedaje" as const, proveedor: "Hotel Delfines Convention Center", dias: 7 },
    { monto: 9800.75, categoria: "alimentacion" as const, proveedor: "Catering Corporativo Perú", dias: 8 },
    { monto: 45200.0, categoria: "otros" as const, proveedor: "Importadora Tecno SAC", dias: 9 },
  ];

  for (const [i, g] of pendientes.entries()) {
    const rucEmisor = "20999" + (9000 + i);
    const numeroComprobante = `MT00${i + 1}-${9000 + i}`;
    await db.gasto.upsert({
      where: {
        empresaId_rucEmisor_numeroComprobante: { empresaId: empresa.id, rucEmisor, numeroComprobante },
      },
      update: {},
      create: {
        empresaId: empresa.id,
        usuarioId: empleado.id,
        monto: g.monto,
        fechaGasto: new Date(Date.now() - g.dias * 86_400_000),
        categoria: g.categoria,
        rucEmisor,
        razonSocialEmisor: g.proveedor,
        numeroComprobante,
        imagenUrl: "https://placehold.co/400x560/e6f4fb/2fa8d6",
        estado: "pendiente",
      },
    });
  }

  console.log("Listo. Login como aprobador:");
  console.log(`  email: ${maria.email}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  ${pendientes.length} gastos pendientes de "${empleado.nombre}" esperando aprobación.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
