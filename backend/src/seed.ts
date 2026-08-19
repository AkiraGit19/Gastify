import "dotenv/config";
import { db } from "./db.js";

async function main() {
  await db.conversacionWA.deleteMany();
  await db.aprobacion.deleteMany();
  await db.gasto.deleteMany();
  await db.magicLink.deleteMany();
  await db.usuario.deleteMany();
  await db.empresa.deleteMany();

  await db.usuario.create({
    data: { nombre: "Tú (dueño de Gastify)", email: "owner@gastify.test", rol: "super_admin", telefonoWhatsapp: null },
  });

  const acme = await db.empresa.create({
    data: { razonSocial: "Acme Consultores S.A.C.", ruc: "20123456789" },
  });

  const admin = await db.usuario.create({
    data: { empresaId: acme.id, nombre: "Akira Sánchez", email: "akirasan.office@gmail.com", rol: "admin", telefonoWhatsapp: "51900000001" },
  });

  const aprobador = await db.usuario.create({
    data: { empresaId: acme.id, nombre: "Carlos Mendoza", email: "carlos@acme.test", rol: "aprobador", telefonoWhatsapp: "51900000002" },
  });

  const empleado1 = await db.usuario.create({
    data: {
      empresaId: acme.id,
      nombre: "Lucía Fernández",
      email: "lucia@acme.test",
      rol: "empleado",
      telefonoWhatsapp: "51900000003",
      aprobadorId: aprobador.id,
    },
  });

  const empleado2 = await db.usuario.create({
    data: {
      empresaId: acme.id,
      nombre: "Jorge Salazar",
      email: "jorge@acme.test",
      rol: "empleado",
      telefonoWhatsapp: "51900000004",
      aprobadorId: aprobador.id,
    },
  });

  const placeholderImg = "https://placehold.co/400x560/e6f4fb/2fa8d6?text=Boleta";

  const gastosData = [
    { usuarioId: empleado1.id, monto: 25.5, categoria: "movilidad", estado: "pendiente", dias: 1, proveedor: "Taxi Seguro SAC" },
    { usuarioId: empleado1.id, monto: 340, categoria: "hospedaje", estado: "aprobado", dias: 5, proveedor: "Hotel Costa del Sol" },
    { usuarioId: empleado1.id, monto: 68.9, categoria: "alimentacion", estado: "rechazado", dias: 3, proveedor: "Restaurante El Fogón" },
    { usuarioId: empleado2.id, monto: 120, categoria: "otros", estado: "pendiente_validacion", dias: 0, proveedor: "Ferretería Central" },
    { usuarioId: empleado2.id, monto: 45, categoria: "movilidad", estado: "pendiente", dias: 2, proveedor: "Taxi Seguro SAC" },
    { usuarioId: empleado2.id, monto: 210.75, categoria: "alimentacion", estado: "aprobado", dias: 7, proveedor: "Supermercados Peruanos" },
  ] as const;

  for (const [i, g] of gastosData.entries()) {
    await db.gasto.create({
      data: {
        empresaId: acme.id,
        usuarioId: g.usuarioId,
        monto: g.monto,
        fechaGasto: new Date(Date.now() - g.dias * 86_400_000),
        categoria: g.categoria,
        rucEmisor: "2010000" + (1000 + i),
        razonSocialEmisor: g.proveedor,
        numeroComprobante: `F00${i + 1}-${1000 + i}`,
        imagenUrl: placeholderImg,
        estado: g.estado,
        validadoSunat: g.estado === "aprobado",
      },
    });
  }

  console.log("Seed listo.");
  console.log("Login con magic link (revisa la consola del backend para el link) usando estos emails:");
  console.log(`  super_admin: owner@gastify.test`);
  console.log(`  admin:     ${admin.email}`);
  console.log(`  aprobador: ${aprobador.email}`);
  console.log(`  empleado:  ${empleado1.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
