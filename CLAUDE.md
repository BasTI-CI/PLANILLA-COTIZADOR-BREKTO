# CLAUDE.md — Contexto para retomar

> Contexto de trabajo para Claude (asistente). Léeme primero al iniciar cualquier sesión sobre este repo.

---

## Persona del usuario

- **Bastián Rodríguez** — Ingeniero Físico, Prompt Engineer en Capital Inteligente.
- **Es la primera app que diseña.** Ajustar nivel de explicación: ser concreto y didáctico, evitar jerga que dé por entendida.
- **Idioma: español chileno neutro.** No usar "vos", "tenés", "querés", "che", "mandame", "fijate". Preferir "tú", "tienes", "quieres", "mándame", "fíjate".
- **Giovanni** es jefe/amigo que revisa código (NO referirse como "jefe" a secas).

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
3. **Valor tasación** (`valor_tasacion_uf`) — base banco/tasación, repercute BI.
4. **Valor escrituración** (`valor_escritura_uf`) — base de operación: pie %, crédito %, plusvalía, IVA flujo.

Nunca llamar "precio neto" a "valor tasación" en una etiqueta.

---

## Exportables PDF

Hay **dos tipos** y NO deben mezclarse. La separación se introdujo en commit `cdc4618` (rediseño completo del comercial, eliminación de la hoja Jira).

### Propuesta de Inversión (comercial — cliente-facing)

- **Implementado** en [`src/components/pdf/ModuloPDF.tsx`](./src/components/pdf/ModuloPDF.tsx).
- Pestaña **PDF** del cotizador. Botón "Exportar PDF".
- **Audiencia:** el inversionista. Confidencial pero comercial.
- **Formato:** Carta (Letter), multi-página, orientaciones mixtas.
- **Mecánica:** cada hoja es un nodo con `data-pdf-page="true"` y `data-pdf-orientation`. `generarPDF` los recorre, captura cada uno con html2canvas y arma el jsPDF página por página. Loop de calidad con cap a 10 MB.

**Estructura:**

| Hoja | Orientación | Contenido |
|---|---|---|
| H1 Portada | Portrait | Isotipo Brekto (PNG en `src/assets/ISOTIPO.BRIKTO-2.png`) + asesor + cliente + tabla resumen Proyecto/Unidad/Tipología + fecha y `1 UF = $...` arriba derecha |
| H2 Comparativa + KPIs | Landscape | Tabla 14 columnas + tarjetas KPI (Plusvalía 5y, Ganancia venta, Resultado mensual) |
| H3 Gráficos + Tabla anual | Landscape | 3 LineCharts (Patrimonio · Caja · Resultado financiero) + cashflow anual |
| H4+ Por cotización | Portrait × 2 | Hoja A: a-e (precios, pie, resumen, crédito, rentabilidad). Hoja B: f-g (resultado, promociones) |
| Anexo 60m (opcional) | Landscape × 3 | Tabla detallada `1–24` · `25–48` · `49–60`. Cabeceras consolidan 60m completos |

**Identidad:** azul oscuro corporativo `#0d4d80` (`T.accent`) en títulos / subtítulos / cabeceras de tabla con fondo + texto blanco bold. Texto "Brekto" del header con `linear-gradient(90deg, #0a3b8a, #1bbcd8, #00ff9c)` vía `background-clip: text`.

**Lo que NO va aquí por diseño:** comisiones, dirección completa, datos operacionales, `califica_iva`, `mes_entrega_flujo` visibles, `proyecto_direccion`. Eso es para el otro export.

### Cotización para Operaciones y UGC (uso interno — planeado)

- **No implementado todavía.** Vivía antes como hoja "Jira" toggleable dentro del comercial; se eliminó al rediseñar.
- **Audiencia:** equipos de Operaciones / UGC (Unidad de Gestión Comercial). NUNCA al cliente.
- **Plan:**
  - Botón "Generar Cotización para Operaciones y UGC" al final de cada pestaña de cotización individual ([`CotizacionForm.tsx`](./src/components/cotizacion/CotizacionForm.tsx)).
  - **Un PDF por cotización** (no consolida varias unidades como el comercial).
  - Contenido: dirección, barrio, orientación, sup interior/terraza, monto crédito UF/CLP, dividendo, arriendo neto, resultado mensual, califica IVA, mes_entrega, posibles comisiones, fecha de reserva, datos del ejecutivo.
- **Razón del split:** mezclar audiencias en un mismo documento es fuente de filtraciones y errores de envío.

### Componentes PDF reutilizables

- **`PdfPage`** ([`ModuloPDF.tsx`](./src/components/pdf/ModuloPDF.tsx)): wrapper de hoja con tamaño Carta exacto en mm→px (96dpi base). Props: `orientation`, `innerPadding`. Marca el nodo con atributos data-* que `generarPDF` lee.
- **`TablaCashflow60m`** ([`src/components/flujo/TablaCashflow60m.tsx`](./src/components/flujo/TablaCashflow60m.tsx)): tabla 60m reutilizada en pestaña Flujo, Hoja 3 PDF y Anexo. Props clave para PDF:
  - `pdfMode`, `pdfLight`: paleta clara y compactación.
  - `annualOnly`: solo resumen anual (Hoja 3).
  - `mesRango: [number, number]`: filtra filas visibles sin afectar cabeceras (anexo).
  - `omitResumenAnual`: oculta el bloque al final (anexo, evita duplicar con H3).

---

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
2. ¿Hay PRs abiertos? `gh pr list` (si `gh` instalado) o revisar manualmente.
3. Si Bastián describe el repo: contrastar contra realidad. Su mapa mental puede tener nombres invertidos (origin/capitalti, dev/Cotizador_Dev).
4. Si Cursor muestra rama distinta a `git branch --show-current`: probable clone equivocado abierto. Verificar con `pwd` en terminal integrada de Cursor.
5. Antes de cambios visuales: tener claro si afectan el PDF comercial, el operacional (cuando exista), o ambos.
