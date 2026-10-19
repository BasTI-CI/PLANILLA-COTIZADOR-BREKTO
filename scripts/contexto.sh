#!/usr/bin/env bash
# contexto.sh — arranque de sesión de un carril. Mide el estado, no lo lee de un documento.
#
#   bash scripts/contexto.sh <rol> [fetch]
#     <rol>   uno de ROLES en docs/contexto/equipo.conf
#     fetch   opcional: actualiza refs remotas antes de medir
#
# Todo lo que imprime sale de git AHORA. Instalado por el skill /equipo.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "No estás dentro de un repo git."; exit 1; }

CONF="docs/contexto/equipo.conf"
[ -f "$CONF" ] || { echo "Falta $CONF. Corre /equipo para instalar el equipo."; exit 1; }
ROLES=""; MODULOS=""; RAMA_TRABAJO=""; REF_INTEGRACION=""; REF_PRODUCCION=""
TABLERO_RUTA="docs/TASKS.md"; TABLERO_REF=""
# shellcheck disable=SC1090
. "$CONF"

ROL="${1:-}"
if [ -z "$ROL" ] || ! printf ' %s ' "$ROLES" | grep -q " $ROL "; then
  echo "Uso: bash scripts/contexto.sh <rol> [fetch]"
  echo "Roles de este equipo: $ROLES"
  exit 1
fi

if [ "${2:-}" = "fetch" ]; then
  echo "Actualizando refs..."
  git fetch --all --prune --quiet && echo "  refs al día"
fi

hay_ref() { [ -n "$1" ] && git rev-parse --verify --quiet "$1" >/dev/null; }

echo
echo "════════════════════════════════════════════════════════════════"
echo "  ARRANQUE DE SESIÓN · carril $(echo "$ROL" | tr '[:lower:]' '[:upper:]') · $(date '+%Y-%m-%d %H:%M')"
echo "════════════════════════════════════════════════════════════════"
echo
echo "▸ LEE ESTOS ARCHIVOS ANTES DE ACTUAR, EN ESTE ORDEN:"
echo "    1. docs/contexto/contexto-comun.md   (reglas compartidas · manda sobre el de rol)"
echo "    2. docs/contexto/contexto-${ROL}.md   (tu carril)"
[ -n "$MODULOS" ] && echo "    módulos activos: $MODULOS (ver contexto-comun.md)"
echo
echo "  Lo que sigue es el ESTADO MEDIDO. Si un documento dice otra cosa, manda esto."
echo

GITDIR="$(git rev-parse --git-common-dir)"
FRESCURA="sin fetch registrado"
[ -f "$GITDIR/FETCH_HEAD" ] && FRESCURA="último fetch: $(date -r "$GITDIR/FETCH_HEAD" '+%Y-%m-%d %H:%M' 2>/dev/null || echo '?')"
RAMA="$(git rev-parse --abbrev-ref HEAD)"
echo "── Árbol de trabajo ───────────────────────────────────────────"
printf "  rama          : %s\n" "$RAMA"
printf "  upstream      : %s\n" "$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || echo 'sin upstream')"
printf "  sin commitear : %s archivo(s)\n" "$(git status --porcelain | wc -l | tr -d ' ')"
printf "  refs          : %s\n" "$FRESCURA"
echo

echo "── Tramos ─────────────────────────────────────────────────────"
if hay_ref "$REF_INTEGRACION"; then
  printf "  %s → HEAD (por integrar)  : %s commit(s)\n" "$REF_INTEGRACION" "$(git rev-list --count "$REF_INTEGRACION..HEAD")"
  printf "  HEAD → %s (atrasado)     : %s commit(s)\n" "$REF_INTEGRACION" "$(git rev-list --count "HEAD..$REF_INTEGRACION")"
else
  echo "  REF_INTEGRACION='$REF_INTEGRACION' no existe en este clon (¿falta fetch?)"
fi
if hay_ref "$REF_PRODUCCION"; then
  printf "  HEAD → %s (no en producción) : %s commit(s)\n" "$REF_PRODUCCION" "$(git rev-list --count "$REF_PRODUCCION..HEAD")"
fi
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  printf "  sin pushear                : %s commit(s)\n" "$(git rev-list --count '@{u}..HEAD')"
fi
echo

# IDs: se descubren en los asuntos de commit, nunca en una lista a mano.
# Forma: B-07, N-12, P-03.a … entre paréntesis o al inicio del asunto.
ids_en() {
  git log --format='%s' "$@" 2>/dev/null | LC_ALL=C awk '
    BEGIN { PAT = "[A-Z][A-Z]?-[0-9][0-9]+(\\.[a-z0-9]+)?" }
    {
      split("", visto); t = $0
      while (match(t, "\\(" PAT "\\)")) { visto[substr(t, RSTART + 1, RLENGTH - 2)] = 1; t = substr(t, RSTART + RLENGTH) }
      if (match($0, "^" PAT)) visto[substr($0, 1, RLENGTH)] = 1
      for (id in visto) print id
    }' | LC_ALL=C sort -u
}
echo "── IDs con commits ────────────────────────────────────────────"
if hay_ref "$REF_INTEGRACION"; then
  INTEGRADOS="$(ids_en "$REF_INTEGRACION" | tr '\n' ' ')"
  PENDIENTES="$(ids_en "$REF_INTEGRACION..HEAD" | tr '\n' ' ')"
  printf "  integrados   : %s\n" "${INTEGRADOS:-ninguno}"
  printf "  solo en rama : %s\n" "${PENDIENTES:-ninguno}"
else
  printf "  en HEAD      : %s\n" "$(ids_en HEAD | tr '\n' ' ')"
fi
echo

echo "── Ramas recientes (últimas 6) ────────────────────────────────"
git for-each-ref --sort=-committerdate --count=6 --format='  %(committerdate:short)  %(refname:short)' refs/heads refs/remotes \
  | grep -v '/HEAD$'
echo

if printf ' %s ' "$MODULOS" | grep -q ' worktrees '; then
  echo "── Worktrees ──────────────────────────────────────────────────"
  git worktree list | sed 's/^/  /'
  echo
fi

echo "── Bitácora del PM (últimos 5 commits de docs/) ───────────────"
git log -5 --format='  %h %ad %s' --date=short -- docs/ 2>/dev/null
echo

echo "── Tablero: 🔴 P0 abiertos ────────────────────────────────────"
if hay_ref "$TABLERO_REF"; then
  echo "  leído de ${TABLERO_REF}:${TABLERO_RUTA}"
  TABLERO="$(git show "${TABLERO_REF}:${TABLERO_RUTA}" 2>/dev/null || true)"
else
  echo "  leído del árbol: ${TABLERO_RUTA}"
  TABLERO="$(cat "$TABLERO_RUTA" 2>/dev/null || true)"
fi
if [ -z "$TABLERO" ]; then
  echo "  🔴 No se encontró el tablero. Revisa TABLERO_RUTA/TABLERO_REF en $CONF." >&2
elif ! grep -q '^### 🔴 P0' <<< "$TABLERO"; then
  echo "  🔴 El tablero no tiene la sección «### 🔴 P0»: cambió el formato." >&2
else
  FILAS="$(sed -n '/^### 🔴 P0/,/^### /p' <<< "$TABLERO" | grep -E '^\| [A-Z][A-Z]?-[0-9]' | cut -c1-150)"
  if [ -n "$FILAS" ]; then printf '%s\n' "$FILAS" | sed 's/^/  /'; else echo "  ninguno"; fi
fi
echo
echo "════════════════════════════════════════════════════════════════"
echo "  El merge y el push los autoriza Bastián. Un dato no medido es REPORTADO."
echo "════════════════════════════════════════════════════════════════"
