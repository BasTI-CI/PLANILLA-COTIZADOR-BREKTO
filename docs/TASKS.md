# Tablero · Cotizador Brekto

> Lo mantiene **solo el PM**. Cada fila tiene ID (`contexto-comun §3`). `scripts/contexto.sh` lee
> la sección 🔴 P0: no cambies su título ni el formato de las filas (`| ID | …`).

### 🔴 P0 — Bloqueante / ahora

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|

### 🟠 P1 — Siguiente

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|

### 🟢 P2 — Cuando haya espacio

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|
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

**Último ID usado por prefijo** (actualízalo al numerar): B-00 · P-01 · N-03 · D-00
