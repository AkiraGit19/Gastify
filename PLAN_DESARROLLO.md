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
- [ ] Migrar a las 7 categorías finales (ver decisión #1 abajo)

### 1.2 Para el administrador/dueño
- [ ] **Módulo de rendición y reembolsos líquidos**: rastrear si la empresa le debe dinero al empleado (gastó de su bolsillo) o si el empleado debe sustentar un adelanto que ya recibió (efectivo/Yape/Plin). Saldo con paso manual (ver decisión #3).
- [ ] **Presupuestos mensuales por empleado y categoría** (ej. "Juan: S/200/mes en movilidad"), con aviso al empleado antes de que registre un gasto que se pase del tope

### 1.3 Cumplimiento tributario (el diferenciador frente a la competencia)
- [ ] La validación de RUC activo/habido contra SUNAT ya existe (Fase 0) — falta solo la API key real
- [ ] **Alertas de "gasto no deducible"**: detectar cuando un comprobante no cumple el principio de causalidad o excede los topes de SUNAT para boletas de venta / gastos de contingencia. Esto requiere reglas de negocio específicas que no están en la spec original — necesito que me las definas o las investigue contigo antes de construir, porque un error aquí le genera una multa real a tu cliente. Sigue abierto hasta que tengamos esas reglas exactas.

### 1.4 Para el contador externo (canal de venta, según tu nota)
- [ ] **Exportación enriquecida**: separar Base Imponible e IGV en el CSV (hoy solo exporta el monto total) — cambio simple una vez sepamos si el monto se guarda con o sin IGV desglosado
- [ ] **Repositorio de fotos/PDFs por mes**, descargable como link — sencillo de construir sobre Cloudinary/almacenamiento ya existente
- [ ] **Rol nuevo: contador** — de solo lectura sobre reportes y repositorio de toda la empresa, sin poder aprobar ni gestionar equipo (ver decisión #2)

---

## Decisiones tomadas

**1. Categorías — lista final (7, fusiona ambas listas):**
Movilidad/Transporte · Combustible · Alimentación · Hospedaje · Herramientas y Materiales · Útiles de Oficina · Otros.
Razón: junté las dos listas en vez de elegir una — cubren gastos distintos (viáticos vs. flota vs. insumos) y una MIPE real tiene los dos tipos. Queda justo en el techo de "5 a 7" que tú mismo marcaste como límite práctico. Migración de las 4 actuales es directa (renombrar movilidad→Movilidad/Transporte, las otras 3 igual) — nada se pierde. Efecto colateral real que hay que arreglar de todas formas: con 7 categorías el bot ya no puede usar botones de WhatsApp (Meta limita a 3 por mensaje) — hay que pasar esa pregunta a un mensaje de lista (soporta hasta 10), cambio necesario sin importar cuántas categorías queden.

**2. Aprobador y contador — los dejo como roles separados, no el mismo.**
Entiendo la intuición de fusionarlos (ambos "revisan gastos"), pero su alcance es opuesto: el aprobador es interno, decide (aprueba/rechaza), y solo debe ver a la gente que le reporta a él — un jefe de área no debería poder exportar los gastos de toda la empresa. El contador es externo, de solo lectura, pero necesita ver TODO (para armar la declaración de impuestos completa), no un subconjunto. Fusionarlos significaría darle a un tercero externo poder de aprobar gastos (riesgo real), o darle a cada jefe de área acceso a los sueldos/gastos de departamentos que no le corresponden. Es un rol nuevo, pero barato de agregar: mismo mecanismo de scope por empresa que ya existe, solo sin permiso de escritura.

**3. Reembolsos líquidos — paso manual confirmado.** El admin marca "ya le pagué a Juan"; no se intenta automatizar la conciliación bancaria en v1 de esta fase.

No voy a construir nada de la Fase 1 todavía — quedó claro que era para "más adelante". Este documento es la referencia para cuando digas que arranquemos.
