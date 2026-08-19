# Especificación técnica — MVP Rendición de Gastos vía WhatsApp

Este documento es la fuente de verdad para el desarrollo. El objetivo es un sistema funcional para un piloto real con un cliente (empresa con ~40-80 empleados), no un prototipo de juguete. Prioridad: que funcione correctamente en los casos reales de uso, no que tenga muchas features.

---

## 1. Objetivo del producto

Permitir que un empleado registre un gasto empresarial enviando una foto de su boleta/factura por WhatsApp, sin instalar ninguna app. El sistema debe leer automáticamente los datos de la boleta, validarla contra SUNAT, enviarla a aprobación del jefe correspondiente, y dejar todo visible en un dashboard web para el área de finanzas/contabilidad.

---

## 2. Alcance del MVP (v1) — no construir más que esto

### Incluido en v1
- Registro de gasto por WhatsApp (foto → lectura automática → categorización → envío a aprobación)
- Flujo de aprobación por WhatsApp (botones sí/no) y por dashboard web
- Validación de comprobante contra SUNAT (existe, no está duplicado)
- Dashboard web con login para: empleados (ver sus propios gastos), aprobadores (aprobar/rechazar), admin/finanzas (ver todo, exportar)
- Exportación de reportes a CSV/Excel
- Panel de administración simple: alta de empresas, alta de empleados, asignación de aprobador

### Explícitamente FUERA de v1 (no construir, no sugerir, no "mejorar" solo)
- Integración directa con ERPs (Concar, SAP, etc.)
- Tarjetas corporativas conectadas
- App móvil nativa
- Multi-idioma
- Roles y permisos granulares más allá de: empleado / aprobador / admin
- Notificaciones por email (todo es WhatsApp + dashboard)
- Recuperación de contraseña compleja (usar magic link simple por email o WhatsApp)

Si durante el desarrollo surge la tentación de agregar algo de esta lista, no hacerlo sin consultar primero.

---

## 3. Stack técnico recomendado

- **Backend:** Node.js con Express (o Fastify) — TypeScript preferido para reducir errores en tiempo de ejecución
- **Base de datos:** PostgreSQL (relacional, porque hay relaciones claras: empresa → empleados → gastos → aprobaciones)
- **Frontend dashboard:** React + Vite, o Next.js si se prefiere SSR simple. UI minimalista, sin librerías pesadas innecesarias
- **Hosting inicial:** Railway o Render (planes gratuitos/baratos, fácil de desplegar, suficiente para 1 cliente piloto)
- **Almacenamiento de imágenes:** Cloudinary (tiene capa gratuita) o S3-compatible barato — NO guardar imágenes en el servidor de la app directamente

---

## 4. Integraciones externas — detalle exacto

### 4.1 WhatsApp Business API (Meta Cloud API)
- Usar **Meta Cloud API directamente**, NO un BSP de pago (Twilio, 360dialog) para el MVP — evita costo mensual fijo innecesario en fase piloto
- Requiere: cuenta de Meta Business, número de prueba (sandbox) para desarrollo, verificación de negocio real antes de ir a producción con el cliente piloto
- Flujo técnico:
  1. Webhook recibe mensaje entrante (imagen) del empleado
  2. Sistema descarga la imagen vía Media API de WhatsApp
  3. Sistema responde usando mensajes de texto libre (gratis dentro de la ventana de 24h porque el usuario inició la conversación)
  4. Para notificaciones proactivas (recordatorio de aprobación pendiente) usar plantillas de tipo "utility" pre-aprobadas por Meta
- **Importante:** las plantillas de mensaje deben pre-aprobarse en Meta Business Manager antes de poder usarse — esto toma días, debe hacerse ANTES de la fecha de piloto, no el mismo día

### 4.2 OCR — lectura de boletas
- Usar Google Cloud Vision API (OCR + detección de texto), capa gratuita cubre ~1,000 imágenes/mes
- El sistema debe extraer: RUC del emisor, razón social, fecha, monto total, número de comprobante
- **Manejo de error obligatorio:** si el OCR no logra leer algún campo con confianza suficiente, el bot debe pedirle al empleado que confirme o corrija el dato manualmente por WhatsApp — NUNCA debe registrar un gasto con datos adivinados sin que el usuario lo confirme

### 4.3 Validación SUNAT
- Usar una API de terceros ya existente para validar comprobantes (ej. apiperu.dev, apis.net.pe, apidni.com) — no intentar conectar directo al servicio de SUNAT desde cero, es innecesariamente complejo para el MVP
- Validar: que el RUC del emisor existe y está activo/habido, que el comprobante no esté duplicado dentro del sistema (mismo RUC + serie + número ya registrado antes)
- Si la validación falla o el proveedor de API no responde, el gasto debe quedar marcado como "pendiente de validación" y visible igual en el dashboard — NUNCA debe perderse o bloquearse silenciosamente

---

## 5. Modelo de datos (tablas mínimas)

- **empresas**: id, razón_social, ruc, fecha_alta
- **usuarios**: id, empresa_id, nombre, teléfono_whatsapp, email, rol (empleado / aprobador / admin), aprobador_id (a quién le reporta)
- **gastos**: id, usuario_id, empresa_id, monto, fecha_gasto, categoria, ruc_emisor, razon_social_emisor, numero_comprobante, imagen_url, estado (pendiente / aprobado / rechazado / pendiente_validacion), validado_sunat (bool), fecha_creacion
- **aprobaciones**: id, gasto_id, aprobador_id, decision, fecha_decision, comentario (opcional)

---

## 6. Flujos de usuario (paso a paso — deben funcionar exactamente así)

### Flujo del empleado
1. Empleado manda foto de boleta al número de WhatsApp de la empresa
2. Bot responde: "Leí esto: [monto], [fecha], [proveedor]. ¿Es correcto?" con botones Sí/Corregir
3. Si corrige, el bot pide el dato específico que falta (no reinicia todo el flujo)
4. Bot pregunta categoría con botones: Movilidad / Alimentación / Hospedaje / Otros
5. Bot confirma: "Gasto registrado, enviado a aprobación de [nombre del aprobador]"
6. Si el número de WhatsApp no está registrado como empleado de ninguna empresa en el sistema, el bot debe responder claramente que no reconoce el número y no debe intentar procesar nada — no debe fallar en silencio

### Flujo del aprobador
7. Aprobador recibe mensaje agrupado (no uno por gasto) si hay varios pendientes, ej: "Tienes 3 gastos pendientes de [empleado]. Revisar en [link al dashboard]" — para no saturarlo de mensajes individuales
8. Puede aprobar/rechazar desde el dashboard (obligatorio) — aprobar desde WhatsApp directo es deseable pero no bloqueante para el piloto

### Flujo de finanzas/admin
9. Ve todos los gastos de la empresa en el dashboard, filtrable por empleado/fecha/estado/categoría
10. Puede exportar a CSV/Excel el rango de fechas que seleccione
11. Puede dar de alta/baja empleados y asignarles un aprobador

---

## 7. Casos borde que el sistema DEBE manejar correctamente (no ignorar)

- Foto borrosa o ilegible → el bot debe decirlo explícitamente y pedir que la reenvíen, no debe registrar un gasto con datos vacíos o inventados
- Empleado manda un mensaje de texto en vez de foto → el bot debe explicar que solo procesa fotos de boletas, con un mensaje de ayuda breve
- Boleta duplicada (mismo comprobante ya registrado antes) → el bot debe avisar al empleado y NO crear un gasto duplicado
- Empresa/empleado no registrado en el sistema → mensaje claro de que el número no está autorizado, sin procesar nada más
- Caída temporal de la API de SUNAT o de OCR → el sistema debe guardar el gasto de todas formas en estado "pendiente de validación", nunca perder la información del usuario
- Más de un aprobador reportando al mismo empleado → no debe pasar en el modelo de datos (un empleado tiene un solo aprobador en v1); si se necesita, es un caso a discutir antes de programarlo, no a resolver con una suposición

---

## 8. Variables de entorno / secretos necesarios (dejar como placeholders, nunca hardcodear)

```
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
GOOGLE_VISION_API_KEY=
SUNAT_VALIDATION_API_KEY=
DATABASE_URL=
CLOUDINARY_URL=
JWT_SECRET=
```

---

## 9. Criterio de aceptación para considerar el MVP listo para el piloto

El sistema está listo para probarse con el cliente real solo si:
1. Un empleado real puede mandar una foto de una boleta real y el gasto queda correctamente registrado con los datos correctos
2. El aprobador puede ver y aprobar/rechazar ese gasto desde el dashboard
3. El admin puede exportar un reporte de gastos a Excel y los números cuadran con lo registrado
4. Los 6 casos borde de la sección 7 fueron probados manualmente al menos una vez cada uno y el sistema respondió como se especifica ahí, no de otra forma
5. No hay ninguna contraseña, token o llave de API escrita directamente en el código — todo sale de variables de entorno

Si alguno de estos 5 puntos no se cumple, el sistema no está listo para el piloto, sin importar qué tan avanzado se vea.
