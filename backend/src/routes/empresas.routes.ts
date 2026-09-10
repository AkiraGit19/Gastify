import { asyncRouter } from "../async-router.js";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireRole, hashPassword } from "../auth.js";
import { crearLinkInvitacion } from "../invitaciones.js";

export const empresasRouter = asyncRouter();

empresasRouter.use(requireAuth, requireRole("super_admin"));

empresasRouter.get("/", async (_req, res) => {
  const empresas = await db.empresa.findMany({
    orderBy: { fechaAlta: "desc" },
    include: { _count: { select: { usuarios: true, gastos: true } } },
  });
  res.json(empresas);
});

const createSchema = z.object({
  razonSocial: z.string().min(1),
  ruc: z.string().min(8),
  adminNombre: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

empresasRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { razonSocial, ruc, adminNombre, adminEmail, adminPassword } = parsed.data;
  const passwordHash = await hashPassword(adminPassword);

  const empresa = await db.empresa.create({
    data: {
      razonSocial,
      ruc,
      usuarios: {
        create: { nombre: adminNombre, email: adminEmail, rol: "admin", passwordHash },
      },
    },
    include: { usuarios: { select: { id: true, nombre: true, email: true, rol: true } } },
  });

  res.status(201).json(empresa);
});

// Sin esto, un admin de empresa que olvida su contraseña queda fuera para siempre: el router de
// /usuarios está limitado al rol `admin` y con alcance a su propia empresa, así que el super_admin
// no llega. La única salida era editar la base a mano.
empresasRouter.get("/:id/administradores", async (req, res) => {
  const empresa = await db.empresa.findUnique({ where: { id: req.params.id } });
  if (!empresa) return res.status(404).json({ error: "Empresa no encontrada" });

  const admins = await db.usuario.findMany({
    where: { empresaId: empresa.id, rol: "admin" },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, email: true, activo: true },
  });
  res.json(admins);
});

empresasRouter.post("/:id/administradores/:usuarioId/acceso", async (req, res) => {
  // El usuarioId se compara contra la empresa de la URL: sin esto, el id de un empleado de otra
  // empresa serviría para pedir un link a su cuenta.
  const usuario = await db.usuario.findFirst({
    where: { id: req.params.usuarioId, empresaId: req.params.id, rol: "admin" },
  });
  if (!usuario) return res.status(404).json({ error: "Ese administrador no pertenece a esa empresa" });
  if (!usuario.activo) return res.status(400).json({ error: "Esa cuenta está dada de baja" });

  res.json(crearLinkInvitacion(usuario));
});
