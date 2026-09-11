import { asyncRouter } from "../async-router.js";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const monitoreoRouter = asyncRouter();

// Solo el dueño de la plataforma: los errores llevan rutas y mensajes internos que no le
// corresponden al administrador de una empresa cliente.
monitoreoRouter.use(requireAuth, requireRole("super_admin"));

monitoreoRouter.get("/errores", async (_req, res) => {
  const errores = await db.errorRegistrado.findMany({
    orderBy: { ultimaVez: "desc" },
    take: 50,
  });
  res.json(errores);
});

// Se resuelve borrando: no hay flujo de "reabrir", y un error que vuelve a ocurrir se registra
// solo otra vez. Menos estado que mantener que una columna de "resuelto".
monitoreoRouter.delete("/errores/:id", async (req, res) => {
  await db.errorRegistrado.deleteMany({ where: { id: req.params.id } });
  res.json({ ok: true });
});
