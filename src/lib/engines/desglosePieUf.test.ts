import { describe, it, expect } from 'vitest'
import { DEFAULT_PIE } from '@/types'
import { bonoPieUf, pieAPagarUf } from './desglosePieUf'

describe('desglosePieUf', () => {
  it('bono pie = escritura × resto %; pie a pagar = pie total − bono', () => {
    const pie = {
      ...DEFAULT_PIE,
      pie_pct: 0.2,
      upfront_pct: 0.02,
      cuoton_pct: 0.01,
      cuotas_antes_entrega_pct: 0.05,
      cuotas_despues_entrega_pct: 0.05,
    }
    const ve = 1000
    const pieTotal = ve * 0.2
    const resto = 0.2 - 0.02 - 0.01 - 0.05 - 0.05 // 0.07
    expect(bonoPieUf(ve, pie)).toBeCloseTo(ve * resto, 6)
    expect(pieAPagarUf(pieTotal, ve, pie)).toBeCloseTo(pieTotal - ve * resto, 6)
  })
})
