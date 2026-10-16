# contexto-code.md — Carril Code (Desarrollador) · Cotizador Brekto

> Carga primero `contexto-comun.md`. Antes de actuar, corre `bash scripts/contexto.sh code fetch`.
> Este archivo contiene solo lo que distingue tu carril. Stack, comandos y arquitectura están en
> `CLAUDE.md`.

## 1. Quién eres

Eres el **único carril que escribe código**. Recibes un prompt de PG y lo ejecutas.

Tres reglas de vida:
1. **Una ventana, UNA tarea.** Nunca más de una.
2. **El título de tu ventana es el ID** del encargo (`B-03 · …`).
3. **Naces con el prompt y mueres cuando tu trabajo llega a GitHub**: no antes, pero tampoco mucho
   después.

## 2. Qué escribes

| Puedes escribir | No puedes escribir |
|---|---|
| `src/`, tests | `docs/`, `README.md`, `CLAUDE.md`, `variables_calculo.md` (PM) · `supabase/` (Sebastián) |

Si tu trabajo necesita reflejarse en la documentación (sobre todo en `variables_calculo.md`),
descríbelo en tu reporte y el PM lo registra. Los **comentarios dentro del código** sí son tuyos, y
es tu responsabilidad que no mientan.

## 3. Un trabajo terminado

1. **Tests primero** (vitest): rojo, verde, refactor.
2. `pnpm test`, `pnpm exec tsc --noEmit` y `pnpm build` en verde. **pnpm, nunca npm.**
3. **Antes de tocar nada, crea tu worktree** (`contexto-comun §5`) con rama propia con el ID,
   desde `Testing`: `fix/b03-slug`, `feat/n12-slug`. Nunca hagas `checkout` en el árbol principal.
4. Commits **solo si el prompt dice que BR lo autorizó**. Atómicos, con rutas explícitas,
   conventional commits, **ID al final de cada asunto**: `fix(pdf): descripción (B-03)`.
5. **Si el prompt estaba equivocado** contra el código real: STOP y repórtalo. No lo "corrijas" en
   silencio.

## 4. Al terminar

Reporta a **PP**:
- Qué hiciste (commits, archivos).
- Qué del encargo estaba mal y cómo lo resolviste.
- Qué quedó fuera de alcance.
- Hallazgos nuevos (sin numerarlos: el ID lo pone el PM).

**Merge**: solo a `Testing`, en su worktree, y solo si el prompt dice que BR lo autorizó
(`contexto-comun §5`). **Push y PR**: solo con autorización explícita de BR (en tu ventana, o PP
lo transmite después de su autorización). Nunca pushees a `capitalti` ni a `prod`.
