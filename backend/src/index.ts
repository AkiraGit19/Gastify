import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { empresasRouter } from "./routes/empresas.routes.js";
import { miEmpresaRouter } from "./routes/mi-empresa.routes.js";
import { usuariosRouter } from "./routes/usuarios.routes.js";
import { gastosRouter } from "./routes/gastos.routes.js";
import { whatsappRouter } from "./routes/whatsapp.routes.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(
  express.json({
    // Keep the raw bytes so the WhatsApp webhook can verify Meta's HMAC signature over the exact payload.
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody: Buffer }).rawBody = buf;
    },
  }),
);
app.use("/uploads", express.static(new URL("../uploads", import.meta.url).pathname));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/empresas", empresasRouter);
app.use("/mi-empresa", miEmpresaRouter);
app.use("/usuarios", usuariosRouter);
app.use("/gastos", gastosRouter);
app.use("/whatsapp", whatsappRouter);

export default app;

// Vercel imports this file as a serverless function and calls the exported app directly —
// it must never bind a port itself. VERCEL is set automatically in that environment.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`Gastify backend escuchando en http://localhost:${port}`));
}
