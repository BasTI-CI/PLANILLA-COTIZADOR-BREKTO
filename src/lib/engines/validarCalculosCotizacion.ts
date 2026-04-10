import type { Cotizacion, DatosPropiedad, ResultadosCotizacion } from '@/types'
import { valorTasacionDeptoUf } from './calculosCotizacion'
import { precioCompraTotalUf } from './precioCompra'

/** Tolerancia por defecto para comparaciones UF en validación cruzada. */
const EPS_UF_DEFAULT = 0.02
const EPS_PCT_DEFAULT = 0.0005
/** Amortización con redondeos mensuales puede desviar la suma de capital (UF). */
const EPS_UF_SUMA_CAPITAL = 1.5

export interface FalloValidacion {
  id: string
  mensaje: string
}

/**
 * Replica §3.1 de `variables_calculo.md` (misma lógica que `calculosCotizacion`).
 * Sirve para contrastar el resultado del motor sin duplicar el archivo de cálculo.
 */
function adicionalesEscrituraUfRecompute(propiedad: DatosPropiedad): number {
  const est = propiedad.estacionamiento_uf
  const bod = propiedad.bodega_uf
  if (!propiedad.bono_aplica_adicionales) return est + bod
  const d = 1 - propiedad.bono_descuento_pct
  if (d <= 0) return est + bod
  return est / d + bod / d
}

export function recomputarValorEscrituraUf(propiedad: DatosPropiedad): number {
  return recomputarValorTasacionUf(propiedad) + adicionalesEscrituraUfRecompute(propiedad)
}

export function recomputarValorTasacionUf(propiedad: DatosPropiedad): number {
  return valorTasacionDeptoUf(
    propiedad.precio_neto_uf,
    propiedad.bono_descuento_pct,
    propiedad.bono_max_pct
  )
}

/**
 * Comprueba que `res` es coherente con `cot` según fórmulas documentadas.
 * Uso: tests (`pnpm test`), depuración, y en v2 respuesta de API opcional.
 */
export function validarResultadosCotizacion(
  cot: Cotizacion,
  res: ResultadosCotizacion,
  opts?: { epsUf?: number; epsPct?: number; epsSumaCapital?: number }
): { ok: boolean; fallos: FalloValidacion[] } {
  const epsUf = opts?.epsUf ?? EPS_UF_DEFAULT
  const epsPct = opts?.epsPct ?? EPS_PCT_DEFAULT
  const epsSuma = opts?.epsSumaCapital ?? EPS_UF_SUMA_CAPITAL
  const fallos: FalloValidacion[] = []
  const { propiedad, pie, hipotecario } = cot

  const dListaNeto = Math.abs(
    propiedad.precio_lista_uf - propiedad.descuento_uf - propiedad.precio_neto_uf
  )
  if (dListaNeto > epsUf) {
    fallos.push({
      id: 'lista_menos_descuento_neto',
      mensaje: `Lista − descuento ≠ precio neto (Δ ${dListaNeto.toFixed(4)} UF)`,
    })
  }

  const tasEsp = recomputarValorTasacionUf(propiedad)
  if (Math.abs(res.valor_tasacion_uf - tasEsp) > epsUf) {
    fallos.push({
      id: 'valor_tasacion',
      mensaje: `valor_tasacion_uf no coincide con fórmula (Δ ${Math.abs(res.valor_tasacion_uf - tasEsp).toFixed(4)} UF)`,
    })
  }

  const escEsp = recomputarValorEscrituraUf(propiedad)
  if (Math.abs(res.valor_escritura_uf - escEsp) > epsUf) {
    fallos.push({
      id: 'valor_escritura',
      mensaje: `valor_escritura_uf no coincide con recomputo §3.1 (Δ ${Math.abs(res.valor_escritura_uf - escEsp).toFixed(4)} UF)`,
    })
  }

  const compraEsp = precioCompraTotalUf(propiedad)
  if (Math.abs(res.precio_compra_total_uf - compraEsp) > epsUf) {
    fallos.push({
      id: 'precio_compra_total',
      mensaje: `precio_compra_total_uf ≠ neto depto + est + bod (Δ ${Math.abs(res.precio_compra_total_uf - compraEsp).toFixed(4)} UF)`,
    })
  }

  const benEsp = res.valor_tasacion_uf * propiedad.bono_descuento_pct
  if (Math.abs(res.beneficio_inmobiliario_uf - benEsp) > epsUf) {
    fallos.push({
      id: 'beneficio_inmobiliario',
      mensaje: 'beneficio_inmobiliario_uf ≠ valor_tasacion_uf × bono_descuento_pct',
    })
  }

  const pieEsp = res.valor_escritura_uf * pie.pie_pct
  if (Math.abs(res.pie_total_uf - pieEsp) > epsUf) {
    fallos.push({
      id: 'pie_total',
      mensaje: `pie_total_uf ≠ valor_escritura × pie_pct (Δ ${Math.abs(res.pie_total_uf - pieEsp).toFixed(4)} UF)`,
    })
  }

  const sumaPct = pie.pie_pct + hipotecario.hipotecario_aprobacion_pct
  if (Math.abs(sumaPct - 1) > epsPct) {
    fallos.push({
      id: 'pie_mas_ltv',
      mensaje: `pie_pct + hipotecario_aprobacion_pct = ${(sumaPct * 100).toFixed(3)}% (se espera 100%)`,
    })
  }

  const credEsp = res.valor_escritura_uf * hipotecario.hipotecario_aprobacion_pct
  if (Math.abs(res.hipotecario.monto_credito_uf - credEsp) > epsUf) {
    fallos.push({
      id: 'monto_credito',
      mensaje: 'monto_credito_uf ≠ valor_escritura × LTV',
    })
  }

  const sumaPieCred = res.pie_total_uf + res.hipotecario.monto_credito_uf
  if (Math.abs(sumaPieCred - res.valor_escritura_uf) > epsUf) {
    fallos.push({
      id: 'pie_mas_credito_escritura',
      mensaje: `pie + crédito ≠ escritura (Δ ${Math.abs(sumaPieCred - res.valor_escritura_uf).toFixed(4)} UF)`,
    })
  }

  const tabla = res.hipotecario.tabla_amortizacion
  if (tabla.length > 0 && res.hipotecario.monto_credito_uf > 0) {
    const sumaCapital = tabla.reduce((s, f) => s + f.capital_uf, 0)
    if (Math.abs(sumaCapital - res.hipotecario.monto_credito_uf) > epsSuma) {
      fallos.push({
        id: 'amortizacion_suma_capital',
        mensaje: `Suma capital amortización (${sumaCapital.toFixed(2)}) ≠ monto crédito (${res.hipotecario.monto_credito_uf.toFixed(2)} UF)`,
      })
    }
    const ultimo = tabla[tabla.length - 1]
    if (ultimo && Math.abs(ultimo.saldo_uf) > epsUf) {
      fallos.push({
        id: 'amortizacion_saldo_final',
        mensaje: `Saldo final amortización ${ultimo.saldo_uf} UF (se espera ~0)`,
      })
    }
  }

  return { ok: fallos.length === 0, fallos }
}
