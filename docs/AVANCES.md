# Bitácora · Cotizador Brekto

> La escribe **solo el PM**, la entrada más reciente arriba. Una entrada por hito: qué se
> registró, qué se integró, qué decidió BR. Con IDs y evidencia (`contexto-comun §4`).

## 2026-10-18

- **B-09 completo en `Testing`** (`93fc44d`). BR metió **P-09** (la UF manual no la pisa la respuesta
  tardía) y **P-10** (UF fuera de $30.000–$60.000 pide confirmación; el input del header pasa a
  aplicar con Enter/salir del campo) en el lote: en `Testing` `9c922b0`, auditados por B-09 · PP
  (134/134). Hallazgos P-11..P-15 registrados.
- **Producción replicada en local** (pedido de BR): worktree `../PLANILLA-COTIZADOR-BREKTO-wt/produccion`,
  rama `produccion` que sigue a `prod/main` (`0d71a8a`), levantada en :5181. BR corrió el merge de
  `prod/main` a `Testing` (`32669f8`): no cambia ningún archivo (mismo árbol), solo alinea historial.
- **B-10** (PDF sin desbordes, pedido de BR: «No puedo tener errores de exportación»). Decisiones de
  BR: con desborde la cotización pasa a 3 hojas «Hoja N de M»; portada/comparativa/KPIs/anexo suman
  hoja «(cont.)». **P-16** dentro de B-10 con regla BINDING de BR: «La inmobiliaria NUNCA se le
  transmite al cliente» (solo proyecto, comuna y barrio). En `Testing` `a51a056`; matriz de 17
  escenarios con 0 hojas cortadas. D-01 y D-02 cerradas. Hallazgos P-17..P-19.
- **B-11** (barrio siempre manual). Decisión de BR: al cargar una unidad el barrio queda **vacío**;
  a futuro, una API de metro más cercano (no ahora). Auditado OK (`0a29635`, 139/139).
- **Observación de proceso**: B-10 · PP auditó antes del merge y BR confirmó en la ventana de Code,
  pero PP no le avisó al PM; el PM se enteró midiendo `Testing`. Falló el aviso, no la auditoría.
- **Observación de proceso**: las ventanas de B-10 se abrieron sin agrupar por color (error del PM).
  El skill ahora exige agrupar cada vez que se abre una ventana, y abre LT + Code como **pestañas**
  de una misma ventana (`abrir-pestana.applescript`; Terminal ya tiene permiso de Accesibilidad).
- **Flujo**: BR notó que este repo trabaja con `Testing` solo local, distinto del CRM. Causa: el PM
  armó la regla desde la plantilla del skill. BR: el Cotizador se queda así hasta el cierre; el
  skill `/equipo` (módulo `worktrees`) guarda ahora **el flujo del CRM** como estándar (PR a
  `Testing` en GitHub, PR `Testing → main` del PM, `main` como validación de BR, release a
  producción; el merge siempre es de BR).
- **Rol nuevo AT · Arquitecto Técnico** (BR: «Es la pieza del puzzle que me faltaba»): ventana
  general y permanente, solo lectura, responde las preguntas de código de BR y arma el mapa de
  choques del lote. En el skill; se instala aquí al cierre del lote (P-06).
- `CLAUDE.md`: reglas de inmobiliaria y barrio; corregido que no existe PR en el fork.
- **Revisión visual de BR** del lote completo B-01..B-11 en :5180: «Revisado en vista y está ok.
  Avanza al cierre.» `CLAUDE.md` actualizado (comparativa/KPIs, Relación Arriendo / Dividendo, switch
  Compra Contado, UF, auto-paginación, sin inmobiliaria, barrio manual).

## 2026-10-17

- **En Testing:** B-01 (`6895fce`) y B-07 (`94efb1c`). Quedan fuera B-04 y B-05: los dos chocan
  con Testing y entre sí en los PDF (VERIFICADO `git merge-tree`).
- **Decisión de BR:** las ventanas de Code resuelven sus propios choques en su worktree, de a
  una: primero B-05 y después B-04. PP audita. Sin push ni PR.
- **Auditorías pedidas** a los PP de B-01, B-06 y B-07. La revisión visual de BR se hace en una
  sola pasada cuando los 8 estén en Testing.
- **Auditados OK por PP:** B-01, B-06 y B-07 (87/87, tsc, build en `Testing` `6895fce`). Para
  los tres falta solo la revisión visual de BR. Registrados P-03, P-04 y P-05 (P2).
- **Proceso:** en B-06 y B-07 Code no le reportó la vuelta a PP; PP se enteró por el PM.
- **B-05 detenido:** el permiso de la sesión de Code rechazó `git merge Testing`. Una
  autorización que llega por mensaje no reemplaza ese permiso, así que BR aprueba en la ventana.
- **B-05 en Testing** (`55cf715`, merge corrido por BR): auditado OK por PP, con 94/94 pruebas y
  sin desbordes en el peor caso (10 cotizaciones, 27 hojas, REPORTADO por Code). `CLAUDE.md`
  actualizado: D en H5, IVA por cotización, comparativa de a 5 y hasta 10 cotizaciones.
  Registrado D-01. Se pasó B-04 a su PP.
- **Decisión de BR sobre la estructura del equipo:** PP pasa a llamarse **LT · Líder Técnico**,
  con una ventana por encargo. **PG pasa a ser una sola ventana general.** Code sigue siendo una
  ventana por encargo. El skill `/equipo` (incluido `/rol`) ya está actualizado. En este proyecto
  se aplica al cerrar el lote (P-06). También quedaron en el skill el flujo de worktrees y
  `Testing` y la orquestación de ventanas (grilla con colores por encargo).
- **B-04 en Testing** (`0ac4fcb`, merge de BR), auditado OK por PP con 108/108. **Los 8
  encargos del lote están en Testing.** Sigue la revisión visual de BR en una sola pasada.
- **Revisión visual de BR** (localhost:5180 sobre Testing `0ac4fcb`): «CASI perfecto».
  Ajustes enviados a las ventanas PP de cada ID: B-01 (comparativa en 2 hojas, tabla / KPIs),
  B-08 (sección «Relación Arriendo / Dividendo») y B-04 (switch de contado en el título del
  crédito). Nuevo: **B-09**, la UF del día no llega (fallback desactualizado, 39.836 vs 41.173,33).
- **Decisiones de BR (2026-10-17, noche):** comparativa con 10 por hoja; B-09 con autorización
  de commit + merge local; si cae la UF, se corrige a mano con un aviso visible. El PM corrió el
  merge del switch de B-04 a Testing por instrucción de BR («Córrelo tú»).
- **Localhost** detenido por falta de memoria del equipo; se volvió a levantar para la revisión.

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
