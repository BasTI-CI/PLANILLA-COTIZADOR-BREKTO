# Tablero · Cotizador Brekto

> Lo mantiene **solo el PM**. Cada fila tiene ID (`contexto-comun §3`). `scripts/contexto.sh` lee
> la sección 🔴 P0: no cambies su título ni el formato de las filas (`| ID | …`).

### 🔴 P0 — Bloqueante / ahora

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|
| B-01 | Permitir hasta 10 cotizaciones (BR: máx. 10). Hoy tope duro 4 en store y UI; letras `A–D` fijas en PDF comercial y Flujo | en Testing completo (4fe4ab6): tope 10, letras A–J, selector con todas marcadas, tabla de 10 en 1 hoja, KPIs de 10 en 1 hoja (5×2) · auditado PP OK 2026-10-17 (108/108, tsc, build)  · ✅ visto por BR 2026-10-18 | BR | 2026-10-15 |
| B-02 | N° de unidad truncado desde stock (1001 → "10"): `pickNumeroUnidadFromStockRow` toma `piso`/`torre` (o `unidad_id`) antes que `unidad` | levantado (bd8c9fb) · auditado OK por PP 2026-10-16 · ✅ visto por BR 2026-10-18 | BR | 2026-10-15 |
| B-03 | Descuento s/ lista: la columna `descuento` del stock trae una fracción (0,15 = 15%, REPORTADO por BR) pero el código la trata como UF | en Testing (4764915) · auditado PP OK · ✅ visto por BR 2026-10-18 | BR | 2026-10-15 |
| B-04 | Modo "Compra contado" (booleano): paga 100% al contado; sin crédito, interés, dividendo, seguros, cuotas ni bono pie. Toca fórmulas | ajuste switch en Testing (06501ba, merge del PM autorizado por BR 2026-10-17; 108/108 y tsc en Testing) · ✅ visto por BR 2026-10-18 | BR | 2026-10-15 |
| B-05 | PDFs comercial y operacional pierden datos: texto claro sobre blanco (Dev. IVA y variables del modelo) y hojas que se cortan (sección D, anexo 60m). + IVA por cotización en su hoja | en Testing (55cf715) · auditado PP OK 2026-10-17 (94/94, tsc, build) · CLAUDE.md H4/H5 actualizado · ✅ visto por BR 2026-10-18; guardia S6 resuelta por B-10 (auto-paginación) | BR | 2026-10-15 |
| B-06 | Bono pie: se muestra aunque sea 0; falta el % (sobre escrituración) en el resumen de compra; etiquetas mezclan bono pie con BI | en Testing (9b9d198) · auditado PP OK 2026-10-17 (87/87, tsc, build; intacto tras B-01 y B-07) · ✅ visto por BR 2026-10-18 | BR | 2026-10-15 |
| B-07 | Flujo 60m con AG (solo renta larga): AG del mes entrega+2 al entrega+1+N; después, arriendo de mercado. Toca fórmulas | en Testing (94efb1c) · auditado PP OK 2026-10-17 (87/87, 10 tests nuevos, tsc, build) · §3.5.1 actualizado · ✅ visto por BR 2026-10-18 | BR | 2026-10-15 |
| B-08 | Campos "Meses de AG", "Arriendo garantizado" y "Arriendo promedio zona" en cotizador, hoja individual y resumen; apartado "Arriendo" junto a "Diferencia dividendo arriendo" (base de B-07) | en Testing completo (5cf64f2): campos AG/mercado + sección «Relación Arriendo / Dividendo» con el dividendo una vez y rótulos distintos por diferencia · auditado PP OK 2026-10-17 (108/108, tsc, build)  · ✅ visto por BR 2026-10-18 | BR | 2026-10-15 |
| B-09 | UF muestra «⚠️ referencia» aunque el valor es el real. Causa (VERIFICADO por PP con Chrome headless 2026-10-17): StrictMode en dev monta dos veces `useUF`; el fetch abortado en el cleanup pone `esFallback = true` y nadie lo vuelve a false (`useSupabase.ts:351/358`). En prod no ocurre (StrictMode no duplica efectos). Riesgo aparte: si mindicador cae, `UF_FALLBACK = 39.836` (3,25 % bajo la UF real) con aviso de 10 px | en Testing completo (93fc44d): guard de cancelación + barra de aviso con ingreso manual · auditado PP OK 2026-10-18 (120/120, tsc, build, Chrome headless a 1280 y 400 px) · worktree y rama locales borrados con OK de BR  · ✅ visto por BR 2026-10-18 | BR | 2026-10-17 |
| B-10 | PDF sin desbordes en ningún escenario: si una hoja no cabe, la sección pasa sola a la hoja siguiente; la guardia deja de dispararse (comercial y operacional). Pedido de BR 2026-10-18; cierra D-01 y D-02. Encargo `.git/ENCARGO_B-10.md` | en Testing completo (a51a056: c614373, f0e2a2e, c729c29), auditado OK por B-10 · PP antes del merge y re-auditado en Testing: 141/141, tsc OK, matriz de 17 escenarios con 0 hojas cortadas, guardia no se dispara; «Inmobiliaria» 0 veces al cliente; barrio vacío oculta la línea  · ✅ visto por BR 2026-10-18 | B-10 · PP | 2026-10-18 |
| B-11 | Barrio SIEMPRE manual en el cotizador. Decisión de BR 2026-10-18: al cargar cualquier unidad el barrio queda vacío (hoy el stock lo pisa: `mapToDatosPropiedad.ts:26`, y el backend por defecto mete el `codigo` del proyecto, `proyectosPublicRepository.ts:51`). A futuro BR quiere una API de metro más cercano (no ahora) | en Testing completo (0becd8b; 0a29635), auditado OK, 146/146 en Testing  · ✅ visto por BR 2026-10-18 | B-09 · PP | 2026-10-18 |

### 🟠 P1 — Siguiente

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|

### 🟢 P2 — Cuando haya espacio

| ID | Título | Estado | Carril actual | Abierto |
|---|---|---|---|---|
| P-02 | `pickNumeroUnidadFromStockRow` (tras B-02): sin `unidad`/`numero`, un `codigo`/`glosa` numérico le gana a `num_dpto` ({codigo:'88123', num_dpto:'316'} → 88123); y no excluye ids camelCase (`unidadId`). No afecta si el stock trae `unidad` | registrado | PM | 2026-10-16 |
| P-03 | Consola: «Revisar porcentajes ya que son diferentes a 100%» se imprime ~4.900 veces con 10 cotizaciones (REPORTADO por B-01 · PP). No cambia resultados; cuesta tiempo de render. Origen sin medir | registrado | PM | 2026-10-17 |
| P-04 | Test de B-06 «ruido flotante» no ejercita el umbral 0,005 % de `tieneBonoPie` (0,2−0,02−0,05−0,05−0,08 da 0 exacto en JS, VERIFICADO por B-06 · PP con node). Deuda de test | registrado | PM | 2026-10-17 |
| P-05 | Comentario obsoleto en `calculosCotizacion.ts:311` («no altera flujo ni cap rate»): con B-07 el AG sí altera el flujo (REPORTADO por B-07 · PP). 1 línea | registrado | PM | 2026-10-17 |
| P-06 | Al cerrar el lote B-01..B-08: renombrar el carril PP → **LT · Líder Técnico** y pasar a **un PG general** en este proyecto (`equipo.conf`, `contexto-pp.md` → `contexto-lt.md`, `contexto-comun` §0 y §3, `contexto-pm`, `contexto-code`, `contexto-pg`). Decisión de BR 2026-10-17; el skill `/equipo` ya está actualizado Además (BR 2026-10-18): sumar el rol **AT · Arquitecto Técnico** general y permanente (plantilla del skill `roles/at.md`), y abrir las ventanas de cada encargo como pestañas LT + Code en una misma ventana. | registrado · se aplica después del PR del lote | PM | 2026-10-17 |
| P-07 | Generación del PDF con 10 cotizaciones: 50 s en Testing 10f225d vs 7,8 s antes de B-03..B-08 (REPORTADO por Code de B-01; causa sin medir: carga de la máquina con muchas sesiones o algo integrado). Medir en el equipo de BR con pocas ventanas abiertas. Relacionado con P-03 (4.900 console.warn). Actualización: con Testing 2ba5079 la misma prueba dio 13,3 s (REPORTADO por Code; INFERIDO que los 50 s fueron carga de la máquina) | registrado | PM | 2026-10-17 |
| P-08 | `fmtCLP` muestra los negativos como «$-47.900» en vez de «-$47.900» (REPORTADO por B-08 · PP; anterior a B-08). Afecta las diferencias arriendo − dividendo | registrado | PM | 2026-10-17 |
| P-09 | UF: si se edita a mano mientras carga mindicador, la respuesta tardía pisa el valor manual y la etiqueta queda en «✎ ingresada a mano» (`App.tsx:42-47`; REPORTADO por Code por lectura, tras B-09). ~1 línea | en Testing completo (9c922b0; 2ba567e), auditado OK 134/134  · ✅ visto por BR 2026-10-18 | B-09 · PP | 2026-10-18 |
| P-10 | UF sin validación de rango: se acepta cualquier valor > 0 (ej. 4) en la barra y en el input del header, y se propaga al motor y a los PDF (REPORTADO por B-09 · PP). BR decidió (2026-10-18): fuera de $30.000–$60.000 pide confirmación. Consecuencia: el input del header pasa a aplicar al confirmar (Enter o salir del campo; Escape cancela), igual que la barra. Worktree p09, rama fix/p09-p10-uf | en Testing completo (9c922b0; 6bfba4b), auditado OK 134/134  · ✅ visto por BR 2026-10-18 | B-09 · PP | 2026-10-18 |
| P-11 | A 400 px de ancho la página mide 895 px (scroll horizontal en móvil). Preexistente (REPORTADO por Code de B-09) | registrado | PM | 2026-10-18 |
| P-12 | La barra de aviso de UF sale al imprimir con `window.print()` (falta `@media print`). No afecta a los PDF exportados | registrado | PM | 2026-10-18 |
| P-13 | UF: mientras carga, el header muestra «...» aunque ya se ingresó a mano; el valor se ve recién al llegar mindicador o a los 6 s (preexistente, VERIFICADO por B-09 · PP en navegador) | registrado · BR decide | PM | 2026-10-18 |
| P-14 | UF: tras ingresarla a mano, solo se vuelve a la de mindicador recargando la página; no hay botón «volver a UF automática» (consecuencia de P-09; REPORTADO por B-09 · PP) | registrado · BR decide | PM | 2026-10-18 |
| P-15 | Menor: `parsearUF` acepta basura al final («41.173abc» → 41.173) y el texto del confirm repite el rango a mano en vez de usar las constantes (REPORTADO por B-09 · PP) | registrado · baja prioridad | PM | 2026-10-18 |
| P-16 | PDF comercial: la tarjeta «Información del Proyecto» muestra «Inmobiliaria: <nombre del proyecto>» (`ModuloPDF.tsx:396`); dato incorrecto al cliente y duplica el texto largo. El operacional sí usa inmobiliariaNombre (REPORTADO por B-10 · PP) BR decidió (2026-10-18): la inmobiliaria NUNCA se le transmite al cliente; en el PDF comercial solo proyecto, comuna y barrio | entra en B-10 (B-10 · PP) | B-10 · PP | 2026-10-18 |
| P-17 | `index.css:584` aplica `td { text-align: right }` a toda la app y se cuela en las tablas de portada y comparativa del PDF: la columna Proyecto sale alineada a la derecha (cosmético, preexistente; REPORTADO por B-10 · PP) | registrado · baja prioridad | PM | 2026-10-18 |
| P-18 | Los estilos de hoja PDF (B-05) solo aplican con `data-pdf-page="true"`: cualquier render fuera de una hoja se ve distinto. La medición de B-10 ya lo cubre con `[data-pdf-medicion]` (REPORTADO por Code B-10) | registrado · deuda menor | PM | 2026-10-18 |
| P-19 | Con 10 cotizaciones, la J salió sin tipología en portada y comparativa en el arnés de B-10 · PP. INFERIDO que es del arnés y no de la app; sin investigar. Verificar en la revisión visual de BR | registrado · verificar | PM | 2026-10-18 |
| N-02 | Sitio Netlify `cotizador-multiple-brekto` (cuenta de BR) apunta a rama `dev` inexistente en `origin`; último deploy 2026-04-24. Decidir: reapuntar a `Cotizador_Dev` o eliminar | registrado | BR | 2026-10-14 |

### 🟣 Deuda con disparador

| ID | Deuda | Disparador (cuándo se vuelve urgente) | Abierto |
|---|---|---|---|
| D-02 | ✅ **Cerrada por B-10 (2026-10-18)**: re-medido, si no cabe la sección pasa de hoja (D-01: 50 px; D-02: 13 px mínimo). Antes: Hoja 2 de cada cotización (PDF comercial) con poca holgura con AG: peor caso AG + IVA + 9 promociones = 25,5 px libres (~1 fila) tras el dividendo único de B-08 (VERIFICADO por Code con Chrome headless; antes 0 px) | Si se agrega una fila a la Hoja 2 (texto reconstruido por el PM) | 2026-10-17 |
| D-01 | ✅ **Cerrada por B-10 (2026-10-18)**: re-medido, si no cabe la sección pasa de hoja (D-01: 50 px; D-02: 13 px mínimo). Antes: Anexo 60m tramo 25–48 del PDF comercial quedó con solo 22 px libres tras B-05 (REPORTADO por Code, medidas_merge10.json) | Si se agregan columnas o filas al anexo | 2026-10-17 |

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

**Último ID usado por prefijo** (actualízalo al numerar): B-11 · P-19 · N-03 · D-02
