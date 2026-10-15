# Bitácora · Cotizador Brekto

> La escribe **solo el PM**, la entrada más reciente arriba. Una entrada por hito: qué se
> registró, qué se integró, qué decidió BR. Con IDs y evidencia (`contexto-comun §4`).

## 2026-10-15

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
