# Gastify — MVP

Rendición de gastos vía WhatsApp. Ver `docs/superpowers/specs/2026-08-19-gastify-mvp-design.md` para el diseño completo y `spec_tecnica_mvp_rendicion_gastos.md` para las reglas de negocio originales.

## Requisitos

- Node.js 22+
- Postgres corriendo localmente (o cualquier `DATABASE_URL` de Postgres)

## Arranque rápido (local, sin ninguna API key)

```bash
# 1. Instalar dependencias (backend + frontend, vía npm workspaces)
npm install

# 2. Backend: variables de entorno y base de datos
cd backend
cp .env.example .env   # ajusta DATABASE_URL si tu usuario de Postgres es distinto
npx prisma migrate dev
npm run seed            # crea una empresa demo con usuarios y gastos de ejemplo
npm run dev              # http://localhost:4000

# 3. Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm run dev               # http://localhost:5173
```

## Login

No hay contraseñas: se usa magic link por email. Mientras no configures `RESEND_API_KEY`, el enlace se imprime en la consola del backend en vez de enviarse por correo — cópialo y pégalo en el navegador.

Usuarios creados por el seed:

| Rol | Email |
|---|---|
| super_admin (dueño de la plataforma) | owner@gastify.test |
| admin (Acme Consultores) | admin@acme.test |
| aprobador | carlos@acme.test |
| empleado | lucia@acme.test |

## Qué funciona ya vs. qué necesita tus API keys

Funciona completamente en local, sin ninguna cuenta externa:
- Dashboard, gastos, aprobaciones, equipo, exportación CSV, multi-empresa (super_admin).

Necesita credenciales reales para activarse (mientras tanto degrada con gracia, tal como pide la spec):
- **WhatsApp:** sin `WHATSAPP_API_TOKEN`, los mensajes salientes del bot solo se imprimen en la consola del backend (`[whatsapp:out]`). El webhook y toda la máquina de conversación ya están implementados — solo falta conectar credenciales reales de Meta.
- **OCR:** sin `GOOGLE_VISION_API_KEY`, el bot pasa directo al flujo de "confírmame cada dato a mano" (el mismo camino que usa cuando el OCR real no logra leer un campo).
- **SUNAT:** sin `SUNAT_VALIDATION_API_KEY`, todo gasto nuevo queda en estado `pendiente_validacion` (nunca se pierde ni se bloquea, tal como exige la spec).
- **Imágenes:** sin `CLOUDINARY_URL`, las fotos de boletas se guardan localmente en `backend/uploads/`.

## Próximos pasos para probar el flujo de WhatsApp real

1. Crear cuenta en [Meta for Developers](https://developers.facebook.com/) y un número de prueba (gratis, hasta 5 destinatarios verificados sin necesidad de verificación de negocio completa).
2. Crear cuenta en Google Cloud y habilitar Vision API (capa gratuita ~1000 imágenes/mes).
3. Conseguir una API key de validación SUNAT (ej. apiperu.dev).
4. Completar `backend/.env` con esas credenciales — no se necesita ningún cambio de código.

## Deploy gratuito (cuando quieras probar con el cliente piloto)

- Backend: Render (free web service)
- Base de datos: Neon (Postgres serverless, free tier sin expiración)
- Frontend: Render (free static site)
- Imágenes: Cloudinary (free tier)
