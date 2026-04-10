import type { UnidadSupabase } from '@/types'
import type { StockValidationResult } from './types'

const EPS = 1e-4

function isFiniteNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0
}

/**
 * Comprueba invariantes mínimas antes de pasar datos al motor (`calcularResultadosCotizacion`).
 * No sustituye `validarResultadosCotizacion`; sirve para detectar filas de stock mal mapeadas.
 */
export function validateUnidadSupabaseForMotor(u: UnidadSupabase): StockValidationResult {
  const issues: StockValidationResult['issues'] = []

  if (!isFiniteNonNegative(u.precio_lista_uf)) {
    issues.push({ code: 'precio_lista', message: 'precio_lista_uf debe ser un número ≥ 0' })
  }
  if (!isFiniteNonNegative(u.precio_neto_uf)) {
    issues.push({ code: 'precio_neto', message: 'precio_neto_uf debe ser un número ≥ 0' })
  }
  if (!isFiniteNonNegative(u.descuento_uf)) {
    issues.push({ code: 'descuento_uf', message: 'descuento_uf debe ser un número ≥ 0' })
  }
  if (u.precio_neto_uf - u.precio_lista_uf > EPS) {
    issues.push({
      code: 'neto_vs_lista',
      message: 'precio_neto_uf no puede ser mayor que precio_lista_uf',
    })
  }
  const esperadoDesc = u.precio_lista_uf - u.precio_neto_uf
  if (Math.abs(u.descuento_uf - esperadoDesc) > 0.02) {
    issues.push({
      code: 'descuento_coherencia',
      message: 'descuento_uf debería coincidir con precio_lista_uf − precio_neto_uf (tolerancia 0,02 UF)',
    })
  }
  if (!Number.isFinite(u.bono_descuento_pct) || u.bono_descuento_pct < 0 || u.bono_descuento_pct > 1) {
    issues.push({
      code: 'bono_descuento_pct',
      message: 'bono_descuento_pct debe estar en [0, 1] (decimal)',
    })
  }
  if (!Number.isFinite(u.bono_max_pct) || u.bono_max_pct < 0 || u.bono_max_pct > 1) {
    issues.push({
      code: 'bono_max_pct',
      message: 'bono_max_pct debe estar en [0, 1] (decimal)',
    })
  }

  return { ok: issues.length === 0, issues }
}
