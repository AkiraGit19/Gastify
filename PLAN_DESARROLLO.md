# Gastify — Plan de desarrollo

Estado real del proyecto y hoja de ruta. Este documento se actualiza a medida que avanza el desarrollo — no es una foto fija. Ver también `spec_tecnica_mvp_rendicion_gastos.md` (reglas de negocio v1) y `docs/superpowers/specs/2026-08-19-gastify-mvp-design.md` (decisiones de arquitectura y diseño visual).

---

## Fase 0 — MVP v1: estado actual

### Construido y probado end-to-end (funciona en local ahora mismo)
- Login sin contraseña (magic link por email)
- Multi-empresa real: super_admin crea empresas, cada una con sus datos completamente aislados
- 4 roles con vista propia: super_admin (panel de plataforma), admin (dashboard + equipo + export), aprobador (solo su cola de aprobación, solo ve a quienes le reportan), empleado (solo sus gastos)
- CRUD de gastos, aprobaciones, equipo
- Exportación CSV
- Dashboard con gráfico de gastos por categoría
- Detección de comprobante duplicado (mismo RUC + número)

### Construido pero sin activar (falta que consigas las cuentas externas — código ya listo)
- **WhatsApp (Meta Cloud API):** webhook completo, máquina de conversación (foto → confirmar datos → categoría → envío a aprobación), verificación de firma HMAC. Falta: cuenta de Meta Business + número de prueba.
- **OCR (Google Cloud Vision):** extracción de RUC, monto, fecha, comprobante. Sin la key, cae automáticamente al flujo de "confírmame cada dato a mano" (mismo camino que usa cuando el OCR real falla). Falta: cuenta de Google Cloud.
- **SUNAT:** validación de RUC activo/habido. Sin la key, todo gasto queda en `pendiente_validacion` (nunca se pierde ni se bloquea). Falta: cuenta en apiperu.dev o similar.
- **Imágenes:** Cloudinary. Sin configurar, guarda localmente en `backend/uploads/`.

### Pendiente antes de poder decir "listo para el piloto" (criterio de aceptación de la spec original, sección 9)
1. Probar con una boleta real (no seed data) de punta a punta
2. Probar los 6 casos borde de la spec (foto borrosa, boleta duplicada, número no registrado, caída de SUNAT/OCR, mensaje de texto en vez de foto, más de un aprobador — este último ya bloqueado por diseño)
3. Configurar `WHATSAPP_APP_SECRET`, `JWT_SECRET` de producción, y las demás env vars reales
4. Desplegar a Neon + Render (ver README para el paso a paso)

---

## Fase 1 — Lo que agregaste ahora (features estilo Khipu, organizadas por a quién sirven)

Todavía no construido. Está ordenado por audiencia porque así lo planteaste, y porque cada bloque tiene un dueño distinto dentro de la MIPE cliente.

### 1.1 Para el colaborador (quien gasta)
- [ ] Carga de PDF/XML compartido desde WhatsApp/galería (hoy el bot solo procesa fotos) — requiere extender el webhook para aceptar `document` además de `image`, y un parser de XML de factura electrónica (formato UBL de SUNAT) además del OCR de imagen
- [ ] Ampliar categorías más allá de las 4 actuales — **ver conflicto abajo, necesito tu decisión antes de tocar el modelo de datos**

### 1.2 Para el administrador/dueño
- [ ] **Módulo de rendición y reembolsos líquidos**: rastrear si la empresa le debe dinero al empleado (gastó de su bolsillo) o si el empleado debe sustentar un adelanto que ya recibió (efectivo/Yape/Plin). Esto es un concepto nuevo en el modelo de datos — hoy un gasto solo tiene estado aprobado/rechazado/pendiente, no un balance de quién le debe a quién.
- [ ] **Presupuestos mensuales por empleado y categoría** (ej. "Juan: S/200/mes en movilidad"), con aviso al empleado antes de que registre un gasto que se pase del tope

### 1.3 Cumplimiento tributario (el diferenciador frente a la competencia)
- [ ] La validación de RUC activo/habido contra SUNAT ya existe (Fase 0) — falta solo la API key real
- [ ] **Alertas de "gasto no deducible"**: detectar cuando un comprobante no cumple el principio de causalidad o excede los topes de SUNAT para boletas de venta / gastos de contingencia. Esto requiere reglas de negocio específicas que no están en la spec original — necesito que me las definas o las investigue contigo antes de construir, porque un error aquí le genera una multa real a tu cliente.

### 1.4 Para el contador externo (canal de venta, según tu nota)
- [ ] **Exportación enriquecida**: separar Base Imponible e IGV en el CSV (hoy solo exporta el monto total) — cambio simple una vez sepamos si el monto se guarda con o sin IGV desglosado
- [ ] **Repositorio de fotos/PDFs por mes**, descargable como link — sencillo de construir sobre Cloudinary/almacenamiento ya existente
- [ ] Esto probablemente implica un **rol nuevo (contador)**, de solo lectura sobre reportes y repositorio, sin acceso a aprobar/gestionar equipo — no existe todavía en el modelo de 4 roles

---

## Conflictos y decisiones abiertas (antes de empezar la Fase 1)

1. **Categorías:** la spec original define 4 (Movilidad, Alimentación, Hospedaje, Otros — ya usadas en todo el bot de WhatsApp y el dashboard). Lo que pasaste ahora sugiere otras 5: Alimentación, Transporte, Combustible, Herramientas, Útiles de Oficina. Son listas distintas, no una extensión de la misma. Necesito que definas la lista final antes de tocar el modelo de datos y los mensajes del bot, porque cambiarla implica migrar los gastos ya sembrados y reescribir los botones de WhatsApp.
2. **Rol contador:** ¿es un usuario más dentro de la empresa (como aprobador/empleado), o un acceso separado tipo "invitado" sin necesidad de que el admin le cree cuenta formal?
3. **Reembolsos líquidos:** ¿el saldo se calcula automático a partir del historial de aprobados, o hay un paso manual donde el admin marca "ya le pagué a Juan"?

No voy a construir nada de la Fase 1 todavía — quedó claro que era para "más adelante". Este documento es la referencia para cuando digas que arranquemos.
