import type {
  DatosDiversificacion,
  Cotizacion,
  FilaDiversificacion,
} from '@/types'
import { calcularResultadosCotizacion } from './calculosCotizacion'

// ─────────────────────────────────────────────────────────────────
// CALCULO DE IVA AUTOMÁTICO
// 15% del IVA sobre el precio de compra (en CLP) de las unidades elegibles
// El IVA se devuelve aproximadamente 1 mes después de la escrituración
// ─────────────────────────────────────────────────────────────────
export function calcularIvaTotal(
  cotizaciones: Cotizacion[],
  uf_valor_clp: number
): number {
  return cotizaciones
    .filter((c) => c.activa && c.califica_iva)
    .reduce((sum, c) => {
      // IVA = 15% del IVA del precio de compra (el inmueble pagó IVA al constructor)
      return sum + c.propiedad.precio_compra_uf * 0.15 * uf_valor_clp
    }, 0)
}

// ─────────────────────────────────────────────────────────────────
// MOTOR DE DIVERSIFICACIÓN DE AHORROS — 60 meses
//
// Lógica del Flujo (hoja Excel):
// - Meses 1 a (mes_entrega_primer_depto - 1):
//     Egreso = cuotón pie de todas las cotizaciones
// - Meses mes_entrega_primer_depto en adelante:
//     Egreso = SUM(Dividendo - Arriendo) de cada cotización entregada
//     (si Dividendo > Arriendo → egreso, si Arriendo > Dividendo → ingreso que reduce egreso)
// - El IVA se inyecta 1 mes después de la escrituración (usamos mes_entrega + 1)
//
// Rentabilidad = Capital_inicio × tasa_mensual
// Capital_fin = Capital_inicio + Ahorro - Egreso + IVA + Rentabilidad
// ─────────────────────────────────────────────────────────────────
export function calcularDiversificacion(
  datos: DatosDiversificacion,
  cotizaciones: Cotizacion[],
  uf_valor_clp: number
): FilaDiversificacion[] {
  const {
    diversif_tasa_mensual,
    diversif_capital_inicial_clp,
    diversif_ahorro_mensual_clp,
    diversif_iva_total_clp,
    diversif_iva_manual_override,
    mes_entrega_primer_depto,
    diversif_gasto_escrituracion_clp,
  } = datos

  const cotizacionesActivas = cotizaciones.filter((c) => c.activa)

  // IVA: manual override o automático
  const iva_total = diversif_iva_manual_override
    ? diversif_iva_total_clp
    : calcularIvaTotal(cotizaciones, uf_valor_clp)

  // Mes de inyección IVA = mes_entrega + 1 (llega el mes siguiente a la escrituración)
  const mes_iva = mes_entrega_primer_depto + 1

  // Cuota pie mensual de todas las cotizaciones activas (promedio del período pre-entrega)
  const cuota_pie_total = cotizacionesActivas.reduce((sum, c) => {
    const n_cuotas = c.pie.pie_n_cuotas_total || 60
    const r = calcularResultadosCotizacion(c, uf_valor_clp)
    return sum + (r.pie_total_clp / n_cuotas)
  }, 0)

  // Diferencia dividendo - arriendo por cotización (post-entrega)
  const diferencia_dividendo_arriendo = cotizacionesActivas.reduce((sum, c) => {
    const r = calcularResultadosCotizacion(c, uf_valor_clp)
    const dividendo_clp = r.hipotecario.dividendo_total_clp
    const arriendo_clp = c.rentabilidad.arriendo_mensual_clp
    // Si dividendo > arriendo → es un egreso (negativo para el flujo)
    return sum + (dividendo_clp - arriendo_clp)
  }, 0)

  const tabla: FilaDiversificacion[] = []

  // Capital inicial neto (descontando gasto de escrituración)
  let capital_anterior = diversif_capital_inicial_clp - diversif_gasto_escrituracion_clp

  for (let mes = 1; mes <= 60; mes++) {
    const es_pre_entrega = mes < mes_entrega_primer_depto
    const egreso = es_pre_entrega
      ? cuota_pie_total                    // antes de entrega: pago cuota pie
      : Math.max(diferencia_dividendo_arriendo, 0) // post entrega: diferencia dividendo-arriendo

    const iva_este_mes = mes === mes_iva ? iva_total : 0
    const ahorro = diversif_ahorro_mensual_clp

    // Capital inicio = anterior + ahorro - egreso + IVA (si aplica)
    const capital_inicio = capital_anterior + ahorro - egreso + iva_este_mes

    // Rentabilización = interés compuesto del mes
    const rentabilizacion = Math.round(capital_inicio * diversif_tasa_mensual)

    const capital_fin = capital_inicio + rentabilizacion

    tabla.push({
      mes,
      capital_inicio: Math.round(capital_inicio),
      ahorro_mensual: ahorro,
      rentabilizacion,
      egreso_cuotas: Math.round(egreso),
      iva_inyeccion: Math.round(iva_este_mes),
      capital_fin: Math.round(capital_fin),
      ganancia_acumulada: Math.round(capital_fin - diversif_capital_inicial_clp),
    })

    capital_anterior = capital_fin
  }

  return tabla
}

// ─────────────────────────────────────────────────────────────────
// PROYECCIÓN DE VALORIZACIÓN PATRIMONIAL — para Gráfico 1
// FV() anual sobre precio de compra
// ─────────────────────────────────────────────────────────────────
export function calcularProyeccionPatrimonio(
  cotizaciones: Cotizacion[],
  anos: number = 5
): { ano: number; [key: string]: number }[] {
  const activas = cotizaciones.filter((c) => c.activa)
  return Array.from({ length: anos + 1 }, (_, i) => {
    const punto: { ano: number; [key: string]: number } = { ano: i }
    activas.forEach((c) => {
      const nombre = `${c.propiedad.proyecto_nombre.split(' ')[0]} U${c.propiedad.unidad_numero}`
      punto[nombre] = Math.round(
        c.propiedad.precio_compra_uf * Math.pow(1 + c.rentabilidad.plusvalia_anual_pct, i) * 100
      ) / 100
    })
    return punto
  })
}
