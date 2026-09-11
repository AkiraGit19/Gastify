# GOAL — Gastify listo para el primer cliente que paga

Estado: **bloques A y B terminados**. Rama `panel-movil-empleados`.
Última actualización: 2026-09-10.

## Qué significa "listo"

Un cliente paga, sube 200 boletas el primer mes, y nada de lo que pase lo deja
bloqueado ni obliga a Akira a abrir la base de datos a mano.

---

## Contexto de mercado

**Khipu** (app.khipu.pe, fundada en Perú 2024) es el competidor directo. Cobra
**S/ 35–50 por usuario/mes**. Módulos: Rendiciones, Compras/CxP, y una capa de IA.
Su navegación está partida en tres roles: Administrador (Dashboard, Global empresa,
Fondos), Aprobador (Revisión, Fondos), Rendidor (Gastos, Informes, Mis fondos).

Lo que Khipu tiene y Gastify no:

| Función | ¿Para el primer cliente? |
|---|---|
| Informes (agrupar gastos y aprobar el lote) | No — se difiere, ver Bloque C |
| Fondos / entregas a rendir | No — se difiere |
| Presupuestos, Cajas maestras | No — se difiere |
| Estado "Pagado" (reembolso) | **Sí** — sin esto el ciclo no cierra |
| IGV desglosado | **Sí** — requisito tributario |
| Tipo de comprobante (factura vs boleta) | **Sí** — ver abajo |
| Integraciones ERP (CONCAR, SISCONT…) | No — el CSV cubre al primer cliente |
| Aprobación multinivel por monto/área | No — un aprobador por empleado alcanza |

### El hueco tributario que casi se nos pasa

En Perú **las boletas de venta no dan derecho a crédito fiscal; solo las facturas**.
Gastify guarda `numeroComprobante` pero no distingue el tipo, así que el CSV que
recibe el contador mezcla gastos que dan crédito fiscal con los que no. Para un
contador peruano ese export es inservible tal cual.

Se arregla barato: la serie ya dice el tipo (`F001` = factura, `B001` = boleta), así
que se infiere de lo que ya lee el OCR y se deja corregible.

Además, un gasto sobre S/ 2,000 exige medio de pago bancarizado para ser deducible.
Basta con marcarlo visualmente; no hace falta validar el medio de pago todavía.

---

## Bloque A — Los 5 huecos de la auditoría (bloquean la venta)

- [x] **A1. Un gasto no se puede corregir ni anular.** Hoy no existe `PATCH` ni
      `DELETE` en `/gastos`. Un monto mal leído queda para siempre. Se agrega
      edición con auditoría (quién, cuándo, qué cambió) y anulación con motivo —
      anular, no borrar: los registros financieros no se destruyen.
- [x] **A2. Si el admin de un cliente pierde su contraseña, nadie la recupera.**
      `usuarios.routes.ts` es solo para rol `admin` con alcance a su propia empresa,
      así que el super_admin queda fuera. Se le da al super_admin la capacidad de
      generar un link de acceso para el admin de cualquier empresa.
- [x] **A3. Los duplicados solo se detectan con RUC + comprobante.** Si el OCR
      devuelve null en cualquiera de los dos, la misma boleta entra dos veces. Se
      agrega huella de la imagen y una alerta por monto+fecha+usuario.
- [x] **A4. La categoría quedó muerta en el panel.** Todo gasto web entra como
      `otros`. Lo resuelve A1: el aprobador la asigna al revisar, que ya está
      mirando la boleta.
- [x] **A5. No hay cobro.** *Decisión: no se construye.* Un módulo de facturación
      son semanas y el primer cliente se factura a mano. Se documenta y se revisa
      al tercer cliente.

## Bloque B — Lo que el mercado exige

- [x] **B1. Tipo de comprobante + IGV desglosado.** `tipoComprobante` inferido de
      la serie y corregible; `subtotal` e `igv` calculados. Sin esto el export no
      le sirve al contador.
- [x] **B2. Estado "pagado".** Hoy el flujo muere en `aprobado`. El empleado nunca
      sabe si le devolvieron la plata y el admin no lleva registro del reembolso.
- [x] **B3. Límite de intentos en el login.** Bcrypt a 12 rondas frena, pero no hay
      bloqueo por intentos fallidos.
- [x] **B4. CSV que el contador pueda usar.** Con tipo de comprobante, subtotal,
      IGV y marca de bancarización.

## Bloque C — Diferido a propósito (no se construye ahora)

Informes agrupados, fondos/entregas a rendir, presupuestos, multi-moneda,
integraciones ERP, aprobación multinivel, tarjetas corporativas, portal de
proveedores. Todo esto es Khipu maduro, no un MVP vendible. Se revisita cuando
haya tres clientes diciendo cuál falta.

---

## Reglas de este trabajo

1. No romper nada de lo que ya funciona. `npx tsx src/verificar.ts` verde siempre.
2. Cada cambio de comportamiento deja un chequeo ejecutable atrás.
3. Migraciones aditivas: nada de borrar columnas ni datos.
4. Los registros financieros se anulan, nunca se borran.

---

## Hecho

Verificado con 51 chequeos: `src/verificar.ts` (lógica pura, sin red) y `src/verificar-e2e.ts`
(servidor y base vivos, incluida una regresión del bot de WhatsApp).

| Bloque | Qué quedó |
|---|---|
| A1 | `PATCH /gastos/:id` con permisos por rol y estado, auditoría en `EdicionGasto`, y anulación con motivo. Un gasto pagado ya no se toca. |
| A2 | `GET/POST /empresas/:id/administradores/...` para que el super_admin devuelva el acceso a un admin de empresa. |
| A3 | SHA-256 de la imagen contra reenvíos exactos; mismo monto+día del mismo empleado va a revisión humana en vez de bloquearse. |
| A4 | El aprobador corrige categoría y tipo desde la pantalla de revisión. |
| A5 | No se construyó, a propósito. |
| B1 | `tipoComprobante` inferido de la serie, `igv` leído o derivado, recalculado al editar. |
| B2 | Estado `pagado` con fecha, en lote desde la lista de gastos. |
| B3 | 8 intentos y 15 minutos de bloqueo, sin filtrar qué correos existen. |
| B4 | CSV con BOM, `;`, coma decimal, subtotal/IGV/total y marca de bancarización. |

### Bug encontrado que no estaba en la lista

Express 4 no captura el rechazo de un handler `async`: Node mata el proceso. **Cualquier** error
inesperado en **cualquier** endpoint dejaba sin backend a todos los clientes a la vez. Apareció
al editar un gasto hacia un comprobante ya existente. Resuelto en `src/async-router.ts` más un
middleware de errores en `index.ts`.

## Bloque D — Operación (hecho)

- [x] **Monitoreo.** Los errores del backend se guardan en la base y salen en el panel de super
      admin, agrupados por huella con contador. Sin cuentas externas ni claves: funciona desde el
      primer despliegue. El punto de captura está centralizado en el middleware de errores, así
      que cambiarlo por Sentry más adelante es tocar una línea.
- [x] **Filtros en el servidor.** `GET /gastos?estado=a,b` filtra en la base. Aprobaciones ya no
      se baja la tabla entera de la empresa para mostrar doce filas. Los estados se validan contra
      el enum: antes un valor inventado en la URL reventaba la consulta.

### Bugs encontrados de paso

Crear un usuario con un correo repetido, o una empresa con un RUC repetido, devolvían "ocurrió un
error inesperado". Son errores de quien carga los datos, no del sistema: ahora dicen qué corregir.
Aparecieron justamente al probar el monitoreo.

## Lo que sigue faltando para vender

- La exactitud del OCR sigue sin validar contra boletas reales (falta la API key).
- Sin cobro: el primer cliente se factura a mano.
- Ícono de iOS: falta un PNG de 180x180 exportado del logo.
