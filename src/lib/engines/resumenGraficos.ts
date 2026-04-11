import type { Cotizacion, ResultadosCotizacion, FilaAmortizacion } from '@/types'
import { devolucionIvaPrecioDeptoClp } from './precioCompra'

/** Saldo insoluto del crédito al cierre del mes indicado (1-based). */
export function saldoCreditoAlMesUF(
  tabla: FilaAmortizacion[],
  mes: number
): number {
  if (tabla.length === 0) return 0
  const row = tabla.find((t) => t.mes === mes)
  if (row) return row.saldo_uf
  const last = tabla[tabla.length - 1]
  if (mes > last.mes) return last.saldo_uf
  return tabla[0]?.saldo_uf ?? 0
}

/**
 * Patrimonio en UF por semestre (0–10 = 5 años).
 * Semestre 0 = precio de compra (inversión patrimonial real).
 * Semestres pares >0: valor escrituración × (1+g)^(año), captando tasación/escritura + plusvalía anual.
 * Semestres impares: interpolación entre puntos (pendiente más suave entre años).
 */
export function seriePatrimonioUf(
  precioCompraUf: number,
  valorEscrituraUf: number,
  plusvaliaAnual: number,
  semestresMax: number = 10
): { semestre: number; patrimonioUf: number }[] {
  const g = plusvaliaAnual
  const out: { semestre: number; patrimonioUf: number }[] = []
  for (let s = 0; s <= semestresMax; s++) {
    let pat: number
    if (s === 0) {
      pat = precioCompraUf
    } else if (s % 2 === 0) {
      const y = s / 2
      pat = valorEscrituraUf * Math.pow(1 + g, y)
    } else {
      const y1 = (s + 1) / 2
      const p1 = valorEscrituraUf * Math.pow(1 + g, y1)
      const p0 =
        s === 1
          ? precioCompraUf
          : valorEscrituraUf * Math.pow(1 + g, (s - 1) / 2)
      pat = (p0 + p1) / 2
    }
    out.push({ semestre: s, patrimonioUf: Math.round(pat * 100) / 100 })
  }
  return out
}

/** Suma patrimonio UF de todas las cotizaciones activas por semestre. */
export function seriePatrimonioTotalUf(
  activas: Cotizacion[],
  resultados: ResultadosCotizacion[]
): { semestre: number; patrimonioUf: number }[] {
  if (activas.length === 0) return []
  const series = activas.map((c, i) =>
    seriePatrimonioUf(
      resultados[i].precio_compra_total_uf,
      resultados[i].valor_escritura_uf,
      c.rentabilidad.plusvalia_anual_pct,
      10
    )
  )
  return series[0].map((_, idx) => ({
    semestre: idx,
    patrimonioUf: Math.round(
      series.reduce((sum, s) => sum + s[idx].patrimonioUf, 0) * 100
    ) / 100,
  }))
}

const MESES_CICLO_INVERSION = 60
const AÑOS_CICLO_INVERSION = 5

/**
 * Liquidez neta por venta al mes 60: precio escritura × (1+g)^5 − saldo insoluto (mes 60) − adelanto devolución IVA.
 * El adelanto IVA descontado es 15% × **precio de compra del solo departamento** (no adicionales ni base escrituración).
 */
export function liquidezVentaUnidadClp(
  c: Cotizacion,
  r: ResultadosCotizacion,
  ufVal: number
): number {
  const ve = r.valor_escritura_uf
  const g = c.rentabilidad.plusvalia_anual_pct
  const precioVentaUf =
    ve * Math.pow(1 + g, AÑOS_CICLO_INVERSION)
  const saldoUf = saldoCreditoAlMesUF(
    r.hipotecario.tabla_amortizacion,
    MESES_CICLO_INVERSION
  )
  const brutoUf = precioVentaUf - saldoUf
  const brutoClp = brutoUf * ufVal
  const ivaAdelantoClp = c.califica_iva
    ? devolucionIvaPrecioDeptoClp(c.propiedad, ufVal)
    : 0
  return Math.round(brutoClp - ivaAdelantoClp)
}
