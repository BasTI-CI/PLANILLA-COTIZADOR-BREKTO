# Variables y cálculos — Cotizador Brekto

Referencia para **auditoría y futura librería** (p. ej. API en v2). El código debe seguir este documento; la UI solo muestra etiquetas para el asesor.

**Alcance de esta revisión:** pestaña **Cotización** (una unidad = `Cotizacion`). Módulos **Flujo / IVA / diversificación** se resumen en §4; no forman parte del detalle de cotización unitaria.

**Motor principal:** `calcularResultadosCotizacion(cot, uf_valor_clp)` → `ResultadosCotizacion`.

Archivos de implementación:

| Archivo | Rol |
|---------|-----|
| `src/lib/engines/calculosCotizacion.ts` | Tasación, escritura, pie total, hipotecario, plusvalía, arriendo |
| `src/lib/engines/calculosPie.ts` | Desglose del pie en CLP (upfront, cuotas, cuotón) |
| `src/lib/engines/debugValorPropiedad100.ts` | Comprobaciones de coherencia (§8) |
| `src/types/index.ts` | Contrato TypeScript `Cotizacion` / `ResultadosCotizacion` |

**Validar cálculos**

1. `pnpm test` — cubre fórmulas §3.1–3.5, hipotecario, pie CLP, IVA/flujo básico, y casos de error (pie+LTV ≠ 100%, lista≠neto).
2. `validarResultadosCotizacion(cot, res)` en `src/lib/engines/validarCalculosCotizacion.ts` — recomputa §3.1 y cruza pie/crédito/amortización; devuelve `{ ok, fallos[] }` para tests o API futura.
3. `recomputarValorEscrituraUf` / `recomputarValorTasacionUf` — mismas fórmulas que el motor, para auditoría manual o hoja Excel.

---

## Cotización — origen de datos

Objetivo v2: la **librería** recibe un JSON alineado con `Cotizacion`; la web rellena ese objeto desde API + formulario.

### Desde API (Supabase u otro backend)

Hoy el ejemplo vive en `useSupabase.ts` → tabla `Stock_Imagina_Prueba` → `UnidadSupabase`. Al cargar una unidad en la app se mapea a `DatosPropiedad` (y defaults).

| Columna / origen actual (ejemplo) | Campo en `DatosPropiedad` | Notas |
|-----------------------------------|---------------------------|--------|
| `precio` | `precio_lista_uf` | |
| `precio_dcto` | `precio_neto_uf` | |
| derivado | `descuento_uf` | `precio_lista_uf - precio_neto_uf` |
| `dcto` | `bono_descuento_pct` | **Contrato lógico:** decimal (ej. `0.15`); validar que la BD use el mismo criterio |
| `bono10` | `bono_max_pct` | Descuento adicional (%): en escritura solo afecta estac.+bodega si `bono_aplica_adicionales` (ver §3.1) |
| (fijo hoy) | `bono_aplica_adicionales` | Cuando la API lo tenga, mapear aquí |
| superficies, modelo, etc. | campos `unidad_*` | |
| (no en fila actual) | `estacionamiento_uf`, `bodega_uf` | Rellenar desde API cuando existan |

Metadatos de proyecto (`proyecto_nombre`, comuna, barrio, dirección) vienen del recurso **proyecto** asociado a la unidad.

**Pendiente cuando generes la API definitiva:** fijar nombres de columnas y tipos (decimal vs entero para %) y documentar el mapeo en una sola tabla (reemplazar la de arriba).

### Rellenados en sesión (manual en formulario)

No dependen de la fila de stock (o se sobreescriben):

- **`DatosDesglosePie`** — toda la sección pie: `pie_pct`, `upfront_pct`, cuotas antes/después, cuotón, `pie_n_cuotas_total`, etc.
- **`DatosHipotecario`** — tasa, plazo, % aprobación, seguros, etc.
- **`DatosRentabilidad`** — plusvalía, arriendo / AirBnB (la misma pestaña Cotización los expone; alimentan resultados pero no el “detalle precio” desde BD).
- **`uf_valor_clp`** en `DatosGlobales` — puede venir de API UF del día o ingreso manual.
- **`reserva_clp`** — hoy en `DatosPropiedad`; puede quedar como dato de operación comercial.

---

## 1) Variables de entrada (`Cotizacion`)

Los **identificadores** son el contrato código/API. Las **etiquetas** en pantalla pueden diferir (tabla siguiente).

### Etiquetas UI ↔ variable (pestaña Cotización)

| Etiqueta (asesor) | Variable |
|-------------------|----------|
| Bono descuento (%) | `bono_descuento_pct` |
| Descuento adicional (%) | `bono_max_pct` |
| Bono adicionales | `bono_aplica_adicionales` |
| PIE a documentar (%) | `pie.pie_pct` |
| Upfront, % antes/después, cuotón, N° cuotas… | campos en `pie` (ver lista) |
| Tasa, plazo, financiamiento, seguros | campos en `hipotecario` (ver lista) |
| Valor tasación (UF) (solo lectura) | `valor_tasacion_uf` (resultado) |
| Valor escrituración (UF) (solo lectura) | `valor_escritura_uf` (resultado) |
| Resumen «Bono descuento (UF)» en PDF/simulador | `beneficio_inmobiliario_uf` (resultado) |

### `DatosPropiedad` (antecedentes + detalle precio)

- Identificación: `proyecto_*`, `unidad_*` (número, tipología, superficies, orientación, entrega).
- Precio: `precio_lista_uf`, `descuento_uf`, `precio_neto_uf` con invariante `precio_neto_uf = precio_lista_uf - descuento_uf`.
- Tasación / escritura (inputs): `bono_descuento_pct`, `bono_max_pct`, `bono_aplica_adicionales`, `estacionamiento_uf`, `bodega_uf`.
- Operación: `reserva_clp`.

### `DatosDesglosePie`

- `pie_pct` — pie sobre `valor_escritura_uf`.
- `upfront_pct`, `cuotas_antes_entrega_pct`, `cuotas_antes_entrega_n`, `cuotas_despues_entrega_pct`, `cuotas_despues_entrega_n`, `cuoton_pct`, `cuoton_n_cuotas`, `pie_n_cuotas_total`.

**Nota:** los % del desglose son fracciones del **pie total** (`pie_total_uf`), no del valor escrituración. No hay validación automática de que sumen 100 % del pie.

### `DatosHipotecario`

- `hipotecario_tasa_anual`, `hipotecario_plazo_anos`, `hipotecario_aprobacion_pct` (LTV).
- `hipotecario_seg_desgravamen_uf`, `hipotecario_seg_sismos_uf`, `hipotecario_tasa_seg_vida_pct`.
- `hipotecario_abono_voluntario` — **definido en tipos; el motor actual no lo usa** (reservado).

### `DatosRentabilidad`

Usado por el mismo `calcularResultadosCotizacion` para `plusvalia` y `arriendo` (§3.4–3.5). Lista completa en `types/index.ts`.

### Regla pie + crédito

`pie_pct + hipotecario_aprobacion_pct` debe ser `≈ 1`. Si no, el motor solo emite `console.warn`; conviene validar en API v2.

### Diversificación (fuera del detalle cotización)

Variables globales del módulo 60 meses: `diversif_*`, `mes_entrega_primer_depto`, etc. Ver §4.

---

## 2) Salida del motor (`ResultadosCotizacion`)

Todo sale de `calcularResultadosCotizacion`. Campos raíz:

| Campo | Significado |
|-------|-------------|
| `valor_tasacion_uf` | Depto: precio neto repercutido con `bono_descuento_pct` (§3.1) |
| `valor_escritura_uf` | Base banco: `valor_tasacion_uf` + adicionales (con o sin `×(1−bono_max_pct)` según `bono_aplica_adicionales`); sin adicionales = tasación |
| `escrituracion_uf` | Igual a `valor_escritura_uf` (alias histórico) |
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

1. **Tasación depto (`valor_tasacion_uf`)**  
   - Si `b_max` y `b_desc` son iguales (misma magnitud): `valor_tasacion_uf = precio_neto_uf` (caso carta tasación: beneficio = desc. adicional).  
   - Si no: `valor_tasacion_uf = precio_neto_uf / (1 - b_desc)` si `(1 - b_desc) > 0`, si no fallback `precio_neto_uf`.

2. **Adicionales en escritura (UF)** — por ítem, luego suma:  
   - Si `bono_aplica_adicionales = false`: `estacionamiento_uf + bodega_uf`.  
   - Si `bono_aplica_adicionales = true` y `(1 - b_desc) > 0`:  
     `estacionamiento_uf / (1 - b_desc) + bodega_uf / (1 - b_desc)`  
     (repercusión del beneficio inmobiliario sobre cada adicional).  
   - Si divisor ≤ 0: usar suma bruta `estacionamiento_uf + bodega_uf`.

3. `valor_escritura_uf = valor_tasacion_uf + adicionales_en_escritura_uf`.

4. `escrituracion_uf = valor_escritura_uf`.

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

1. `dividendo_clp = round0(dividendo_total_uf * uf_valor_clp)`
2. `ingreso_neto_clp =`
   - renta corta: `airbnb_bruto - round0(airbnb_bruto * airbnb_admin_pct) - gastos_comunes`
   - renta larga: `arriendo_mensual_clp`
3. `resultado_mensual_clp = ingreso_neto_clp - dividendo_clp`
4. `ingreso_uf = ingreso_neto_clp / uf_valor_clp`
5. `cap_rate_anual_pct = (ingreso_uf * 12) / valor_escritura_uf`
6. `ingreso_neto_flujo_clp = ingreso_neto_clp`

---

## 4) IVA y flujo 60 meses

Pestaña **Flujo** y lógica asociada; consume `ResultadosCotizacion` de cada cotización activa. No amplía las variables de entrada de la cotización unitaria más allá de `califica_iva` en `Cotizacion`.

## 4.1 IVA automatico

En `calcularIvaTotal`:

- se consideran cotizaciones `activa && califica_iva`
- por cada una: `iva_unidad = valor_escritura_uf * 0.15 * uf_valor_clp`
- `iva_total = sum(iva_unidad)`

## 4.2 Diversificacion

Precalculos:

1. `iva_total = diversif_iva_manual_override ? diversif_iva_total_clp : calcularIvaTotal(...)`
2. `mes_iva = mes_entrega_primer_depto + 5`
3. `cuota_pie_total = sum(pie_total_clp / (pie_n_cuotas_total || 60))`
4. `diferencia_dividendo_arriendo = sum(dividendo_total_clp - ingreso_neto_flujo_clp)`

Iteracion (`mes = 1..60`):

- `egreso = mes < mes_entrega ? cuota_pie_total : max(diferencia_dividendo_arriendo, 0)`
- `iva_este_mes = mes === mes_iva ? iva_total : 0`
- `capital_inicio = capital_anterior + ahorro_mensual - egreso + iva_este_mes`
- `rentabilizacion = round0(capital_inicio * diversif_tasa_mensual)`
- `capital_fin = capital_inicio + rentabilizacion`
- `ganancia_acumulada = round0(capital_fin - capital_inicial)`

---

## 5) Mapa de funciones (libreria actual)

- `calcularResultadosCotizacion(cot, uf_valor_clp)`
- `calcularMontosDesglosePieClp(pie_total_uf, pie, uf_valor_clp)`
- `validarResultadosCotizacion(cot, res)` — validación cruzada motor vs fórmulas
- `calcularHipotecario(valor_escritura_uf, hip, uf_valor_clp)`
- `calcularPlusvalia(valor_escritura_uf, pie_total_uf, plusvalia_anual_pct, plusvalia_anos, uf_valor_clp)`
- `calcularArriendo(rent, dividendo_total_uf, valor_escritura_uf, uf_valor_clp)`
- `calcularIvaTotal(cotizaciones, uf_valor_clp)`
- `calcularDiversificacion(datos, cotizaciones, uf_valor_clp)`
- `calcularProyeccionPatrimonio(cotizaciones, anos)`

---

## 6) Evolución (librería / API v2)

- Exponer **una función pura** `calcularResultadosCotizacion` con entrada/salida JSON estable (mismos nombres que este documento).
- La **web** compone `Cotizacion`: GET unidad + defaults + overrides del formulario.
- Mantener **un solo mapeo** BD → `DatosPropiedad` (sustituir el ejemplo `Stock_Imagina_Prueba` cuando la API definitiva exista).

## 7) Pendientes / decisiones

- Confirmar con negocio si `mes_iva = mes_entrega + 5` es definitivo (módulo flujo).
- Implementar o eliminar `hipotecario_abono_voluntario` en el motor.
- Validar en API que columnas `%` (p. ej. `dcto`) vengan en el mismo rango que espera `bono_descuento_pct` (0–1 decimal).
- Ajustar tolerancias del depurador si Excel redondea distinto.

---

## 8) Depurador 100% valor propiedad (UI + codigo)

Implementacion: `src/lib/engines/debugValorPropiedad100.ts` y panel en `CotizacionForm`.

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
| **Valor tasación** | Valor del departamento **con** beneficio inmobiliario (en Excel: «Precio con Bono Pie» / base tasación del depto). En código: `valor_tasacion_uf` cuando solo hay depto; coincide con la base antes de aplicar `bono_max_pct` solo al depto. |
| **Valor escrituración** | Tasación del depto tras reglas de escritura (`bono_max`, etc.) **más adicionales** (con o sin el mismo factor según `bono_aplica_adicionales`). En código: `valor_escritura_uf`. **Si no hay adicionales, escrituración = tasación** (en el ejemplo del cuadro son iguales: 3.389,80 UF). |
| **Pie a documentar** | Porcentaje sobre **valor escrituración** → `pie_total_uf = valor_escritura_uf * pie_pct` (**esto el motor ya lo hace bien**). |

### Qué hace bien el cotizador (motor principal)

- `valor_tasacion_uf = precio_neto / (1 - bono_descuento_pct)` alinea con «Precio con Bono» del depto en el ejemplo (~3.389,80 UF a partir de neto 2.881,33 y 15 %).
- `valor_escritura_uf`, `pie_total_uf`, `monto_credito_uf`, pie % + LTV = 100 % sobre la misma base de escrituración.
- Coherencia **Pie UF + Crédito UF = Valor escrituración** cuando los % suman 100 %.

### Error principal: CUADRO DE PAGO PIE (montos en pesos)

En la planilla, los porcentajes del bloque **Upfront**, **Cuotón**, **% antes/después de entrega** (y el tramo asociado a «% pie cuotas») se calculan sobre el **valor de escrituración en pesos** (`valor_escritura_uf × UF`), **no** sobre el monto del pie documentado (`pie_total_uf × UF`).

Comprobación numérica (ejemplo Excel):

| Concepto | Fórmula planilla | Resultado ~ |
|----------|------------------|---------------|
| Base CLP escrituración | 3.389,80 × 39.841,72 | ~135.055.461 CLP |
| Upfront 2 % | 2 % × base escrituración CLP | **~2.701.109** (coincide con Excel) |
| Cuotón 1 % | 1 % × base escrituración CLP | **~1.350.555** |
| Cuota después 2 % / 48 | (2 % × base escrituración CLP) / 48 | **~56.273** / mes |

**Cálculo actual del cotizador** (`calculosPie.ts`): aplica cada `*_pct` sobre **`pie_total_uf`** (p. ej. 677,96 UF × 2 % × UF ≈ **~540.219 CLP** de upfront), es decir **~5× menor** que el upfront correcto en el ejemplo. Lo mismo afecta cuotón y cuotas antes/después: **todos los montos del resumen financiero de pie en la web quedan mal** salvo que por casualidad `pie_pct` fuera 100 %.

### Listado de errores / desalineaciones (pendiente de corrección en código)

1. **`calculosPie.ts` — base incorrecta**  
   `calcularMontosDesglosePieClp` usa `pie_total_uf` como base de todos los `upfront_pct`, `cuoton_pct`, `cuotas_*_pct`. Debe alinearse con Excel: base = **`valor_escritura_uf * uf_valor_clp`** (o equivalente en UF multiplicando al final). La firma deberá recibir `valor_escritura_uf` (y `uf_valor_clp`), no inferir el desglose solo desde `pie_total_uf`.

2. **`variables_calculo.md` §3.2 (histórico)**  
   Indicaba que el desglose era «cada % del pie total»; eso **reproduce el bug**. La regla correcta es la de esta §9.

3. **`CotizacionForm.tsx`**  
   Los montos mostrados (Monto upfront, cuota antes/después, cuotón en $) provienen de `calcularMontosDesglosePieClp` → **erróneos** frente a la planilla.

4. **`calculosPie.test.ts`**  
   Los tests fijan el comportamiento incorrecto; habrá que reescribirlos con la base escrituración CLP.

5. **`validarResultadosCotizacion`**  
   No audita el desglose pie en CLP; convendrá añadir comprobaciones cuando la fórmula esté corregida.

6. **«PIE A PAGAR» (5 % en el cuadro Excel)**  
   En la captura, 5 % sobre la base de escrituración CLP coincide con ~6.752.773 (componente de caja vs pie documentado 20 %). El cotizador **no modela** aún esa línea explícita; no es el mismo bug que el punto 1, pero falta paridad funcional con el cuadro si se requiere mostrar «PIE A PAGAR» vs «Pie a documentar».

### Qué no se ha re-auditado en esta revisión

- Redondeos peso a peso del **dividendo** (~502.803) frente a `calcularHipotecario` (seguros, vida mínima, etc.).
- Orden exacto de columnas «Precio Lista» vs «Precio con Bono» en todas las filas del Excel (la numeración del ejemplo se tomó de la captura y del coherente 2.881,33 → 3.389,80 con 15 % beneficio).

*Siguiente paso sugerido:* corregir `calculosPie.ts` + llamadas + tests; actualizar §3.2 con la fórmula definitiva en una sola versión (sin duplicar «código actual vs Excel»).
