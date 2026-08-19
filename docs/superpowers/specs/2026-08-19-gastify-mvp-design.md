# Gastify — Diseño MVP (Rendición de Gastos vía WhatsApp)

Fuente de verdad para el desarrollo. Complementa (no reemplaza) `spec_tecnica_mvp_rendicion_gastos.md`, que sigue vigente para reglas de negocio, casos borde y criterios de aceptación. Este documento agrega las decisiones tomadas en la sesión de brainstorming: multi-tenant, hosting, login, y sistema de diseño.

---

## 1. Objetivo

Un empleado registra un gasto empresarial mandando una foto de su boleta por WhatsApp. El sistema lee los datos automáticamente (OCR), valida contra SUNAT, lo envía a aprobación del jefe correspondiente, y queda visible en un dashboard web para finanzas.

Plataforma multi-empresa desde el día 1: el objetivo de negocio es vender esto a múltiples clientes, no solo al piloto.

---

## 2. Alcance v1

Igual al definido en `spec_tecnica_mvp_rendicion_gastos.md` secciones 2, 6 y 7 (flujos y casos borde no cambian). Cambios respecto a ese documento:

- **Multi-tenant desde v1** (la spec original asumía posible ambigüedad de escala; se resuelve aquí: sí, multi-empresa ya).
- **Login:** magic link por **email** (no WhatsApp) para v1 — no depende de que la verificación de Meta Business esté lista para poder entrar al dashboard.

---

## 3. Roles

- **super_admin** — dueño de la plataforma (tú). Crea empresas nuevas y su primer admin. No pertenece a ninguna empresa.
- **admin** — administra una empresa: alta/baja de empleados, asignación de aprobador, ve todos los gastos de su empresa, exporta.
- **aprobador** — aprueba/rechaza gastos de las personas que le reportan.
- **empleado** — registra gastos vía WhatsApp, ve solo los suyos en el dashboard.

---

## 4. Aislamiento multi-tenant

Toda fila de `usuarios`, `gastos`, `aprobaciones` pertenece a una `empresa_id`. Regla dura: **ninguna query de negocio se ejecuta sin filtrar por empresa_id**, aplicado en una sola capa central (middleware/helper de acceso a datos), no repetido manualmente en cada endpoint — así una pantalla nueva no puede "olvidarse" del filtro.

El teléfono de WhatsApp (`telefono_whatsapp`) es único a nivel global del sistema (no por empresa) — así el bot resuelve la empresa automáticamente al recibir un mensaje, sin configuración manual.

---

## 5. Modelo de datos

- **empresas**: id, razón_social, ruc, fecha_alta
- **usuarios**: id, empresa_id, nombre, telefono_whatsapp (único global), email (único), rol (super_admin/admin/aprobador/empleado), aprobador_id
- **gastos**: id, usuario_id, empresa_id, monto, fecha_gasto, categoria, ruc_emisor, razon_social_emisor, numero_comprobante, imagen_url, estado (pendiente/aprobado/rechazado/pendiente_validacion), validado_sunat (bool), fecha_creacion
  - Único: (ruc_emisor, numero_comprobante) — detección de duplicados sin depender de que SUNAT responda
- **aprobaciones**: id, gasto_id, aprobador_id, decision, fecha_decision, comentario
- **magic_links**: id, usuario_id, token, expira_en, usado (bool) — mecanismo de login sin contraseña

---

## 6. Stack e infraestructura (gratis para probar)

- **Backend:** Node.js + Express + TypeScript. Un solo servicio: expone la API del dashboard y el webhook de WhatsApp.
- **Base de datos:** Postgres en **Neon** (free tier serverless, no expira por inactividad como el free de Render).
- **Frontend:** React + Vite, desplegado como static site gratis en Render.
- **Imágenes:** Cloudinary free tier.
- **Backend hosting:** Render free web service (duerme tras 15 min sin tráfico — aceptable en fase de prueba; migrar a plan pago cuando el piloto sea real).
- **OCR:** Google Cloud Vision API (free tier ~1000 imágenes/mes).
- **Validación SUNAT:** API de terceros (apiperu.dev o similar).
- **WhatsApp:** Meta Cloud API, modo de prueba (número de prueba + hasta 5 destinatarios verificados) mientras no haya verificación de negocio completa.

Migración futura a AWS + otra DB: sin lock-in relevante — Postgres estándar (dump/restore a RDS), Express dockerizable, frontend es build estático portable.

---

## 7. Sistema de diseño

**Paleta:**
| Uso | Hex |
|---|---|
| Fondo de página | `#F6FAFD` |
| Superficie/cards | `#FFFFFF` |
| Texto principal | `#0F1B2E` |
| Marca / acento | `#2FA8D6` |
| Texto secundario / iconos inactivos | `#64748B` |
| Estado: pendiente aprobación | `#F5A623` |
| Estado: aprobado | `#22C55E` |
| Estado: rechazado | `#EF4444` |

**Tipografía:** Inter (UI general, tablas, texto) + JetBrains Mono (montos, RUC, número de comprobante — alineación numérica precisa, refuerza la sensación de "recibo").

**Layout:** sidebar blanca con ítem activo resaltado en celeste suave, contenido sobre `#F6FAFD`, cards blancas redondeadas con sombra sutil. KPIs arriba (pendientes, aprobados, total), lista/tabla de gastos con pills de estado por color.

**Elemento de firma:** miniatura de boleta recién llegada muestra una línea celeste que la "escanea" de arriba a abajo mientras el sistema la está leyendo (OCR/SUNAT en curso) — representa el proceso real, no es decorativo.

**Iconos:** Lucide (contorno, trazo uniforme).

**Animación:** hover lift sutil en cards, contadores que suben al cargar el dashboard, transiciones suaves entre pantallas, toasts deslizantes. Se respeta `prefers-reduced-motion`.

---

## 8. Variables de entorno

```
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
GOOGLE_VISION_API_KEY=
SUNAT_VALIDATION_API_KEY=
DATABASE_URL=
CLOUDINARY_URL=
JWT_SECRET=
RESEND_API_KEY=
```

---

## 9. Criterio de aceptación

Igual a la sección 9 de `spec_tecnica_mvp_rendicion_gastos.md`, más:

6. Un super_admin puede crear una segunda empresa de prueba y confirmar que ningún dato (empleados, gastos) se mezcla con la primera.
