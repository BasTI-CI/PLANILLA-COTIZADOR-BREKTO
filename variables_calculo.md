# Variables y cálculos — Cotizador Brekto

Referencia para **auditoría y futura librería** (p. ej. API en v2). El código debe seguir este documento; la UI solo muestra etiquetas para el asesor.

**Alcance:** **Cotización** (una unidad = `Cotizacion`), **Resumen de inversión** (series auxiliares §3.6), **Flujo / IVA / diversificación** (§4). El detalle unitario del precio/pie/crédito vive en el motor de cotización; el flujo 60 meses consolida varias unidades activas.

**Motor principal:** `calcularResultadosCotizacion(cot, uf_valor_clp)` → `ResultadosCotizacion`.

**Documento hermano (alcance Resumen de inversión):** `CONTEXTO_RETOMAR_RESUMEN_INVERSION.md` — las **definiciones fijas** de negocio para esa pestaña deben coincidir con **§1.0** de este archivo; cualquier cambio de fórmula se anota aquí primero.

### Prioridad: motor de cálculo vs capa de datos (Supabase)

- **Fuente de verdad del negocio** es el contrato de código: `Cotizacion` / `ResultadosCotizacion` en `src/types/index.ts`, las funciones en `src/lib/engines/*`, los tests y **este documento**. Ahí deben estar **definidas y auditables** las variables de cálculo y las fórmulas.
- **La base de datos conectada hoy vía Supabase no es la definitiva.** Solo sirve para **validar el flujo de carga y los cálculos** con datos reales de **una inmobiliaria y un proyecto**. El esquema definitivo contemplará un ecosistema mucho mayor (orden de magnitud: **~30 inmobiliarias**, **~260 proyectos**, **>10.000 unidades** de stock), con tablas dinámicas y columnas que **aún no existen** en el esquema provisional.
- **Habrá un remapeo explícito** entre columnas de la BD definitiva y campos como `DatosPropiedad` cuando esa capa esté lista. Hasta entonces, el mapeo actual (`Stock_Imagina_Prueba` → fila → `UnidadSupabase` / `DatosPropiedad` en `useSupabase.ts`) es **temporal y deliberadamente acotado**: no debe arrastrar nombres de columnas legacy al motor ni a este documento más allá de la tabla de § «Desde API».
- **Implicación para el equipo:** invertir en **claridad de variables y funciones de cálculo** tiene más valor que pulir el mapeo Supabase actual; el segundo se reemplazará al cerrar el modelo de datos de producción.

Archivos de implementación:

| Archivo | Rol |
|---------|-----|
| `src/lib/engines/calculosCotizacion.ts` | Tasación, escritura, pie total, hipotecario, plusvalía, arriendo |
| `src/lib/engines/calculosPie.ts` | Desglose del pie en CLP (upfront, cuotas, cuotón) sobre **valor escrituración** |
| `src/lib/engines/calculosDiversificacion.ts` | Flujo 60 meses: pie por tramo, dividendo−arriendo post-entrega, IVA |
| `src/lib/engines/precioCompra.ts` | Precio de compra depto (UF/CLP) y base **IVA** (15 % sobre solo depto) |
| `src/lib/engines/resumenGraficos.ts` | Patrimonio semestral, liquidez mes 60 (comparativa Resumen) |
| `src/lib/engines/validarCalculosCotizacion.ts` | Comprobaciones de coherencia motor vs fórmulas (§8) |
| `src/types/index.ts` | Contrato TypeScript `Cotizacion` / `ResultadosCotizacion` |

**Validar cálculos**

1. `pnpm test` — cubre fórmulas §3.1–3.5, hipotecario, pie CLP, IVA/flujo básico, y casos de error (pie+LTV ≠ 100%, lista≠neto).
2. `validarResultadosCotizacion(cot, res)` en `src/lib/engines/validarCalculosCotizacion.ts` — recomputa §3.1 y cruza pie/crédito/amortización; devuelve `{ ok, fallos[] }` para tests o API futura.
3. `recomputarValorEscrituraUf` / `recomputarValorTasacionUf` — mismas fórmulas que el motor, para auditoría manual o hoja Excel.

---

## Cotización — origen de datos

Objetivo v2: la **librería** recibe un JSON alineado con `Cotizacion`; la web rellena ese objeto desde API + formulario.

### Arquitectura de datos en producción (vigente)

Dos proyectos Supabase dentro de la cuenta **Capital_Desarrollo**, consumidos por el cotizador:

```
Cotizador_Multiple_Dev   ← el front se conecta aquí (VITE_SUPABASE_URL / ANON_KEY)
├── tabla: inmobiliarias     (id, codigo, nombre)
├── tabla: proyectos         (id, id_inmobiliaria, codigo, nombre, nombre_inmobiliaria, estado)
└── edge functions:
    ├── get-tipologias       → proxy a Brekto (x-internal-token)
    └── get-stock            → proxy a Brekto (x-internal-token)

Brekto_Dev               ← base maestra de stock (no accesible desde el front)
├── tabla: stock             (columnas documentadas abajo)
└── edge functions:
    ├── stock-get-tipologias
    └── stock-get-stock
```

**Flujo UI de filtros (sin cambios — ya funciona):**

1. **Dropdown Inmobiliaria** — query directa a `Cotizador_Multiple_Dev.inmobiliarias`.
2. **Dropdown Proyecto** — query directa a `Cotizador_Multiple_Dev.proyectos` filtrada por `id_inmobiliaria`.
3. **Dropdown Tipología** — `supabase.functions.invoke('get-tipologias', { inmobiliaria, proyecto })` → proxy a Brekto.
4. **Dropdown Unidad** — `supabase.functions.invoke('get-stock', { inmobiliaria, proyecto, tipologia?, unidad? })` → proxy a Brekto → devuelve filas de `stock`.

No se crean tablas nuevas ni repositorios. El front **nunca toca** `Brekto_Dev.stock` directamente: siempre vía edge function.

### Mapeo columnas `stock` (Brekto) → `UnidadSupabase` → `DatosPropiedad`

Implementado en `mapStockItemToUnidadSupabase` ([src/lib/getStock.ts](src/lib/getStock.ts)) y en el puente `unidadSupabaseToDatosPropiedad` ([src/lib/stock/mapToDatosPropiedad.ts](src/lib/stock/mapToDatosPropiedad.ts)).

#### Proyecto (denormalizado en el row de stock)

| Columna `stock` | `UnidadSupabase` (opc.) | `DatosPropiedad` | Notas |
|---|---|---|---|
| `proyecto` | `proyecto_nombre` | `proyecto_nombre` | Precedencia sobre `ProyectoSupabase.nombre` si viene |
| `comuna` | `comuna` | `proyecto_comuna` | Precedencia sobre `ProyectoSupabase.comuna` si viene |
| — | — | `proyecto_barrio` | `""` (no se usa) |
| `direccion` (ignorado) | — | `proyecto_direccion` | `""` — ocultado hasta cierre comercial |

#### Unidad

| Columna `stock` | `UnidadSupabase` | `DatosPropiedad` |
|---|---|---|
| `unidad` | `numero` | `unidad_numero` |
| `tipologia` | `tipologia` | `unidad_tipologia` |
| `superficie_util` | `sup_interior_m2` | `unidad_sup_interior_m2` |
| `superficie_terraza` | `sup_terraza_m2` | `unidad_sup_terraza_m2` |
| `m2_total` | `sup_total_m2` | `unidad_sup_total_m2` |
| `orientacion` | `orientacion` | `unidad_orientacion` |
| `entrega` | `entrega` | `unidad_entrega` |

#### Precios (UF)

| Columna `stock` | `UnidadSupabase` | Notas |
|---|---|---|
| `precio_lista` | `precio_lista_uf` | Directo |
| `descuento` | `descuento_uf` | Directo |
| — (NO se lee) | `precio_neto_uf` | **Derivado en el mapper:** `precio_lista − descuento`. Cumple invariante §8.1 por construcción. La columna `precio_neto` de `stock` existe pero **no se usa** (es redundante con la derivación). |

#### Bonos / beneficios

| Columna `stock` | `UnidadSupabase` | Notas |
|---|---|---|
| `f_desc_bono_inmobiliario` | `bono_descuento_pct` | **BD en %, motor en decimal:** el mapper divide por 100 (ej. `15` → `0.15`). Convención de nombre: prefijo `f_` = factor guardado como porcentaje. |
| — | `bono_max_pct` | Default `0`. El asesor lo ingresa en el formulario como «Descuento por Bonificación (%)». En stock existe `f_beneficio_max_inmobiliario` pero hoy **no se consume**. |
| — | `bono_aplica_adicionales` | Default `false`. El asesor lo marca en el formulario. |

#### Adicionales y operacional

| Columna `stock` | `UnidadSupabase` | Notas |
|---|---|---|
| — | `estacionamiento_uf` | Default `0`. Columna `uf_estacionamiento` existe en stock pero hoy **no se consume**. |
| — | `bodega_uf` | Default `0`. Columna `uf_bodega` existe pero hoy **no se consume**. |
| — | `pie_pct` | Default `0` (el form arranca con `DEFAULT_PIE.pie_pct = 0.10`). Columna `f_pie` existe pero hoy **no se consume**. |
| — | `disponible` | Siempre `true`. El stock maestro ya entrega solo unidades vigentes (filtro aguas arriba); `stock.estado` no se consume en este cotizador. |
| — (no mapeado a `DatosPropiedad` aquí) | — | `reserva_clp` se completa con `DEFAULT_RESERVA = 100_000` en el puente; la columna `reserva` del stock existe pero hoy **no se consume**. |

### Rellenados en sesión (manual en formulario)

No dependen de la fila de stock (o se sobreescriben):

- **`DatosDesglosePie`** — toda la sección pie: `pie_pct`, `upfront_pct`, cuotas antes/después, cuotón, `pie_n_cuotas_total`.
- **`DatosHipotecario`** — tasa, plazo, % aprobación, seguros.
- **`DatosRentabilidad`** — plusvalía, arriendo / AirBnB.
- **`uf_valor_clp`** en `DatosGlobales` — API UF del día o ingreso manual.
- **`reserva_clp`** — default 100.000 CLP; operación comercial.
- **Campos de unidad con default en mapper:** `bono_max_pct`, `bono_aplica_adicionales`, `estacionamiento_uf`, `bodega_uf`, `pie_pct` (ver cuadros arriba).

### Deuda técnica documentada

1. **Columnas de stock ignoradas:** `precio_neto`, `f_beneficio_max_inmobiliario`, `f_pie`, `uf_estacionamiento`, `uf_bodega`, `reserva`, `estado`, `cantidad`, `precio_total`, `precio_web`, `archivo_origen`, `upload_id`, `aprobado*`, `pre_reserva_info`, etc. Si negocio quiere consumir alguna, el único lugar a tocar es `mapStockItemToUnidadSupabase`.
2. **`precio_neto` redundante en stock:** la columna existe pero el front la deriva (`lista − descuento`) para garantizar la invariante §8.1. Si en algún momento el stock guarda descuentos adicionales no reflejados en `descuento`, habría que redefinir.
3. **Repositorios legacy aún en código:** `ImaginaPruebaStockRepository`, `SupabaseDefinitivoRepository`, `ProyectosPublicRepository`. La capa de stock del flujo productivo es la edge function `get-stock`; los repos sirven como fallback local (modo demo sin Supabase). No alineados 1:1 con el flujo productivo.

### Plantillas para futuros mappings (cuando el stock agregue más columnas)

Cuando Brekto exponga una columna que ya se mapea con default, reemplazar el default por lectura real en `mapStockItemToUnidadSupabase`. Ejemplos:

```ts
// Hoy:
bono_max_pct: 0,

// Cuando la columna se active:
bono_max_pct:
  raw.f_beneficio_max_inmobiliario != null
    ? n(raw.f_beneficio_max_inmobiliario) / 100
    : 0,
```

Actualizar entonces esta sección marcando la columna como «consumida».

---

## 1) Variables de entrada (`Cotizacion`)

Los **identificadores** son el contrato código/API. Las **etiquetas** en pantalla pueden diferir (tabla siguiente).

### 1.0 Definiciones fijas — negocio vs código (documento maestro)

Estas definiciones están **fijadas** para alinear la comparativa del **Resumen de inversión** con el motor (`calculosCotizacion.ts`, `calculosPie.ts`, `validarCalculosCotizacion.ts`). **No cambiar el significado** sin actualizar este apartado y los tests asociados.

#### 1.0.0 Diferenciación clave: lista, precio de compra, valor tasación, valor escrituración

Son **cuatro magnitudes distintas**. Mezclarlas en etiquetas o en celdas (Cotización, Simulador, **Resumen**, Flujo) produce errores de interpretación y de fórmula. En el código, cada una tiene un rol preciso en la cadena de cálculo.

##### Qué es cada una (orden lógico)

| Magnitud | Qué representa (negocio) | Variable en código | Cómo se obtiene |
|----------|--------------------------|--------------------|-----------------|
| **1. Precio lista** | Valor de catálogo / lista del **departamento** antes de los descuentos comerciales que el asesor aplica en la negociación. Es el punto de partida del “descuento UF”. | `precio_lista_uf` | Entrada: stock/API o manual. |
| **2. Precio de compra** | Monto **neto comercial** por rubro **después** de **todos** los descuentos comerciales (lista, y el % «Descuento por Bonificación» si aplica en cadena). **No** incluye BI hacia tasación. | **Depto en pantalla / total:** `precio_neto_uf × (1 − bono_max_pct) + est. + bod.` donde `precio_neto_uf` cumple `lista − descuento` (paso previo al % bonificación en el motor). Adicionales ya netos por ítem. Ver `precioCompraDeptoUf` / `precioCompraTotalUf`. | Si el neto **ya incluye** el paso de bonificación, `bono_max_pct = 0` (§1 “Mapeo secuencial”). |
| **3. Valor tasación** (depto) | Valor del depto **tal como lo usa el esquema de financiamiento / tasación**: **solo después** de cerrado el precio de compra del depto se aplica la lógica de §3.1 (**beneficio inmobiliario** `bono_descuento_pct` y **Descuento por Bonificación** `bono_max_pct`). En el ejemplo de referencia, “Precio con Bono Pie” del depto = 2.881,33 ÷ (1 − 0,15) = **3.389,80 UF**. | `valor_tasacion_uf` | **Solo depto:** `valorTasacionDeptoUf(precio_neto_uf, bono_descuento_pct, bono_max_pct)`. No incluye estacionamiento ni bodega. |
| **4. Valor (precio) de escrituración** | **Base total de la operación en escritura:** valor tasación del depto **más** estacionamiento y bodega expresados en UF, según reglas de §3.1 (si `bono_aplica_adicionales`, los adicionales pueden repercutir el beneficio inmobiliario). Sobre este valor se calculan **pie %**, **crédito**, **plusvalía base**, **IVA** en flujo, etc. | `valor_escritura_uf` | `valor_tasacion_uf + adicionales_en_escritura_uf` (ver §3.1). |

##### Orden obligatorio (descuentos → compra → BI / tasación)

1. **Primero:** aplicar **todos** los descuentos comerciales (sobre lista) a depto y, si corresponde, a estacionamiento y bodega → queda definido el **precio de compra** por componente.  
2. **Después y solo después:** aplicar el **beneficio inmobiliario %** (y en el motor el **Descuento por Bonificación %** si no va ya absorbido en el neto) para obtener **valor tasación** del depto y, con adicionales según §3.1, **valor escrituración**.  
3. El **crédito %** (p. ej. 80 %) se calcula sobre la **base post-BI** (p. ej. “Precio con Bono Pie” / `valor_escritura_uf` según caso), no sobre el precio de compra neto comercial.

##### Cadena visual (solo depto → luego adicionales)

```mermaid
flowchart LR
  PL["Precio lista\nprecio_lista_uf"]
  PD["Descuento UF\ndescuento_uf"]
  PC["Precio de compra\nprecio_neto_uf"]
  VT["Valor tasación depto\nvalor_tasacion_uf"]
  AD["+ Estac. + Bodega\n§3.1"]
  VE["Valor escrituración\nvalor_escritura_uf"]

  PL --> PD
  PD --> PC
  PC --> VT
  VT --> AD
  AD --> VE
```

Sobre el **depto**, la transición **precio de compra → valor tasación** no es otro “descuento de lista”: es la **repercusión del BI** (y regla de `bono_max_pct` en §3.1) **sobre el precio de compra ya cerrado**. En el ejemplo numérico citado arriba, ese paso es equivalente a **precio de compra depto ÷ (1 − beneficio inmobiliario)** cuando solo aplica el BI y el Descuento por Bonificación ya está absorbido en el neto (`bono_max_pct = 0` en el motor).

##### Relación con otros resultados (para no confundir celdas)

| Resultado | Relación |
|-----------|----------|
| `beneficio_inmobiliario_uf` | Monto asociado al **beneficio inmobiliario %** sobre la **tasación del depto:** `valor_tasacion_uf × bono_descuento_pct`. No es el “precio de compra”; es parte del esquema que separa neto comercial de valor tasación. |
| `precio_compra_total_uf` (derivado, §1.0.1) | **Depto** a precio de compra = `precio_neto_uf × (1 − bono_max_pct)` (Desc. por Bonificación); total = eso + `estacionamiento_uf` + `bodega_uf` (pre-BI). `precio_neto_uf` es neto **solo** tras descuentos sobre lista, antes de ese %. El motor sigue usando `valor_escritura_uf` para pie y crédito. |

##### Impacto por pestaña (lectura obligatoria para UI)

| Pestaña | Qué debe mostrar / usar |
|---------|-------------------------|
| **Cotización** | **Lista**, **descuento**, **precio de compra** (`precio_neto_uf`); resultados **valor tasación** y **valor escrituración** como solo lectura. Etiquetas claras: no llamar “precio neto” a lo mismo que “valor tasación”. |
| **Simulador (hipotecario)** | Crédito y dividendos sobre **`valor_escritura_uf`** (y LTV), no sobre precio lista ni solo precio de compra del depto. |
| **Resumen de inversión** | Comparativa: columna de **precio de compra** = criterio comercial (`precio_neto_uf` y/o total según §1.0.1); montos de **pie** y **crédito** referidos a **`valor_escritura_uf`**. No mezclar “precio de compra” con “valor escrituración” en la misma celda sin etiqueta explícita. |
| **Flujo / IVA** | IVA y bases de flujo que dependen del valor de la operación en escritura usan criterios definidos en §4 (p. ej. `valor_escritura_uf` donde aplique). |

#### 1.0.1 Nombres comerciales (Resumen) ↔ variables

| Nombre comercial (fijo) | Significado de negocio | Variable(es) en código | Notas / fórmula |
|-------------------------|------------------------|-------------------------|-----------------|
| **PRECIO DE COMPRA** | **Lista menos descuentos comerciales** (incl. cadena con % bonificación vía motor). Base **antes del BI**; **no** incluye “precio con bono pie” hacia tasación. | **Depto:** `precioCompraDeptoUf(propiedad)` (= `precio_neto_uf × (1 − bono_max_pct)`). **Total:** `precioCompraTotalUf`. | **No** es `valor_tasacion_uf` ni `valor_escritura_uf`. El **BI** (`bono_descuento_pct`) va en §3.1 **después** del precio de compra depto. |
| **Precio neto (etiqueta histórica en UI)** | En pantalla y tablas antiguas suele mostrarse el neto del **depto** únicamente. | `propiedad.precio_neto_uf` | Sustitución de etiqueta hacia **PRECIO DE COMPRA** según fila mostrada (solo depto vs total con adicionales) — ver `CONTEXTO_RETOMAR_RESUMEN_INVERSION.md`. |
| **Pie a documentar** | Porcentaje y monto del pie sobre **valor de escrituración**. | `pie.pie_pct`; resultado: `pie_total_uf` = `valor_escritura_uf × pie_pct` | `calcularResultadosCotizacion` |
| **Bono pie** | Parte del pie que la inmobiliaria **bonifica** (no la cuota de caja del cliente por ese tramo). En el formulario es el **resto** del `pie_pct` respecto de upfront + cuotas antes/después + cuotón (todos como % sobre **valor escrituración** en la planilla de referencia). | En UF: conceptualmente `bono_pie_uf = valor_escritura_uf × pct_bonificacion_pie`, con `pct_bonificacion_pie = pie_pct − upfront_pct − cuotas_antes_entrega_pct − cuotas_despues_entrega_pct − cuoton_pct` (coherente con `CotizacionForm.tsx`). | Hasta que exista campo dedicado en `DatosDesglosePie`, el valor se **deriva** de los % anteriores. No confundir con `beneficio_inmobiliario_uf` (beneficio sobre **tasación** del depto, `bono_descuento_pct`). |
| **PIE A PAGAR** | Efectivo / obligación de pie que efectivamente asume el cliente frente al pie documentado y la bonificación de pie. | **Definición acordada:** `pie_a_pagar_uf = pie_total_uf − bono_pie_uf` (mismos símbolos que arriba). | Debe mostrarse en comparativa cuando **Bono pie** esté explícito. |

#### 1.0.2 Qué NO es “precio de compra” (para no mezclar celdas)

| Variable / resultado | Por qué no es “precio de compra” |
|----------------------|----------------------------------|
| `valor_tasacion_uf` | Incluye repercusión del **beneficio inmobiliario** (`bono_descuento_pct`) sobre el neto del depto: es base “banco / tasación”, no el desembolso comercial “neto lista”. |
| `valor_escritura_uf` | Tasación depto + adicionales según §3.1; sigue sin ser el “precio de compra” del cuadro comercial si la definición excluye explícitamente mecanismos tipo bono pie sobre tasación. |
| `beneficio_inmobiliario_uf` | Es `valor_tasacion_uf × bono_descuento_pct` (beneficio sobre tasación), **no** el “bono pie” del desglose de pie en cuotas. |

#### 1.0.3 Mapa función ↔ variables (cotización)

| Función | Archivo | Entradas relevantes (`Cotizacion` / globales) | Salidas usadas en comparativa / resumen |
|---------|---------|-----------------------------------------------|----------------------------------------|
| `calcularResultadosCotizacion` | `calculosCotizacion.ts` | `propiedad.precio_neto_uf`, `bono_descuento_pct`, `bono_max_pct`, `estacionamiento_uf`, `bodega_uf`, `bono_aplica_adicionales`, `pie.pie_pct`, `hipotecario.*`, `rentabilidad.*`, `uf_valor_clp` | `valor_tasacion_uf`, `valor_escritura_uf`, `beneficio_inmobiliario_uf`, `pie_total_uf`, `pie_total_clp`, `hipotecario.monto_credito_*`, `hipotecario.dividendo_*`, `plusvalia.*`, `arriendo.*` |
| `valorTasacionDeptoUf` | `calculosCotizacion.ts` | `precio_neto_uf`, `bono_descuento_pct`, `bono_max_pct` | `valor_tasacion_uf` (paso intermedio de escritura) |
| `calcularMontosDesglosePieClp` | `calculosPie.ts` | `valor_escritura_uf`, `pie.*`, `uf_valor_clp` | Montos upfront / cuotas / cuotón en CLP (cada % sobre **valor escrituración**; §3.2 y §9) |
| `calcularHipotecario` | `calculosCotizacion.ts` | `valor_escritura_uf`, `hipotecario.*`, `uf_valor_clp` | `monto_credito_uf`, `dividendo_*`, tabla amortización |
| `calcularPlusvalia` | `calculosCotizacion.ts` | `valor_escritura_uf`, `pie_total_uf`, `plusvalia_anual_pct`, `plusvalia_anos` | Proyección venta / utilidad |
| `calcularArriendo` | `calculosCotizacion.ts` | `rentabilidad.*`, dividendo, `valor_escritura_uf`, `uf_valor_clp` | Cap rates, flujo vs dividendo |
| `validarResultadosCotizacion` | `validarCalculosCotizacion.ts` | `cot`, `res` | Auditoría coherencia §3.1–3.2 vs motor |
| `recomputarValorTasacionUf` / `recomputarValorEscrituraUf` | `validarCalculosCotizacion.ts` | `propiedad` | Misma geometría que el motor para tests |

**Valores derivados para la comparativa (no son campos guardados hasta nueva versión de tipos):**

- `precio_compra_total_uf` = `precio_neto_uf × (1 − bono_max_pct) + estacionamiento_uf + bodega_uf` (definición de referencia; `precioCompraTotalUf`).
- `bono_pie_uf` = `valor_escritura_uf × (pie_pct − upfront_pct − cuotas_antes_entrega_pct − cuotas_despues_entrega_pct − cuoton_pct)` con los % del desglose alineados a la planilla.
- `pie_a_pagar_uf` = `pie_total_uf − bono_pie_uf`.

### Etiquetas UI ↔ variable (pestaña Cotización)

| Etiqueta (asesor) | Variable |
|-------------------|----------|
| Beneficio inmobiliario (%) | `bono_descuento_pct` |
| Descuento por Bonificación (%) | `bono_max_pct` |
| Bono adicionales | `bono_aplica_adicionales` |
| PIE a documentar (%) | `pie.pie_pct` |
| Upfront, % antes/después, cuotón, N° cuotas… | campos en `pie` (ver lista) |
| Tasa, plazo, financiamiento, seguros | campos en `hipotecario` (ver lista) |
| Valor tasación (UF) (solo lectura) | `valor_tasacion_uf` (resultado) |
| Valor escrituración (UF) (solo lectura) | `valor_escritura_uf` (resultado) |
| Resumen «Bono descuento (UF)» en PDF/simulador | `beneficio_inmobiliario_uf` (resultado) |

### Mapeo cotizador secuencial (referencia comercial)

En planillas con **varios % de descuento en cadena** sobre el precio lista y luego una **bonificación %** hacia escrituración:

| Paso en cotizador depurado | Equivalente en esta app |
|----------------------------|-------------------------|
| 1.er descuento (% s/ lista) | **Dcto. (% s/ lista)** + **Dcto. (UF)** (y coherencia con **Precio neto**). Varios pasos secuenciales deben **reflejarse en el precio neto** cargado (manual o derivado). |
| 2.do descuento | Hoy no hay campo propio; puede integrarse en el neto o en el primer dcto. |
| 3.er descuento (% s/ precio ya rebajado) | **Descuento por Bonificación (%)** (`bono_max_pct`) **solo si** ese % debe aplicarse **en el motor** además del neto. Si el neto **ya incluye** ese paso (como en la landing «Precio con descuento»), dejar **Descuento por Bonificación % = 0** para no duplicar. |
| Bonificación % (→ valor escrituración) | **Beneficio inmobiliario (%)** (`bono_descuento_pct`). Con neto ya final y sin `bono_max` extra: tasación/escritura depto siguen `precio_neto ÷ (1 − beneficio)` (caso típico bonificación pura). |

### `DatosPropiedad` (antecedentes + detalle precio)

- Identificación: `proyecto_*`, `unidad_*` (número, tipología, superficies, orientación, entrega).
- Precio: `precio_lista_uf`, `descuento_uf`, `precio_neto_uf` con invariante `precio_neto_uf = precio_lista_uf - descuento_uf`.
- Tasación / escritura (inputs): `bono_descuento_pct`, `bono_max_pct`, `bono_aplica_adicionales`, `estacionamiento_uf`, `bodega_uf`.
- Operación: `reserva_clp`.

### `DatosDesglosePie`

- `pie_pct` — pie documentado sobre `valor_escritura_uf` → `pie_total_uf = valor_escritura_uf × pie_pct`.
- `upfront_pct`, `cuotas_antes_entrega_pct`, `cuotas_antes_entrega_n`, `cuotas_despues_entrega_pct`, `cuotas_despues_entrega_n`, `cuoton_pct`, `cuoton_n_cuotas` — cada `%` del desglose se aplica sobre **`valor_escritura_uf`** (no sobre `pie_total_uf`); los montos en $ del resumen pie usan esa base.
- `pie_n_cuotas_total` — usado en **diversificación / flujo 60 meses** (`calculosDiversificacion.ts`) para repartir el pie en cuota mensual equivalente; **no** entra al cálculo de upfront / cuota antes / después / cuotón en `calculosPie.ts`.

No hay validación automática de que la suma de % de desglose coincida con `pie_pct`.

### `DatosHipotecario`

- `hipotecario_tasa_anual`, `hipotecario_plazo_anos`, `hipotecario_aprobacion_pct` (LTV).
- `hipotecario_seg_desgravamen_uf`, `hipotecario_seg_sismos_uf`, `hipotecario_tasa_seg_vida_pct`.

### `DatosRentabilidad`

Usado por `calcularResultadosCotizacion` para plusvalía y arriendo (§3.4–3.5): `tipo_renta`, `plusvalia_anual_pct`, `plusvalia_anos`; renta larga: `arriendo_mensual_clp`; renta corta: `airbnb_valor_dia_clp`, `airbnb_ocupacion_pct`, `airbnb_admin_pct`, `gastos_comunes_clp` (el bruto mensual corto **no** se ingresa; se deriva en motor). Ver `types/index.ts`.

### Regla pie + crédito

`pie_pct + hipotecario_aprobacion_pct` debe ser `≈ 1`. Si no, el motor solo emite `console.warn`; conviene validar en API v2.

### Diversificación (fuera del detalle cotización)

Variables globales del módulo 60 meses: `diversif_*`, `mes_entrega_primer_depto`, etc. Ver §4.

---

## 2) Salida del motor (`ResultadosCotizacion`)

Todo sale de `calcularResultadosCotizacion`. Campos raíz:

| Campo | Significado |
|-------|-------------|
| `precio_compra_total_uf` | Entrada comercial: `precioCompraTotalUf` = depto (`precio_neto × (1 − b_max)`) + adicionales a precio compra. Ver `precioCompra.ts`. |
| `valor_tasacion_uf` | Depto: fórmula §3.1 sobre `precio_neto_uf` (beneficio inmob. y `bono_max_pct`). |
| `valor_escritura_uf` | Base banco: `valor_tasacion_uf` + adicionales (§3.1). |
| `beneficio_inmobiliario_uf` | `valor_tasacion_uf * bono_descuento_pct` |
| `pie_total_uf` / `pie_total_clp` | Pie documentado sobre `valor_escritura_uf` |
| `hipotecario` | `monto_credito_*`, `dividendo_*`, `tabla_amortizacion` |
| `plusvalia` | Proyección venta (§3.4) |
| `arriendo` | Flujo vs dividendo (§3.5) |

Para **solo** precio/pie/crédito en un microservicio futuro, el subconjunto mínimo suele ser: `valor_*`, `beneficio_inmobiliario_uf`, `pie_total_*`, `hipotecario.monto_credito_*`, `hipotecario.dividendo_*` (sin obligar plusvalía/arriendo).

---

## 3) Formulas implementadas (vigentes)

## 3.1 Base propiedad / escrituracion

Tomando:

- `precio_neto_uf = propiedad.precio_neto_uf`
- `b_desc = bono_descuento_pct`
- `b_max = bono_max_pct`
- `adicionales_uf = estacionamiento_uf + bodega_uf`

Se calcula:

1. **Tasación depto (`valor_tasacion_uf`)** — fórmula única:  
   `valor_tasacion_uf = precio_neto_uf × (1 - b_max) / (1 - b_desc)`  
   - Solo **Descuento por Bonificación** (`b_max`, con `b_desc = 0`): **multiplica** el neto: `× (1 - b_max)` (no dividir).  
   - Solo beneficio inmobiliario (`b_max = 0`): **divide** el neto: `÷ (1 - b_desc)`.  
   - Si `(1 - b_desc) ≤ 0`, fallback `precio_neto_uf`.

2. **Adicionales en escritura (UF)** — por ítem, luego suma:  
   - Si `bono_aplica_adicionales = false`: `estacionamiento_uf + bodega_uf`.  
   - Si `bono_aplica_adicionales = true` y `(1 - b_desc) > 0`:  
     `estacionamiento_uf / (1 - b_desc) + bodega_uf / (1 - b_desc)`  
     (repercusión del beneficio inmobiliario sobre cada adicional).  
   - Si divisor ≤ 0: usar suma bruta `estacionamiento_uf + bodega_uf`.

3. `valor_escritura_uf = valor_tasacion_uf + adicionales_en_escritura_uf`.

4. `valor_escritura_uf` — único campo de escrituración en resultados (se eliminó el alias duplicado `escrituracion_uf` del código).

5. `beneficio_inmobiliario_uf = valor_tasacion_uf * b_desc`.

## 3.2 Pie

1. `pie_total_uf = valor_escritura_uf * pie_pct`
2. `pie_total_clp = pie_total_uf * uf_valor_clp`

Desglose en pesos (upfront, cuotas antes/después, cuotón): `calcularMontosDesglosePieClp` en `calculosPie.ts` aplica cada `*_pct` sobre **`valor_escritura_uf`** (equivalente a base CLP = valor escrituración × UF), y los tramos en cuotas dividen por `max(N, 1)`.

## 3.3 Hipotecario (sistema frances)

Base:

1. `monto_credito_uf = valor_escritura_uf * hipotecario_aprobacion_pct`
2. `monto_credito_clp = monto_credito_uf * uf_valor_clp`
3. `n_meses = hipotecario_plazo_anos * 12`
4. `tasa_mensual = hipotecario_tasa_anual / 12`
5. `cuota_capital_uf`: si `tasa_mensual > 0`, PMT francés `monto * (r / (1 - (1+r)^-n))`; si `tasa_mensual = 0`, `monto / n_meses`. Si `n_meses <= 0` o `monto_credito_uf <= 0`, tabla vacía y solo seguros mínimos.

Iteracion mensual (`mes = 1..n_meses`):

- `interes_uf = round2(saldo * tasa_mensual)`
- `capital_uf = ultimo_mes ? saldo : round2(cuota_capital_uf - interes_uf)`
- `seg_vida_uf = max(round2(saldo * tasa_seg_vida * UF), 0.01 * UF) / UF`
- `cuota_total_uf = capital_uf + interes_uf + seg_desgravamen_uf + seg_vida_uf + seg_sismos_uf`
- `saldo = round2(saldo - capital_uf)`
- `cuota_total_clp = round0(cuota_total_uf * UF)`

Salida principal:

- `dividendo_total_uf = cuota_total_uf` del mes 1
- `dividendo_total_clp = round0(dividendo_total_uf * UF)`

## 3.4 Plusvalia

Se usa `valor_escritura_uf` como base:

1. `precio_venta_5anos_uf = valor_escritura_uf * (1 + plusvalia_anual_pct)^(plusvalia_anos)`
2. `ganancia_venta_uf = precio_venta_5anos_uf - valor_escritura_uf + pie_total_uf`
3. `ganancia_venta_clp = ganancia_venta_uf * uf_valor_clp`
4. `utilidad_pct = (ganancia_venta_uf - pie_total_uf) / pie_total_uf` (si `pie_total_uf > 0`) — en código, `ganancia_venta_uf` aquí es el valor **antes** de `round2` en el objeto retornado; el campo `ganancia_venta_uf` expuesto sí va redondeado.


## 3.5 Arriendo

Constante: `DIAS_MES_RENTA_CORTA = 30` (mes estándar para renta corta).

1. `dividendo_clp = round0(dividendo_total_uf * uf_valor_clp)`
2. **Renta larga:** `ingreso_neto_clp = arriendo_mensual_clp` (neto ya acordado).
3. **Renta corta:** no hay ingreso bruto manual en entrada.  
   - `bruto_mensual_corta = round0(airbnb_valor_dia_clp * DIAS_MES_RENTA_CORTA * airbnb_ocupacion_pct)` (ocupación 0–1).  
   - `admin_clp = round0(bruto_mensual_corta * airbnb_admin_pct)`  
   - `ingreso_neto_clp = bruto_mensual_corta - admin_clp - gastos_comunes_clp`
4. `resultado_mensual_clp = ingreso_neto_clp - dividendo_clp`
5. `ingreso_uf = ingreso_neto_clp / uf_valor_clp`
6. `cap_rate_anual_pct = (ingreso_uf * 12) / valor_escritura_uf` (perfil activo según `tipo_renta`)
7. `ingreso_neto_flujo_clp = ingreso_neto_clp` (va a diversificación cuando aplica)
8. En **resultados** (`ResultadosArriendo`), `airbnb_ingreso_bruto_clp` es el **bruto mensual calculado** en renta corta (0 en larga); sirve para desglose en UI/PDF, no es campo de entrada.

## 3.6 Resumen de inversión (gráficos auxiliares)

Implementación: `src/lib/engines/resumenGraficos.ts` (no altera el motor unitario; agrega series para comparativa).

- **`seriePatrimonioUf` / `seriePatrimonioTotalUf`:** patrimonio en UF por semestre (0–10 = 5 años). Semestre 0 = `precio_compra_total_uf`; semestres pares &gt; 0 ≈ `valor_escritura_uf × (1 + plusvalía)^año`; impares interpolan. La plusvalía anual viene de `rentabilidad.plusvalia_anual_pct` por unidad.
- **Liquidez / venta mes 60:** precio proyectado a 5 años sobre `valor_escritura_uf` menos saldo insoluto al mes 60 y menos adelanto IVA (15 % × **precio de compra solo depto**, coherente con `devolucionIvaPrecioDeptoClp` en `precioCompra.ts`).

---

## 4) IVA y flujo 60 meses

Pestaña **Flujo**; consolida cotizaciones `activa`. Entradas extra por unidad: `califica_iva`, `mes_entrega_flujo` (1–60 o `null` si no aplica). Globales: `DatosDiversificacion` (capital inicial, ahorro, tasa, override IVA, gastos de escritura/amoblado).

## 4.1 IVA (devolución)

- **Base por unidad:** `15 % × precio_compra_depto_clp` — solo departamento (`precioCompraDeptoUf` × UF), **sin** estacionamiento, bodega ni valor de escrituración completo. Implementación: `devolucionIvaPrecioDeptoClp` en `precioCompra.ts`.
- `calcularIvaTotal` suma esa base solo para `activa && califica_iva` (útil como total de referencia).
- **Inyección en el flujo:** por cada unidad que califica y tiene `mes_entrega_flujo` definido, el monto de esa unidad entra en el mes **`mes_entrega_flujo + 5`** (si ≤ 60). Con **override manual** del IVA total: reparto proporcional por `iva_unidad` entre unidades que califican, o —si no hay base— todo el monto manual en el **primer** mes de IVA calculado entre calificantes.

## 4.2 Diversificación (`calcularDiversificacion`)

**Capital inicial efectivo (mes 1):** `diversif_capital_inicial_clp - (diversif_gastos_operacionales_clp + diversif_amoblado_otros_clp)`.

Para cada `mes = 1..60`:

1. **Egreso pie (`egreso_pie_clp`):** suma por unidad activa de upfront (mes 1), cuotas antes en meses 1…nAntes, cuotas después en los meses siguientes según N, cuotón en 1…nCuotón — usando `calcularMontosDesglosePieClp(valor_escritura_uf, pie, UF)` y la misma geometría que el formulario.
2. **Dividendo − arriendo (`dividendo_menos_arriendo_clp`) — con signo, sin clamp:** para cada unidad con `mes_entrega_flujo` definido y `mes > mes_entrega_flujo` (post-entrega), `dividendo_total_clp − ingreso_neto_flujo_clp`; se suma entre activas. Valor positivo = egreso neto (dividendo > arriendo); valor negativo = ingreso a caja (el excedente de arriendo cubre el dividendo y sobra). Se reporta en **columna propia** en la tabla 60m y resumen anual, separada de `egreso_pie_clp` (`sumaDividendoMenosArriendoPostEntrega` en `calculosDiversificacion.ts`).
3. **`iva_este_mes`:** según §4.1 (automático o manual).
4. **Rentabilización — modelo B (sobre saldo previo):** la base es el capital con el que arrancó el mes, **sin** incluir los movimientos del propio mes:
   - `capital_inicio = capital_anterior` (= `capital_fin` del mes anterior; en el mes 1, el capital inicial efectivo definido arriba).
   - `rentabilizacion = round0(capital_inicio × diversif_tasa_mensual)`.
   
   Implicación: ahorro, egreso pie, Div−Arr e IVA del mes `m` rentabilizan recién desde el mes `m+1`. Contrasta con el modelo A previo (rentabilidad sobre `capital_anterior + ahorro − egreso + iva`), ya retirado.
5. **Cierre del mes:**
   `capital_fin = capital_inicio + diversif_ahorro_mensual_clp − egreso_pie_clp − dividendo_menos_arriendo_clp + iva_este_mes + rentabilizacion`
6. `ganancia_acumulada = round0(capital_fin − diversif_capital_inicial_clp)` (capital inicial **nominal** del formulario, sin restar gastos en el acumulado; los gastos ya reducen el punto de partida del loop).

---

## 5) Mapa de funciones (libreria actual)

- `calcularResultadosCotizacion(cot, uf_valor_clp)`
- `calcularMontosDesglosePieClp(valor_escritura_uf, pie, uf_valor_clp)`
- `validarResultadosCotizacion(cot, res)` — validación cruzada motor vs fórmulas
- `calcularHipotecario` / `calcularPlusvalia` / `calcularArriendo` — internos o exportados desde `calculosCotizacion.ts`
- `devolucionIvaPrecioDeptoClp` — `precioCompra.ts`
- `calcularIvaTotal(cotizaciones, uf_valor_clp)` — suma referencia IVA
- `calcularDiversificacion(datos, cotizaciones, uf_valor_clp)` — tabla 60 meses
- `seriePatrimonioTotalUf`, `liquidezVentaUnidadClp` (y auxiliares como `saldoCreditoAlMesUF`) — `resumenGraficos.ts`

---

## 6) Evolución (librería / API v2)

- Exponer **una función pura** `calcularResultadosCotizacion` con entrada/salida JSON estable (mismos nombres que este documento).
- La **web** compone `Cotizacion`: GET unidad + defaults + overrides del formulario.
- Mantener **un solo mapeo** BD definitiva → `DatosPropiedad` en una capa dedicada (reemplazar por completo el ejemplo `Stock_Imagina_Prueba` / `useSupabase.ts` cuando el modelo multi-inmobiliaria y multi-proyecto esté cerrado).

## 7) Pendientes / decisiones

- Confirmar con negocio si la regla **IVA en mes `mes_entrega_flujo + 5`** por unidad (§4.1) es definitiva.
- Validar en API que columnas `%` (p. ej. `dcto`) vengan en el mismo rango que espera `bono_descuento_pct` (0–1 decimal).
- Ajustar tolerancias del depurador si Excel redondea distinto.

---

## 8) Coherencia “100% valor propiedad” (validación)

Implementación: `validarResultadosCotizacion(cot, res)` en `validarCalculosCotizacion.ts` (también cubierto por tests).

Comprueba (tolerancia ~0,02 UF y ~0,05 pt en porcentajes):

1. **Lista − Descuento = Precio neto**  
   `precio_lista_uf - descuento_uf` debe coincidir con `precio_neto_uf` cargado.

2. **Precio neto coherente con tasacion (bono descuento %)**  
   Identidad inversa de `valor_tasacion_uf = precio_neto_uf / (1 - bono_descuento_pct)`:  
   `precio_neto_uf ≈ valor_tasacion_uf * (1 - bono_descuento_pct)`.

3. **PIE a documentar + credito = 100%**  
   `pie_pct + hipotecario_aprobacion_pct = 1`.

4. **Pie UF + Credito UF = Valor escrituracion UF**  
   Consecuencia del punto 3 sobre la misma base:  
   `pie_total_uf + monto_credito_uf ≈ valor_escritura_uf`.

Cuando subas el pantallazo de la planilla, se puede afinar textos o agregar una quinta fila si Excel usa otra celda como "100% valor propiedad".

---

## 9) Revisión vs planilla «SIMULACIÓN FINANCIERA» (Excel)

Referencia: captura abril 2026 (UF = 39.841,72). Fila de ejemplo sin estacionamiento ni bodega.

### Definiciones acordadas (negocio / planilla)

| Concepto | Significado |
|----------|-------------|
| **Valor tasación** | Valor del departamento **con** beneficio inmobiliario (en Excel: «Precio con Bono Pie» / base tasación del depto). En código: `valor_tasacion_uf` cuando solo hay depto; refleja §3.1 (`bono_descuento_pct`, `bono_max_pct` / Descuento por Bonificación). |
| **Valor escrituración** | Tasación del depto tras reglas de escritura (`bono_max`, etc.) **más adicionales** (con o sin el mismo factor según `bono_aplica_adicionales`). En código: `valor_escritura_uf`. **Si no hay adicionales, escrituración = tasación** (en el ejemplo del cuadro son iguales: 3.389,80 UF). |
| **Pie a documentar** | Porcentaje sobre **valor escrituración** → `pie_total_uf = valor_escritura_uf * pie_pct`. |

### Estado del motor frente a la planilla

- `valor_tasacion_uf = precio_neto / (1 - bono_descuento_pct)` alinea con «Precio con Bono» del depto en el ejemplo (~3.389,80 UF a partir de neto 2.881,33 y 15 %).
- `valor_escritura_uf`, `pie_total_uf`, `monto_credito_uf`, pie % + LTV = 100 % sobre la misma base de escrituración.
- Coherencia **Pie UF + Crédito UF = Valor escrituración** cuando los % suman 100 %.
- **Desglose de pie en CLP:** `calcularMontosDesglosePieClp` aplica cada `*_pct` sobre `valor_escritura_uf × uf_valor_clp`, coincidente con la planilla (ver §3.2 y verificación numérica abajo).

### Regla vigente del cuadro de pago pie

Los porcentajes de **Upfront**, **Cuotón**, **% antes/después de entrega** (y el tramo asociado a «% pie cuotas») se calculan sobre el **valor de escrituración en pesos** (`valor_escritura_uf × UF`), **no** sobre el monto del pie documentado (`pie_total_uf × UF`). Esto es lo que hoy implementa [`calculosPie.ts`](src/lib/engines/calculosPie.ts) y lo que asumen [`CotizacionForm.tsx`](src/components/cotizacion/CotizacionForm.tsx) y [`calculosDiversificacion.ts`](src/lib/engines/calculosDiversificacion.ts) al llamarla con `valor_escritura_uf`.

Verificación numérica (ejemplo Excel, sin adicionales → escrituración = 3.389,80 UF; UF = 39.841,72):

| Concepto | Fórmula (implementada) | Resultado ~ | Excel |
|----------|------------------------|-------------|-------|
| Base CLP escrituración | 3.389,80 × 39.841,72 | ~135.055.461 CLP | — |
| Upfront 2 % | 2 % × base escrituración CLP | ~2.701.109 | ✓ |
| Cuotón 1 % | 1 % × base escrituración CLP | ~1.350.555 | ✓ |
| Cuota después 2 % / 48 | (2 % × base escrituración CLP) / 48 | ~56.273 / mes | ✓ |

Los tests en [`calculosPie.test.ts`](src/lib/engines/calculosPie.test.ts) fijan este comportamiento (`monto_upfront_clp = valor_escritura_uf × upfront_pct × UF`, etc.).

### Pendientes menores (paridad funcional, no bugs de cálculo)

1. **«PIE A PAGAR» explícito**  
   En la captura Excel, 5 % sobre la base de escrituración CLP coincide con ~6.752.773 (componente de caja vs pie documentado 20 %). El cotizador aún **no expone** esa línea como resultado dedicado; la derivación (`pie_a_pagar_uf = pie_total_uf − bono_pie_uf`) está documentada en §1.0.1 pero no hay campo persistido ni celda en pantalla. Añadirla si negocio requiere mostrarla junto a «Pie a documentar».

2. **Auditoría del desglose pie en CLP**  
   [`validarResultadosCotizacion`](src/lib/engines/validarCalculosCotizacion.ts) valida tasación / escritura / pie-crédito (§8) pero no recomputa los montos CLP del desglose. Agregar una comprobación `calcularMontosDesglosePieClp(res.valor_escritura_uf, cot.pie, UF)` vs resultado motor daría un seguro extra frente a regresiones.

### Qué no se ha re-auditado en esta revisión

- Redondeos peso a peso del **dividendo** (~502.803) frente a `calcularHipotecario` (seguros, vida mínima, etc.).
- Orden exacto de columnas «Precio Lista» vs «Precio con Bono» en todas las filas del Excel (la numeración del ejemplo se tomó de la captura y del coherente 2.881,33 → 3.389,80 con 15 % beneficio).
