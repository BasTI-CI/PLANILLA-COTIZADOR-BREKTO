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

## Exportables PDF

El cotizador genera **dos tipos de PDF**, con audiencias y contenidos distintos. **No mezclar:** lo que va al cliente nunca debe llevar campos operacionales internos, y viceversa.

### 1. Propuesta de Inversión — comercial / cliente-facing

Implementado en [`src/components/pdf/ModuloPDF.tsx`](./src/components/pdf/ModuloPDF.tsx). Se genera desde la pestaña **PDF** del cotizador. Audiencia: el inversionista.

**Formato:** Carta (Letter, 215.9 × 279.4 mm), multi-página con orientaciones mixtas. El paginador captura cada hoja (`[data-pdf-page="true"]`) por separado con html2canvas y la inserta en su propia página jsPDF — sin cortes "donde caiga".

**Estructura de hojas:**

| Hoja | Orientación | Contenido |
|------|-------------|-----------|
| **H1 Portada** | Portrait | Isotipo Brekto, datos del asesor (nombre, mail, tel), datos del cliente (`inversionista_nombre`, `inversionista_rut`), tabla resumen `Proyecto · Unidad · Tipología`, fecha y `1 UF = $...` en esquina superior derecha. |
| **H2 Comparativa + KPIs** | Landscape | Tabla comparativa de hasta 4 cotizaciones (14 columnas: precio, tasación, escrituración, pie doc, bono pie, pie a pagar, dividendo, plusvalía, cap rate, cap rate AirBnB) + tarjetas KPI por cotización (Plusvalía 5y, Ganancia venta, Resultado mensual arriendo). |
| **H3 Gráficos + Tabla anual** | Landscape | 3 LineCharts (Patrimonio · Caja diversificación · Resultado financiero final) con badges Inicio/Final + tabla resumen anual del cashflow 60m. |
| **H4+ Por cotización** | Portrait × 2 por cot | Hoja A: `a` Detalle de precios, `b` Pie y forma de pago, `c` Resumen financiero, `d` Crédito, `e` Rentabilidad. Hoja B: `f` Resultado, `g` Promociones. |
| **Anexo 60m** (opcional) | Landscape × 3 | Tabla detallada partida en `1–24` · `25–48` · `49–60`. Cabeceras siempre consolidan los 60 meses completos. |

**Identidad visual:** paleta corporativa azul oscuro `#0d4d80` en títulos / subtítulos / cabeceras de tabla con texto blanco bold. Isotipo Brekto oficial (`src/assets/ISOTIPO.BRIKTO-2.png`). Texto "Brekto" del header con degradado corporativo (azul → cian → verde).

**Contenido NO incluido por diseño** (porque es comercial): comisiones, datos operacionales internos, campos de Jira, califica_iva como flag visible, mes_entrega_flujo, etc.

### 2. Cotización para Operaciones y UGC — uso interno (planeado)

**Estado:** en diseño, no implementado todavía. Audiencia: equipos de Operaciones y UGC (Unidad de Gestión Comercial), no el cliente.

**Plan:**
- Botón "Generar Cotización para Operaciones y UGC" al final de cada pestaña de cotización individual ([`CotizacionForm.tsx`](./src/components/cotizacion/CotizacionForm.tsx)), no en la pestaña PDF consolidada.
- **Un PDF por cotización** (no consolida varias unidades).
- Contenido operacional y trazabilidad comercial: dirección completa, barrio, orientación, superficies interior/terraza, monto crédito UF/CLP, dividendo total UF/CLP, arriendo neto flujo, resultado mensual, `califica_iva`, `mes_entrega_flujo`, etc.

**Por qué fuera del PDF comercial:** esa hoja antes vivía como toggle dentro del exportable comercial (con la leyenda "Cotización de uso interno Jira"). Se separó porque mezclar audiencias en un mismo documento es fuente de filtraciones y errores de envío. La hoja Jira se eliminó de `ModuloPDF.tsx` en el commit `cdc4618` para preparar el split.

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

## Publicar en Netlify (Safari y móvil)

La app es estática tras `pnpm build`; [`netlify.toml`](./netlify.toml) define `publish = "dist"`, redirect SPA y Node 20. **Vite inyecta variables en el build:** debes configurarlas en Netlify, no solo en `.env.local`.

### Opción recomendada: GitHub + despliegue continuo

1. Entra en [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project** → conecta el repositorio `PLANILLA-COTIZADOR-BREKTO`.
2. Deja **Build command** `pnpm run build` y **Publish directory** `dist` (o confía en `netlify.toml`).
3. En **Site configuration → Environment variables**, añade al menos:
   - `VITE_SUPABASE_URL` — URL del proyecto Supabase.
   - `VITE_SUPABASE_ANON_KEY` — clave anónima (pública) de Supabase.
   - Opcional: `VITE_STOCK_BACKEND` = `imagina` o `definitivo` si usas esa capa.
4. **Deploy site**. Cada `git push` a la rama enlazada volverá a desplegar. Abre la URL que te asigne Netlify (`*.netlify.app`) en Safari o en el celular.

Sin esas variables, el build puede fallar o la app no podrá hablar con Supabase; sin Supabase igual puedes probar con valores de placeholder y usar **unidades demo** según la lógica del proyecto.

### Opción CLI (desde tu Mac)

```bash
pnpm install
netlify login
netlify init    # enlaza la carpeta a un sitio (o elige uno existente)
# Configura las mismas variables: netlify env:set VITE_SUPABASE_URL "https://..."
pnpm run deploy:netlify   # build + netlify deploy --prod
```

---

## Créditos

**Creador y compilador de esta herramienta:** Bastián N. Rodríguez López.
