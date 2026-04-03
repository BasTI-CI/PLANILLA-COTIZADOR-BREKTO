import { describe, expect, it } from 'vitest'
import { DEFAULT_PIE } from '@/types'
import { calcularMontosDesglosePieClp } from './calculosPie'

describe('calcularMontosDesglosePieClp', () => {
  it('replica desglose: upfront, cuotas y cuotón', () => {
    const pie = {
      ...DEFAULT_PIE,
      upfront_pct: 0.02,
      cuotas_antes_entrega_pct: 0.03,
      cuotas_antes_entrega_n: 3,
      cuotas_despues_entrega_pct: 0.04,
      cuotas_despues_entrega_n: 4,
      cuoton_pct: 0.01,
      cuoton_n_cuotas: 1,
    }
    const uf = 40_000
    const valorEscrituraUf = 1_000
    const m = calcularMontosDesglosePieClp(valorEscrituraUf, pie, uf)
    expect(m.monto_upfront_clp).toBe(Math.round(1_000 * 0.02 * uf))
    expect(m.monto_cuota_antes_clp).toBe(Math.round(((1_000 * 0.03) / 3) * uf))
    expect(m.monto_cuota_despues_clp).toBe(Math.round(((1_000 * 0.04) / 4) * uf))
    expect(m.monto_cuoton_clp).toBe(Math.round((1_000 * 0.01) * uf))
  })
})
