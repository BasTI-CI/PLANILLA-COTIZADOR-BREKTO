# Resumen de conversación — Cotizador Brekto

Archivo generado para consultar en otro computador. La fuente normativa de cálculos sigue siendo `**variables_calculo.md**` en esta misma carpeta.

---

## Enfoque de trabajo acordado

- Priorizar **documento a documento** (`variables_calculo.md`) frente a tocar todo el programa, salvo que se pida lo contrario.
- **Etiquetas del frontend** (asesor) ≠ **nombres de variables en código/API**; el contrato es el documento + `src/types/index.ts`.
- Objetivo futuro: **librería pura** + API (v2); web compone `Cotizacion` desde Supabase + campos manuales.

---

## Frontend — etiquetas (no mezclar con nombres de código)


| Pantalla (asesor)                   | Variable en código              |
| ----------------------------------- | ------------------------------- |
| Bono descuento (%)                  | `bono_descuento_pct`            |
| Descuento adicional (%)             | `bono_max_pct`                  |
| Bono adicionales                    | `bono_aplica_adicionales`       |
| Valor tasación (UF)                 | `valor_tasacion_uf` (resultado) |
| Valor escrituración (UF)            | `valor_escritura_uf`            |
| PDF/simulador «Bono descuento (UF)» | `beneficio_inmobiliario_uf`     |


---

## Validación de cálculos

- `**pnpm test`** — pruebas en `src/lib/engines/*.test.ts` (tasación, escritura, hipotecario, pie CLP, IVA/flujo, plusvalía, arriendo).
- `**validarResultadosCotizacion(cot, res)**` — `src/lib/engines/validarCalculosCotizacion.ts`: recomputa §3.1 y cruza pie/crédito/amortización; devuelve `{ ok, fallos[] }`.
- `**recomputarValorTasacionUf` / `recomputarValorEscrituraUf**` — mismas fórmulas que el doc, para auditar vs Excel.

Detalle en `variables_calculo.md` (sección «Validar cálculos» al inicio).

---

## Planilla Excel vs cotizador — **error conocido (§9 del doc)**

**Cuadro de pago pie (montos en $):** en Excel, los % (Upfront, Cuotón, % antes/después de entrega) se aplican sobre `**valor_escrituración × UF` en CLP**, no sobre el pie documentado.

- Hoy `**calculosPie.ts`** usa `**pie_total_uf**` como base → montos del resumen financiero en la web **no coinciden** con la planilla «SIMULACIÓN FINANCIERA».
- **Motor principal** (`calcularResultadosCotizacion`): tasación, escritura, pie total UF, crédito y pie+crédito=escritura están alineados con el ejemplo analizado.
- **Definiciones:** sin adicionales, **tasación = escrituración**; con adicionales, escrituración incluye estac./bodega según reglas del doc.

Listado numerado de errores y números de ejemplo: `**variables_calculo.md` §9**.

**Pendiente de implementación:** cambiar `calcularMontosDesglosePieClp` para recibir `valor_escritura_uf` (y UF), actualizar `CotizacionForm`, tests y §3.2 del doc en una sola versión correcta.

---

## Plusvalía — matiz documentado

`utilidad_pct` en código se calcula con la **ganancia antes** del redondeo a 2 decimales del campo `ganancia_venta_uf` expuesto. Ver nota en `variables_calculo.md` §3.4.

---

## Archivos clave


| Archivo                                        | Rol                                         |
| ---------------------------------------------- | ------------------------------------------- |
| `variables_calculo.md`                         | Fórmulas, variables, mapeo UI, §9 Excel     |
| `src/lib/engines/calculosCotizacion.ts`        | Motor cotización                            |
| `src/lib/engines/calculosPie.ts`               | Desglose pie CLP (**revisar** vs Excel)     |
| `src/lib/engines/validarCalculosCotizacion.ts` | Validación cruzada                          |
| `src/lib/engines/debugValorPropiedad100.ts`    | Depurador UI                                |
| `src/hooks/useSupabase.ts`                     | Mapeo tabla `Stock_Imagina_Prueba` → unidad |


---

## Comandos útiles

```bash
cd "Planilla Cotizador Brekto"
corepack pnpm install
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm dev
```

---

## Nota

Este archivo **no sustituye** el historial literal del chat en Cursor; resume decisiones y dónde está cada cosa en el repo. Para el hilo completo, usa la función de exportar/historial de chat del propio Cursor si la tienes disponible.