# Cotizador BREKTO

Aplicación web (Vite + React + TypeScript) para cotizar unidades inmobiliarias: precio, tasación, escrituración, pie, crédito hipotecario, plusvalía, arriendo (larga o renta corta), y vistas consolidadas de **resumen de inversión** y **flujo / IVA / diversificación** a 60 meses.

La **fuente de verdad** de fórmulas y variables es el código (`src/lib/engines/*`, `src/types/index.ts`) y el documento de auditoría [`variables_calculo.md`](./variables_calculo.md). La capa de datos (Supabase / stock) es provisional hasta el esquema multi-inmobiliaria definitivo.

---

## Alcance del cotizador

| Área | Qué hace |
|------|----------|
| **Cotización** | Una a cuatro unidades activas; motor `calcularResultadosCotizacion`: lista → neto → tasación → escrituración, pie total, crédito (sistema francés), plusvalía, arriendo según perfil. |
| **Desglose de pie** | Montos en CLP (upfront, cuotas antes/después, cuotón) con % sobre **valor de escrituración** (`calculosPie.ts`). |
| **Resumen de inversión** | Series de patrimonio semestral y liquidez neta de venta (mes 60) con reglas de `resumenGraficos.ts` — ver §3.6 en `variables_calculo.md`. |
| **Flujo / diversificación** | Tabla 60 meses: egresos de pie por tramo, `max(0, dividendo − arriendo)` desde el mes posterior a `mes_entrega_flujo`, inyección de IVA según reglas de `calculosDiversificacion.ts` y `precioCompra.ts`. |
| **Carga de stock** | Repositorio en `src/lib/stock/` (prueba Imagina o backend definitivo vía `VITE_STOCK_BACKEND`). Sin credenciales, unidades de demostración. |

**Fuera de alcance actual:** backend de persistencia definitivo, multi-tenant completo, ni paridad celda a celda con cualquier Excel sin tolerancia de redondeo.

---

## Parámetros relevantes

- **Globales:** valor UF en CLP (`DatosGlobales.uf_valor_clp`).
- **Propiedad:** lista, descuentos, neto, beneficio inmobiliario, descuento por bonificación, adicionales (est/bod), flags de escritura.
- **Pie:** `pie_pct` y desglose en % sobre escrituración; `pie_n_cuotas_total` solo para lógica auxiliar donde aplique (ver doc).
- **Hipotecario:** tasa, plazo, LTV, seguros.
- **Rentabilidad:** plusvalía; arriendo largo **o** renta corta (tarifa/día, ocupación 0–1, admin %, gastos comunes) — el bruto mensual corto se **calcula**, no se ingresa como campo suelto.
- **Por unidad (flujo):** `califica_iva`, `mes_entrega_flujo` (1–60 o `null`).
- **Diversificación:** capital inicial, ahorro mensual, tasa mensual, override IVA, gastos de escritura/amoblado.

Detalle de fórmulas: [`variables_calculo.md`](./variables_calculo.md).

---

## Desarrollo local

**Requisitos:** Node.js 20.19+ (recomendado 22 LTS), pnpm 10+. Si no tienes pnpm: `corepack enable` y usar `corepack pnpm`.

```bash
cd /ruta/al/proyecto
pnpm install
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY si usas stock real
pnpm dev
```

Abre la URL que indique Vite (típicamente `http://localhost:5173`).

**Build y vista previa:**

```bash
pnpm build
pnpm preview
```

**Validación:**

```bash
pnpm exec tsc -b --noEmit
pnpm test
```

---

## Checklist para correcciones futuras en código

1. **Leer primero** [`variables_calculo.md`](./variables_calculo.md) y alinear cambios de fórmula con § correspondiente (cotización, §3; flujo/IVA, §4; pie/planilla, §9).
2. **Actualizar tipos** en `src/types/index.ts` si cambian entradas o salidas del motor; buscar usos en formularios (`CotizacionForm`, pestaña Flujo, Resumen) y en el store.
3. **Motores:** preferir una sola función pura por concepto (`calculosCotizacion.ts`, `calculosPie.ts`, `calculosDiversificacion.ts`, `precioCompra.ts`, `resumenGraficos.ts`); evitar duplicar geometría entre UI y motor.
4. **Tests:** añadir o ajustar casos en `*.test.ts` junto al motor tocado; ejecutar `pnpm test` y `pnpm exec tsc -b --noEmit`.
5. **Stock/Supabase:** cambios de columnas solo en `src/lib/stock/` y documentar equivalencias en `variables_calculo.md` cuando el contrato de API cambie.
6. **Redondeos:** documentar criterios (CLP enteros vs UF decimales) si se introduce nueva superficie de cálculo.
7. **Regresión UI/PDF:** tras cambios en resultados, revisar PDF/export y etiquetas frente a §1.0 (lista vs tasación vs escrituración).

Documento complementario de negocio para la pestaña Resumen: [`CONTEXTO_RETOMAR_RESUMEN_INVERSION.md`](./CONTEXTO_RETOMAR_RESUMEN_INVERSION.md).

---

## Créditos

**Creador y compilador de esta herramienta:** Bastián N. Rodríguez López.
