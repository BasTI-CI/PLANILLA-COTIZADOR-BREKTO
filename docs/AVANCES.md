# Bitácora · Cotizador Brekto

> La escribe **solo el PM**, la entrada más reciente arriba. Una entrada por hito: qué se
> registró, qué se integró, qué decidió BR. Con IDs y evidencia (`contexto-comun §4`).

## 2026-10-16

- **Decisiones de BR:** B-04 contado = sin BI, pago único del 100 % del precio de compra (depto +
  adicionales), crédito 0, sin bono pie. B-07/B-08: booleano «Arriendo garantizado» habilita
  meses y monto (libres); el AG se corta en el mes 60. B-01: supuesto del PM aprobado + «que la
  exportación sea útil». Conflictos de merge los resuelve BR. La cadena avanza sola hasta Code.
- **B-03 corregido:** `descuento` es **porcentaje 0–100**, no fracción (VERIFICADO por PP con
  11.507 filas de get-stock). La cita de BR «0,15» queda REPORTADA. `variables_calculo.md`
  actualizado.
- **Durante la noche no avanzó a Code:** los PP escribieron sus encargos para PG, pero no
  abrieron ventanas (esperaban OK). Hoy se les dio el OK.
- **Localhost de auditoría:** `pnpm dev` en el worktree de `Testing`, http://localhost:5180
  (`.env` enlazado desde el árbol principal).

## 2026-10-15

- **Flujo nuevo (decisión de BR, BINDING):** siempre en worktrees; worktree → merge a `Testing`
  → PR a `origin/main`. Rama `Testing` creada desde `Cotizador_Dev` (`bd8c9fb`), con worktree
  fijo en `../PLANILLA-COTIZADOR-BREKTO-wt/testing`. Módulo `worktrees` activo
  (`contexto-comun §5`). Autorización nocturna: commit en rama del ID + merge local a Testing;
  push y PR no.
- **B-02 levantado** (`bd8c9fb`): commiteado, mergeado a `Cotizador_Dev` y pusheado a `origin`
  antes del flujo nuevo, en el árbol principal; BR confirma que lo autorizó. Falta auditoría PP.
- **Fórmulas documentadas** en `variables_calculo.md`: B-03 (columna `descuento` = fracción),
  B-04 (compra contado), B-07/B-08 (§3.5.1 AG → mercado). Dos puntos abiertos para BR: pago
  contado con BI, y 24 vs 23 pagos de AG.
- **Encargos a PP** de B-01, B-03, B-04, B-06, B-07, B-08 (ventanas abiertas). B-07 espera a
  B-08 en Testing. B-01 con supuesto del PM: el asesor elige qué cotizaciones van en la Propuesta.

- **Registrados B-01 a B-08** (pedido de BR, 8 cambios "para ya"). Medidos contra el código con
  3 subagentes de lectura (VERIFICADO por lectura de código, 2026-10-15; sin pruebas con datos
  reales del stock). B-03, B-04, B-07 y B-08 esperan decisiones de BR; B-04 y B-07 tocan
  fórmulas y se documentan en `variables_calculo.md` antes del encargo.
- **Producción, fecha de deploy**: no medible desde la cuenta de BR (Netlify de Giovanni, sin
  statuses en GitHub). El "último deploy 2026-05-05" de la entrada del 2026-10-14 pasa a
  **REPORTADO**. `prod/main` = `0d71a8a` (VERIFICADO, `git fetch prod`).

- **Cerrados P-01, N-01, N-03** (pedido de BR). P-01: `Cotizador_Dev` ya estaba pusheado
  (0 sin pushear, VERIFICADO `contexto.sh pm fetch` 14:44). N-01 y N-03: `CLAUDE.md` ahora
  muestra el remote `prod` (Giovanni → Netlify → producción) y la ruta `~/Developer/GitHub/`.
  Queda abierto N-02 (decisión de BR).

- **Regla de comunicación** (decisión de BR): etiquetas 💬 🔧 ▶️ 🧠 🤖 para todo lo que se le
  muestra a BR. `contexto-comun.md §6.b`. También en `~/.claude/CLAUDE.md` (global) y en la
  plantilla de `/equipo`.

## 2026-10-14

- **Equipo instalado** con `/equipo`. Roles: PM, PP, PG, Code. Flujo liviano, sin módulos.
- **Mapa de repos medido** (VERIFICADO, `git fetch` + `gh api` + `netlify sites:list`): producción
  (`cotizadormultiple.brekto.com`) se publica desde `giovannimarisio/cotizadormultiple` `main`, en
  la cuenta Netlify de Giovanni. Último deploy: 2026-05-05, commit `0d71a8a`. Sin movimiento desde
  entonces.
- **Sincronización con producción** (decisión de BR): se agregó el remote `prod` (solo lectura) y
  `Cotizador_Dev` avanzó por fast-forward de `806cb7f` a `a3d2dc6` (`capitalti/dev`): +`supabase/`
  de Sebastián, 8 archivos. Después, `src/` y `supabase/` locales tienen el mismo hash de árbol que
  `prod/main`. Falta el push (P-01).
- Registrados: P-01, N-01, N-02, N-03.
