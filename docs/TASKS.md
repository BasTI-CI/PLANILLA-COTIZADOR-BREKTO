# Tablero · Cotizador Brekto

> Lo mantiene **solo el PM**. Cada fila tiene ID (`contexto-comun §3`). `scripts/contexto.sh` lee
> la sección 🔴 P0: no cambies su título ni el formato de las filas (`| ID | …`).

### 🔴 P0 — Bloqueante / ahora

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|
| B-01 | Permitir hasta 10 cotizaciones (BR: máx. 10). Hoy tope duro 4 en store y UI; letras `A–D` fijas en PDF comercial y Flujo | en PG | PG | 2026-10-15 |
| B-02 | N° de unidad truncado desde stock (1001 → "10"): `pickNumeroUnidadFromStockRow` toma `piso`/`torre` (o `unidad_id`) antes que `unidad` | levantado (bd8c9fb) · auditado OK por PP 2026-10-16 · falta que BR lo vea con unidad real piso ≥ 10 | BR | 2026-10-15 |
| B-03 | Descuento s/ lista: la columna `descuento` del stock trae una fracción (0,15 = 15%, REPORTADO por BR) pero el código la trata como UF | auditado PP OK (fix/b03-descuento-pct-stock, 66491aa) · espera docs en Testing | BR | 2026-10-15 |
| B-04 | Modo "Compra contado" (booleano): paga 100% al contado; sin crédito, interés, dividendo, seguros, cuotas ni bono pie. Toca fórmulas | en PP | PP | 2026-10-15 |
| B-05 | PDFs comercial y operacional pierden datos: texto claro sobre blanco (Dev. IVA y variables del modelo) y hojas que se cortan (sección D, anexo 60m). + IVA por cotización en su hoja | en PP | PP | 2026-10-15 |
| B-06 | Bono pie: se muestra aunque sea 0; falta el % (sobre escrituración) en el resumen de compra; etiquetas mezclan bono pie con BI | en PP | PP | 2026-10-15 |
| B-07 | Flujo 60m con AG (solo renta larga): AG del mes entrega+2 al entrega+1+N; después, arriendo de mercado. Toca fórmulas | en PP | PP | 2026-10-15 |
| B-08 | Campos "Meses de AG", "Arriendo garantizado" y "Arriendo promedio zona" en cotizador, hoja individual y resumen; apartado "Arriendo" junto a "Diferencia dividendo arriendo" (base de B-07) | en Testing (73b9676) · auditado PP OK (62/62, tsc, build) · falta revisión visual BR (PDF) | BR | 2026-10-15 |

### 🟠 P1 — Siguiente

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|

### 🟢 P2 — Cuando haya espacio

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|
| P-02 | `pickNumeroUnidadFromStockRow` (tras B-02): sin `unidad`/`numero`, un `codigo`/`glosa` numérico le gana a `num_dpto` ({codigo:'88123', num_dpto:'316'} → 88123); y no excluye ids camelCase (`unidadId`). No afecta si el stock trae `unidad` | registrado | PM | 2026-10-16 |
| N-02 | Sitio Netlify `cotizador-multiple-brekto` (cuenta de BR) apunta a rama `dev` inexistente en `origin`; último deploy 2026-04-24. Decidir: reapuntar a `Cotizador_Dev` o eliminar | registrado | BR | 2026-10-14 |

### 🟣 Deuda con disparador

| ID | Deuda | Disparador (cuándo se vuelve urgente) | Abierto |
|---|---|---|---|

### ✅ Cerradas

| ID | Título | Integrado en | Cerrado |
|---|---|---|---|
| P-01 | Pushear `Cotizador_Dev` a `origin` tras sincronizar con `capitalti/dev` | `origin/Cotizador_Dev` (0 sin pushear, VERIFICADO `contexto.sh pm fetch` 2026-10-15 14:44) | 2026-10-15 |
| N-01 | Documentar en `CLAUDE.md` que producción sale de `giovannimarisio/cotizadormultiple` (remote `prod`) | `CLAUDE.md` §Flujo de trabajo y §Repo y ramas (sin commitear) | 2026-10-15 |
| N-03 | Ruta del clon en `CLAUDE.md`: `~/Documents/GitHub/` → `~/Developer/GitHub/` | `CLAUDE.md` §Repo y ramas y §Checklist (sin commitear) | 2026-10-15 |

---

**Estados**: `registrado` → `en PP` → `en PG` → `en Code` → `en revisión` → `autorizado` →
`levantado` → `integrado` (Sebastián) → `en producción`.

**Evidencia de los hallazgos del 2026-10-14** (VERIFICADO): `git fetch --all`, `git rev-list
--count`, `gh api repos/giovannimarisio/cotizadormultiple/git/trees/main`, `netlify sites:list`.

**Último ID usado por prefijo** (actualízalo al numerar): B-08 · P-02 · N-03 · D-00
