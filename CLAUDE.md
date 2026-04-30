# CLAUDE.md — Contexto para retomar

> Contexto de trabajo para Claude (asistente). Léeme primero al iniciar cualquier sesión sobre este repo.

---

## Persona del usuario

- **Bastián Rodríguez** — Ingeniero Físico, Prompt Engineer en Capital Inteligente.
- **Es la primera app que diseña.** Ajustar nivel de explicación: ser concreto y didáctico, evitar jerga que dé por entendida.
- **Idioma: español chileno neutro.** No usar "vos", "tenés", "querés", "che", "mandame", "fijate". Preferir "tú", "tienes", "quieres", "mándame", "fíjate".
- **Giovanni** es jefe/amigo que revisa código (NO referirse como "jefe" a secas).
- **Sebastián Villaseca** es el **Ingeniero TI** que levanta a producción. Dueño del repo upstream `svillaseca-capitalinteligente/Cotizador-Multiple`. NO confundir con Bastián.

## Flujo de trabajo (entregas)

```
Bastián (BasTI-CI/PLANILLA-COTIZADOR-BREKTO, rama Cotizador_Dev)
       │  (avisa por mensaje + link a la rama)
       ▼
Sebastián Villaseca (svillaseca-capitalinteligente/Cotizador-Multiple, rama dev)
       │  (revisa, integra, despliega)
       ▼
Producción
```

- **Bastián NO pushea directo** a `capitalti/dev`. Aunque GitHub no rechaza la conexión (vimos dry-run de `main` exitoso), se respeta el flujo formal vía mensaje a Sebastián.
- **`BasTI-CI/PLANILLA-COTIZADOR-BREKTO` no es un fork registrado** del repo de Sebastián — es un repo independiente. Por eso GitHub no permite "Compare across forks" entre ambos. Para integrar, Sebastián debe agregar el repo de Bastián como remote en su clon, hacer fetch, y mergear `bastian/Cotizador_Dev` → `dev` localmente.
- Cuando Sebastián integre cambios, Bastián sigue trabajando en `Cotizador_Dev` como siempre. Si Sebastián pide cambios, Bastián commitea más en `Cotizador_Dev`, pushea a `origin`, y le avisa que actualizó.

---

## Repo y ramas

```
GitHub:
  ├── BasTI-CI/PLANILLA-COTIZADOR-BREKTO       ← el fork de Bastián (origin)
  │     ├── main               ← rama estable
  │     └── Cotizador_Dev      ← rama de trabajo activa
  └── svillaseca-capitalinteligente/Cotizador-Multiple   ← repo upstream de Seba (capitalti)

Local:
  └── ~/Documents/GitHub/PLANILLA-COTIZADOR-BREKTO/
        ├── origin    → BasTI-CI/PLANILLA-COTIZADOR-BREKTO
        └── capitalti → svillaseca-capitalinteligente/Cotizador-Multiple
```

**Reglas:**
1. **Trabajar siempre en `Cotizador_Dev`.** No commitear directo a `main`.
2. **`git push` por defecto va a `origin/Cotizador_Dev` (su fork).** Verificar antes de pushear con `git rev-parse --abbrev-ref @{u}` si hay duda.
3. **Nunca pushear a `capitalti`** salvo instrucción explícita; ese remote existe solo para fetch del upstream.
4. **`main` se actualiza vía PR o FF merge desde `Cotizador_Dev`.** Bastián puede tener Cursor abierto en otro clone (`SebaVilla/Cotizador-Multiple`); confirmar cuál antes de asumir.

---

## Stack y comandos

- **Frontend:** Vite 8 + React 19 + TypeScript + Zustand (`useAppStore`).
- **Charting:** recharts (LineCharts en modo `isAnimationActive={false}` para captura nítida con html2canvas).
- **PDF:** jsPDF + html2canvas, formato Carta (Letter), paginación multi-página.
- **Package manager:** **pnpm** (`packageManager: pnpm@10.33.0`). NO usar `npm install` — genera lockfile paralelo y rompe Netlify.
- **Tests:** vitest.
- **Backend datos:** Supabase (provisional, dual-project) + edge functions proxy a Brekto.

```bash
pnpm install              # idempotente, rápido si todo está al día
pnpm dev                  # localhost:5173
pnpm build                # tsc -b && vite build
pnpm test                 # vitest run
pnpm exec tsc --noEmit    # type-check sin emitir
pnpm run deploy:netlify   # build + netlify deploy --prod
```

---

## Arquitectura — fuente de verdad

- **Variables y fórmulas:** [`variables_calculo.md`](./variables_calculo.md) (en raíz, no en `docs/`). Es el contrato auditable. Cualquier cambio de fórmula se documenta ahí ANTES de cambiar código.
- **Documentos hermanos:** [`CONTEXTO_RETOMAR_RESUMEN_INVERSION.md`](./CONTEXTO_RETOMAR_RESUMEN_INVERSION.md) (alcance pestaña Resumen) y `COMMIT_CHECKLIST.md` si existiera.

### Motores (`src/lib/engines/`)

| Archivo | Rol |
|---|---|
| `calculosCotizacion.ts` | Tasación, escritura, pie total, hipotecario (sistema francés), plusvalía, arriendo |
| `calculosPie.ts` | Desglose pie en CLP (upfront, cuotas antes/después, cuotón) sobre **valor escrituración** |
| `calculosDiversificacion.ts` | Flujo 60m: pie por tramo, dividendo−arriendo **con signo** post-entrega, IVA. Modelo B (rentabilidad sobre saldo previo). |
| `desglosePieUf.ts` | `bonoPieUf`, `pieAPagarUf` |
| `precioCompra.ts` | Precio compra depto/total, base IVA (15% sobre solo depto) |
| `resumenGraficos.ts` | Series patrimonio semestral, liquidez mes 60 |
| `validarCalculosCotizacion.ts` | Coherencia motor vs fórmulas (§8) |

### Convenciones críticas (no mezclar)

Las **4 magnitudes** que NO son lo mismo (ver §1.0.0 de `variables_calculo.md`):

1. **Precio lista** (`precio_lista_uf`) — catálogo.
2. **Precio de compra** — neto comercial post-descuentos. Depto: `precio_neto_uf × (1 − bono_max_pct)`. Total: `precioCompraTotalUf`.
3. **Valor tasación** (`valor_tasacion_uf`) — base banco/tasación, repercute BI. En el PDF comercial el cliente lo ve como "VALOR ESCRITURACIÓN DEPARTAMENTO" (sin adicionales).
4. **Valor escrituración** (`valor_escritura_uf`) — base de operación: pie %, crédito %, plusvalía, IVA flujo. = tasación depto + adicionales (con/sin BI repercutido según `bono_aplica_adicionales`).

Nunca llamar "precio neto" a "valor tasación" en una etiqueta.

### "Bonificación inmobiliaria" tiene 2 acepciones — distinguir siempre

Cuidado al etiquetar en UI/PDF:

- **Bonificación inmobiliaria sobre precio (BI = `bono_descuento_pct`):** descuento que la inmobiliaria aplica al cerrar la operación. Se traduce en `beneficio_inmobiliario_uf` y eleva el precio de compra hasta el valor tasación. Aparece en sección **B** del PDF comercial.
- **Bonificación inmobiliaria sobre el pie (= bono pie):** parte del pie documentado que la inmobiliaria absorbe (no la cuota de caja del cliente). `bonoPieUf = pie_total_uf − pie_a_pagar_uf`. Aparece en sección **C** del PDF comercial.

En el PDF están etiquetadas distinto: en B "Bonificación inmobiliaria (BI X.XX%)", en C "Bonificación inmobiliaria (bono pie)".

---

## Exportables PDF

Hay **dos tipos** y NO deben mezclarse:

- **Comercial (Propuesta de Inversión):** consolida 1–4 cotizaciones, va al cliente. `ModuloPDF.tsx`.
- **Operacional / UGC / Jira:** un PDF por cotización individual, uso interno. `PdfOperacional.tsx`. NUNCA al cliente.

La separación de audiencias se introdujo en `cdc4618` (eliminación de la hoja Jira del comercial). El operacional independiente se implementó en `302484b`.

### Propuesta de Inversión (comercial — cliente-facing)

Archivo: [`src/components/pdf/ModuloPDF.tsx`](./src/components/pdf/ModuloPDF.tsx). Pestaña **PDF** del cotizador, botón "Exportar PDF". Formato: Carta (Letter), multi-página, orientaciones mixtas. Mecánica: cada hoja es un nodo con `data-pdf-page="true"` y `data-pdf-orientation`. `generarPDF` los recorre, captura cada uno con html2canvas y arma el jsPDF página por página. Loop de calidad con cap a 10 MB.

**Estructura actual** (commit `84ebee7`, A–F + Política según listado de Bastián):

| Hoja | Orientación | Contenido |
|---|---|---|
| H1 Portada | Portrait | Isotipo Brekto (PNG `src/assets/ISOTIPO.BRIKTO-2.png`) + Brekto Wordmark con degradado SVG inline + asesor + cliente + tabla resumen Proyecto/Unidad/Tipología + fecha y `1 UF = $...` arriba derecha |
| H2 Comparativa + KPIs | Landscape | Tabla 14 columnas + tarjetas KPI (Plusvalía 5y, Ganancia venta, Resultado mensual) |
| H3 Gráficos + Tabla anual | Landscape | 3 LineCharts (Patrimonio sin puntos · Caja · Resultado financiero) + cashflow anual |
| **H4 Por cotización (Hoja 1 de 2)** | Portrait | Banda azul superior + Resumen general (3 cards) + **A** Detalle unidad + **B** Precio compra y valor escrituración (lista→descuentos→PRECIO COMPRA→BI→VALOR ESCRITURACIÓN DEPARTAMENTO→adicionales) + **C** Pie y forma de pago + **D** Escrituración y crédito hipotecario |
| **H5 Por cotización (Hoja 2 de 2)** | Portrait | Banda azul superior + **E** Resultado de la cotización (Plusvalía, Ganancia venta, Dividendo, Arriendo, Resultado mensual) + **F** Promociones + Política de Cotización y Reserva |
| Anexo 60m (opcional) | Landscape × 3 | Tabla detallada `1–24` · `25–48` · `49–60`. Cabeceras consolidan 60m completos |

Total por cotización activa: **2 hojas portrait** (A–D en H4, E–F+Política en H5).

**Identidad visual:**
- Azul oscuro corporativo `#0d4d80` (`T.accent`) en títulos / subtítulos / cabeceras de tabla con fondo + texto blanco bold.
- Banda superior de cada hoja de cotización: full-width azul (vía `margin: -14mm` para extender más allá del padding del PdfPage).
- Texto "Brekto" del header con SVG inline (`<text fill="url(#grad)">`) — **NO usar `background-clip: text`** porque html2canvas no lo respeta y queda como rectángulo de color (probado y descartado).
- Tablas con cabecera azul + filas destacadas (`Row destacada`) para totales / hitos clave (PIE A PAGAR, VALOR ESCRITURACIÓN DEPARTAMENTO/TOTAL, PRECIO COMPRA, Crédito, Dividendo, Ganancia venta, Resultado mensual).

**Lo que NO va aquí por diseño:** comisiones, dirección completa, datos operacionales, `califica_iva`, `mes_entrega_flujo` visibles, `proyecto_direccion`. Eso va en el operacional.

### Cotización para Operaciones y UGC (uso interno)

Archivo: [`src/components/pdf/PdfOperacional.tsx`](./src/components/pdf/PdfOperacional.tsx). Botón **"IMPRIMIR PARA USO INTERNO JIRA — OPERACIONES — UGC"** al final de cada `CotizacionForm` activa, antes del bloque "Resultado".

- **Una hoja Letter portrait por cotización.**
- **Descarga directa** (sin preview en pantalla) — render off-screen vía `createRoot` → `html2canvas` → `jsPDF` → `.save()` → `unmount`.
- **Cap de tamaño 2 MB** (vs 10 MB del comercial) — para envío rápido por correo interno. Loop de calidad JPEG.
- Filename: `Operacional_Cot[A-D]_[Cliente]_[fecha].pdf`.
- Header: isotipo izq, datos asesor/cliente/inmob/proyecto/unidad centro, fecha+UF derecha. Badge "USO INTERNO JIRA / OPERACIONES / UGC".
- Secciones a–g compactas con paleta clara: a) Antecedentes propiedad, b) Detalle precios y descuentos, c) Pie y forma de pago, d) Tasación y escrituración, e) Resumen financiero, f) Crédito, g) Promociones.

### Componentes PDF reutilizables

| Componente | Archivo | Notas |
|---|---|---|
| `PdfPage` | `ModuloPDF.tsx` | Wrapper de hoja con tamaño Carta exacto (mm→px @ 96dpi). Props: `orientation`, `innerPadding`. Marca el nodo con `data-pdf-page` que `generarPDF` lee. |
| `BrektoIsotipo` | `ModuloPDF.tsx` | `<img>` con el PNG oficial. |
| `BrektoWordmark` | `ModuloPDF.tsx` | SVG inline con `<text fill="url(#grad)">`, NO usar background-clip. |
| `CotBandaSuperior` | `ModuloPDF.tsx` | Banda azul full-width para hojas H4+. Props: `c, letra, hojaLabel, uf`. |
| `TablaCot` + `Row` | `ModuloPDF.tsx` | Tabla con cabecera azul corporativo, filas con `destacada` opcional para totales (azul + texto blanco). Props `columnAlignments` por columna. |
| `InfoCard` | `ModuloPDF.tsx` | Card "Información del…" usado en Resumen general (H4). |
| `TablaCashflow60m` | `src/components/flujo/TablaCashflow60m.tsx` | Tabla 60m reutilizada en pestaña Flujo, Hoja 3 PDF y Anexo. Props PDF: `pdfMode`, `pdfLight`, `annualOnly` (solo resumen anual), `mesRango: [a, b]` (filtra filas visibles, no afecta cabeceras), `omitResumenAnual` (oculta bloque final, usado en anexo). |

---

## Datos globales del documento (`DatosGlobales`)

Extendido en `cdc4618 / 302484b` para soportar ambos PDFs:

| Campo | Uso |
|---|---|
| `inversionista_nombre` | Cliente — header de ambos PDFs |
| `inversionista_rut` | Cliente — solo operacional |
| `inversionista_correo` | Cliente — solo operacional |
| `asesor_nombre` | Asesor — header de ambos PDFs |
| `asesor_correo` | Asesor — header de ambos PDFs |
| `asesor_telefono` | Asesor — opcional, solo operacional |
| `uf_valor_clp` | UF del día — usado en todo el motor + ambos PDFs |
| `cotizacion_fecha` | ISO date — visible en ambos PDFs |

**Edición:** tarjeta **"📄 Datos del Documento"** en cada `CotizacionForm`, **antes** de "Fuente de Datos". Los inputs se bindean al store global, así editar en Cot A se sincroniza con B/C/D automáticamente. El sidebar de la pestaña PDF muestra esos datos como **solo lectura** con el mensaje "edita en pestaña Cotización".

## Patrón `alwaysEditable` en CotizacionForm

Sección "ANTECEDENTES PROPIEDAD" tiene un `.map()` que aplica `readOnly={!modoManual}` a todos los campos. Para excepciones (campos libres comerciales que NO vienen del stock), agregar `alwaysEditable: true` al objeto del map:

```ts
{ label: 'Barrio', key: 'proyecto_barrio', type: 'text', alwaysEditable: true },
```

El render aplica `readOnly={alwaysEditable ? false : !modoManual}` y `opacity: 1` cuando `alwaysEditable`. Hoy solo aplica a Barrio. Si el negocio agrega más campos libres (ej: comentarios comerciales), usar este patrón para no acoplarlos al toggle de modo manual.

## Capa de datos (Supabase) — provisional

Dos proyectos en cuenta **Capital_Desarrollo**:
- `Cotizador_Multiple_Dev` (front se conecta acá): tablas `inmobiliarias`, `proyectos` + edge functions proxy.
- `Brekto_Dev` (no accesible desde front): tabla `stock` real.

**Mapeo `stock` → `UnidadSupabase` → `DatosPropiedad`** en [`src/lib/getStock.ts`](./src/lib/getStock.ts) y [`src/lib/stock/mapToDatosPropiedad.ts`](./src/lib/stock/mapToDatosPropiedad.ts). Detalle en `variables_calculo.md` "Arquitectura de datos en producción".

**Esto se reemplaza** cuando el modelo multi-inmobiliaria definitivo esté listo (~30 inmobiliarias, ~260 proyectos, >10k unidades). Por ahora **invertir tiempo en claridad de variables y fórmulas, no en pulir el mapeo Supabase**.

---

## Variables de entorno relevantes

| Variable | Para qué |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Cotizador_Multiple_Dev |
| `VITE_SUPABASE_ANON_KEY` | Clave anon publishable |
| `VITE_DEV_BYPASS_AUTH` | `false` para forzar SSO real en dev local |
| `VITE_PREVIEW_BYPASS_AUTH` | `true` solo en preview deploys de Netlify (sin SSO). **Borrar en producción real.** |
| `VITE_STOCK_BACKEND` | `imagina` \| `definitivo` \| omitir (= proyectos+inmobiliarias) |

---

## Reglas de trabajo (preferencias del usuario)

1. **Confirmar antes de codear** si la tarea tiene puntos abiertos. Mejor preguntar 3 cosas concretas que asumir y rehacer.
2. **NO usar TodoWrite** salvo que la tarea sea genuinamente multi-paso con beneficio de tracking visible. Para implementaciones lineales con plan ya expuesto, no aporta.
3. **NO commitear sin instrucción explícita.** Bastián decide cuándo. "Commit" puede significar solo `git commit` (no push).
4. **NO pushear sin instrucción explícita.** Verificar destino del push antes (`@{u}`).
5. **Verificar antes de tocar:** estado del repo (`git status`, branch, HEAD), si Cursor está abierto en el clone correcto, si hay clones múltiples.
6. **Tipografía y paleta del PDF se controlan desde 1 lugar:**
   - Paleta clara: `T = { ... }` en `ModuloPDF.tsx`. Cambiar `T.accent` propaga al header y subtítulos.
   - Cabeceras de tabla del componente `TablaCashflow60m`: hardcoded `#0d4d80` (3 ocurrencias).
7. **Ajustes finos de layout en PDF:** preferir reducir paddings/títulos antes que tocar el componente `TablaCashflow60m`. Si requiere modificar el componente, agregar prop nuevo (no acoplar a `pdfMode`).

---

## Checklist al retomar trabajo

1. `git status -sb && git branch -vv` — verificar rama y estado.
2. ¿Hay PRs abiertos? `gh pr list` (si `gh` instalado) o revisar manualmente. Existe un PR `Cotizador_Dev → main` en el fork de Bastián que se actualiza con cada push.
3. Si Bastián describe el repo: contrastar contra realidad. Su mapa mental puede tener nombres invertidos (origin/capitalti, dev/Cotizador_Dev).
4. Si Cursor muestra rama distinta a `git branch --show-current`: probable clone equivocado abierto. Verificar con `pwd` en terminal integrada de Cursor. Bastián tiene 2 clones: `~/Documents/GitHub/PLANILLA-COTIZADOR-BREKTO/` (correcto) y otro de `Cotizador-Multiple` / SebaVilla (NO usar).
5. Antes de cambios visuales: tener claro si afectan el PDF **comercial** (`ModuloPDF.tsx`), el **operacional** (`PdfOperacional.tsx`), o ambos.

## Historial de hitos (commits clave)

| SHA | Qué |
|---|---|
| `cdc4618` | Rediseño completo del PDF comercial: multi-página Letter, isotipo, paleta corporativa, anexo en 3 hojas. Eliminada hoja Jira. |
| `4978599` | docs: README + CLAUDE.md inicial. |
| `302484b` | PDF Operacional UGC/Jira (un PDF por cotización, descarga directa, cap 2 MB). Tarjeta "Datos del Documento" en CotizacionForm. |
| `84ebee7` | Reorganización A–F del detalle de cotización (estructura definida por Bastián, alineada al referente "Cotización Capital Inteligente — Tree"). Banda superior azul full-width, tablas con cabecera azul + filas destacadas. Voseo argentino corregido. Barrio editable libre. Gráfico Patrimonio sin puntos. |
