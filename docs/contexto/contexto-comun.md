# contexto-comun.md — Reglas compartidas por todos los carriles · Cotizador Brekto

> Lo leen **todos** los carriles antes que su archivo de rol. Un hecho vive en **un solo lugar**:
> si algo de acá contradice a un `contexto-<rol>.md`, **manda este archivo** y la contradicción se
> reporta al PM. Lo mantiene el PM. Instalado con `/equipo` el 2026-10-14.

**Precedencia, de mayor a menor**: `scripts/contexto.sh` (estado medido) → este archivo →
`contexto-<rol>.md` → `CLAUDE.md`. **Excepción**: si una regla del `CLAUDE.md` del proyecto es
**más estricta** que una de acá, manda la más estricta.

---

## 0. El equipo y el contrato de carriles

### Organigrama

| Sigla | Cargo | Qué hace, en una línea | Escribe en el repo |
|---|---|---|---|
| **BR** | **Director** | Bastián. Decide, pide, rechaza, autoriza commits, merges y push. **Define el flujo** | Todo |
| **PM** | **Product Manager / Owner** | Registra pedidos con ID, redacta encargos a PP, registra la vuelta, mantiene la documentación | Documentación (ver §2.1) |
| **PP** | **Postproducción** | Ingeniero a cargo: traduce el encargo a lo que pide el código y audita la entrega | Nada |
| **PG** | **Promptgen** | Jefe de proyecto: mide el encargo contra el código y escribe el prompt exacto para Code | Nada |
| **Code** | **Desarrollador** | Una ventana, una tarea: implementa, prueba y commitea con autorización | `src/` y tests |

🔴 **Regla que cubre todo lo demás** (BR): _«Nada se hace sin que yo al menos lo sepa y sea
informado de aquello.»_ Enterarse después no cuenta.

### La ida

```
BR → PM → PP → PG → Code
```

El PM **asigna el ID** al registrar la ficha en el tablero. No se salta ningún eslabón: aunque el
arreglo sea de una línea, va por encargo.

### La vuelta

```
Code → PP → [BR autoriza] → Code levanta → PP/BR avisa al PM → PM registra
```

| # | Quién | Qué hace |
|---|---|---|
| 1 | **Code → PP** | «ya terminé»: qué hizo, qué del encargo estaba mal, qué quedó fuera, qué hallazgo apareció |
| 2 | **PP → BR** | audita **cómo** se hizo (no solo si se hizo) y le informa si está OK |
| 3 | **BR autoriza** | **explícitamente**. Se lo dice a la ventana de Code, o PP lo transmite **después** de esa autorización |
| 4 | **→ PM** | una vez levantado, el PM lo **registra** en el tablero y la bitácora |

Un hallazgo nuevo **viaja por la vuelta completa**; el ID lo pone el PM, nadie más numera.

### Bloques de comandos para BR

- Lo que enruta el PM, sale por el PM. Lo que BR le pide a un carril **en su ventana**, se lo
  responde ese carril y **avisa al PM en el mismo turno**.
- Nadie emite un bloque para una acción que otro ya entregó.
- Todo bloque de escritura se marca `▶️ CORRE ESTO` y **termina mostrando lo que hizo** (`git status
  -sb`, `git log -1`), así una corrida repetida se delata sola.
- Los comandos de **lectura** los corre cada carril sin anunciarlos.

---

## 1. El proyecto

Cotizador de inversión inmobiliaria de Brekto / Capital Inteligente: Vite + React + TypeScript,
motores de cálculo en `src/lib/engines/`, dos PDF exportables (comercial al cliente, operacional
interno) y datos de stock vía Supabase. Su desarrollo funcional lo hizo BR; la integración y el
despliegue, Sebastián Villaseca.

**Fuente de los hechos del proyecto**: `CLAUDE.md` (stack, comandos, arquitectura, PDFs, personas,
reglas de trabajo) y `variables_calculo.md` (contrato de variables y fórmulas). No se repiten acá.

### Cadena de repos hasta producción (VERIFICADO 2026-10-14, `git fetch` + `gh api` + `netlify sites:list`)

```
origin    BasTI-CI/PLANILLA-COTIZADOR-BREKTO           Cotizador_Dev  ← trabajo de BR
   │  BR avisa a Sebastián (mensaje + link)
   ▼
capitalti svillaseca-capitalinteligente/Cotizador-Multiple   dev → main (PR)
   │  Sebastián sube a producción
   ▼
prod      giovannimarisio/cotizadormultiple             main → Netlify (equipo de Giovanni)
                                                               → cotizadormultiple.brekto.com
```

- `prod` es un remote **de solo lectura** en este clon (push deshabilitado). Se usa para medir.
- Al 2026-10-14, `src/` y `supabase/` de `Cotizador_Dev` son idénticos a `prod/main` (mismo hash de
  árbol).

| Dato | Valor |
|---|---|
| Rama de trabajo | `Cotizador_Dev` |
| Integración | `capitalti/dev` — la integra Sebastián Villaseca |
| Producción | `prod/main` → Netlify → `cotizadormultiple.brekto.com` |
| Build / test | `pnpm build` · `pnpm test` (pnpm, nunca npm) |

### Qué significa "levantar" en este proyecto

1. Code trabaja en un worktree con una rama con el ID, creada desde `Testing` (`fix/b01-slug`).
   Ver §5 Worktrees.
2. Con autorización de BR: merge a `Testing`; luego PR `Testing` → `origin/main` y push.
3. BR (o el PM, a pedido de BR) le avisa a Sebastián con el link de la rama.
4. **Nunca** se pushea a `capitalti` ni a `prod`.

---

## 2. Reglas duras — para todos los carriles

1. **Git de escritura.** Solo Code escribe código y lo commitea en su rama; el PM commitea solo la
   documentación (§2.1). En este proyecto **todo commit requiere instrucción explícita de BR**
   (`CLAUDE.md`, reglas de trabajo 3): un prompt de PG solo puede decir "commitea" si BR lo
   autorizó. **Push y merge, únicamente con autorización explícita de BR.** Nunca `push --force`,
   `reset --hard`, `rebase` ni `checkout` sobre una rama que otro carril usa.
2. **Git de lectura, libre**: `status`, `log`, `show`, `diff`, `ls-tree`, `rev-parse`, `rev-list`,
   `for-each-ref`, `cat-file`, `merge-base`, `fetch`.
3. **Commits atómicos con rutas explícitas.** Nunca `git add -A` ni `git add .`.
4. **Secretos**: `.env` nunca se commitea.
5. **Un STOP es un STOP**: si un test, el build o el type-check falla, se detiene y se reporta; no
   se "arregla" saltándolo.
6. **No se decide producto.** Cualquier carril propone opciones con sus consecuencias; BR elige.
7. **Fórmulas**: un cambio de fórmula se documenta en `variables_calculo.md` **antes** de tocar el
   código. Lo documenta el PM, como parte de la ficha.
8. **`supabase/` es de Sebastián.** Ningún carril la modifica sin una ficha que lo diga
   explícitamente y autorización de BR.

### 2.1 Quién escribe qué

| Ruta | Dueño |
|---|---|
| `src/`, tests | Code |
| `docs/` (incluido `docs/contexto/`), `README.md`, `CLAUDE.md`, `variables_calculo.md`, `CONTEXTO_RETOMAR_*.md`, `COMMIT_CHECKLIST.md` | PM |
| `supabase/` | Sebastián (ver regla 8) |
| `scripts/contexto.sh` | PM |

---

## 3. Trazabilidad del ID

El PM asigna el ID al registrar la ficha. Viaja **literal** por:

| # | Eslabón | Forma |
|---|---|---|
| 1 | Título de cada ventana (PP, PG, Code) | `B-03 · Descripción corta` |
| 2 | Nombre de rama | `fix/b03-descripcion` — nombra el ID, no el síntoma |
| 3 | **Cada** commit, no solo el primero | `fix(pdf): descripción (B-03)` |
| 4 | Mensaje a Sebastián al entregar | lista los IDs que incluye la entrega |

Si el asunto no cabe, se acorta la descripción, **nunca el ID**. `scripts/contexto.sh` descubre los
IDs leyendo los commits: un commit sin ID es trabajo invisible para el arranque.

| Prefijo | Qué es |
|---|---|
| `B-nn` | Pedido o hallazgo de uso reportado por BR |
| `P-nn` | Pendiente destapado dentro de otra entrega |
| `N-nn` | Hallazgo de auditoría o infraestructura |
| `D-nn` | Deuda técnica, **con disparador** (la condición que la vuelve urgente) |

---

## 4. Evidencia — las etiquetas no se mezclan

| Etiqueta | Significa |
|---|---|
| **VERIFICADO** | Medido contra el código, los refs o la base. **Con el comando y la hora** |
| **REPORTADO** | Lo dijo una persona u otro carril. Sin comprobar |
| **INFERIDO** | Hipótesis, explícitamente marcada |

- Las etiquetas **caducan**: un VERIFICADO sobre algo que otro carril toca vuelve a ser REPORTADO.
- Toda cifra viaja con el comando que la produjo.
- Lo que se le pasa al siguiente carril va **medido, o marcado como no medido**.
- El estado vivo (ramas, IDs integrados, tablero) **se mide con el script**, no se copia a un `.md`.

---

## 5. Módulos activos

### Worktrees (activo desde 2026-10-15 · decisión de BR, BINDING)

> BR: _«Siempre se trabaja en Worktrees, por seguridad para no pisar código de producción. Los
> Worktrees se mergean a Testing y de Testing se hace PR a Main. La idea es que trabajen todas las
> ventanas de código en simultáneo.»_

```
worktree por ID (fix/b05-slug) ──merge──▶ Testing ──PR──▶ origin/main ──aviso──▶ Sebastián
```

- **Cada ventana de Code trabaja en su propio worktree.** Es precondición de arranque: se crea
  antes del primer cambio, **desde `Testing`**:

      git worktree add ../PLANILLA-COTIZADOR-BREKTO-wt/b05 -b fix/b05-slug Testing
      cd ../PLANILLA-COTIZADOR-BREKTO-wt/b05 && pnpm install

- Los worktrees viven **fuera del repo**, en la carpeta hermana `../PLANILLA-COTIZADOR-BREKTO-wt/`
  (no en `.claude/worktrees/`): así vitest y vite del árbol principal no recogen los tests ni los
  archivos de otros worktrees, y no hace falta tocar `.gitignore`.
- **`Testing`** (creada 2026-10-15 desde `Cotizador_Dev` en `bd8c9fb`) tiene su propio worktree
  fijo: `../PLANILLA-COTIZADOR-BREKTO-wt/testing`. El merge se hace **ahí**, nunca con `checkout`
  en otra carpeta:

      git -C ../PLANILLA-COTIZADOR-BREKTO-wt/testing merge --no-ff fix/b05-slug

  Si el merge da **conflicto**: `git -C ../PLANILLA-COTIZADOR-BREKTO-wt/testing merge --abort`,
  STOP y reportar a PP. No se resuelven conflictos sin BR. Después del merge, correr
  `pnpm test` y `pnpm build` en el worktree de `testing`; si fallan, se reporta (no se revierte
  solo).
- **El árbol principal es de BR y del PM** (rama `Cotizador_Dev`). Code no hace `checkout` ahí.
- **Autorización vigente (BR, 2026-10-15 noche):** las ventanas de Code pueden **commitear en su
  rama y mergear a `Testing` en local**. **Push y PR siguen requiriendo autorización explícita de
  BR.** Esta autorización vale para B-01 a B-08.
- El PR va de `Testing` a **`main` de `origin`** (BasTI-CI). Después se avisa a Sebastián como
  siempre (§1).
- Al integrarse una rama, su worktree se elimina (`git worktree remove`). Un worktree huérfano es
  una fuente de verdad falsa.
- Pendiente de definir con BR: qué rol queda para `Cotizador_Dev` en el nuevo flujo.

---

## 6. Idioma y tono

Español chileno neutro. **Sin voseo** ni modismos argentinos ("tenés", "querés", "mandame",
"fijate", "che"). Directo y conciso. Nada de adular. **Se puede y se debe contradecir a BR con
evidencia.** BR está aprendiendo a desarrollar apps: explica concreto y sin dar jerga por sabida.

### 6.b Tipos de mensaje (BINDING · 2026-10-15, pedido de BR)

Todo carril marca lo que le muestra a BR con **una** de estas etiquetas:

| Etiqueta | Qué es | ¿BR hace algo? |
|---|---|---|
| 💬 **Comentario** | Explicación, hallazgo, recomendación o pregunta | Solo leer / responder |
| 🔧 **Ya ejecutado** | Resumen de comandos que el carril corrió por su cuenta, con su resultado | No. Ya está hecho |
| ▶️ **CORRE ESTO** | Bloque de comandos que **le toca correr a BR** | Sí: copiar, pegar, Enter |
| 🧠 **Análisis** | Razonamiento sobre código o procesos, con su evidencia (§4) | Solo leer |
| 🤖 **Agente** | Resultado de otro carril o subagente, indicando cuál (`🤖 PP:`, `🤖 Code B-03:`) | Solo leer |

Reglas del bloque ▶️ CORRE ESTO (complementan §0 "Bloques de comandos para BR"):
1. Va **limpio**: solo comandos, sin comentarios `#` adentro.
2. Antes del bloque, una línea que diga **qué logra** y si es reversible.
3. Después, una tabla **línea por línea** con qué hace cada comando, en lenguaje simple.
4. Termina mostrando el resultado y se dice qué debería verse si salió bien.
5. Lo que publica fuera del computador (push, deploy) va en un bloque **separado** de lo local.
6. **Líneas cortas** (máx. ~70 caracteres): al copiar, las líneas largas se parten y el comando se
   rompe. Un texto largo lo escribe el carril en un archivo fuera del proyecto (ej.
   `.git/MSG_<tema>`) y el bloque solo lo referencia: `git commit -F .git/MSG_<tema>`.
7. **Nunca heredoc** (`<<EOF`): con espacios al inicio, la terminal queda esperando en `heredoc>`.
8. `git log`, `git diff` y `git show` van con `git --no-pager`, para no dejar la terminal en `:`.

Estas reglas 6–8 salen de tres bloques rotos el 2026-10-15: un `git add` sin su último archivo, un
heredoc que no cerró y un mensaje de commit partido en líneas.

Los mensajes **entre carriles** (encargos, prompts, reportes) también abren con su etiqueta
`🤖 <carril emisor> → <carril destino>`, así BR sabe de quién es cada texto que pega.
