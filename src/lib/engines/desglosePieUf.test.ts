import { describe, it, expect } from 'vitest'
import { DEFAULT_PIE } from '@/types'
import { bonoPiePct, bonoPieUf, pieAPagarUf, tieneBonoPie } from './desglosePieUf'

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

  it('bonoPiePct expone el resto del caso base (≈ 0,07)', () => {
    const pie = {
      ...DEFAULT_PIE,
      pie_pct: 0.2,
      upfront_pct: 0.02,
      cuoton_pct: 0.01,
      cuotas_antes_entrega_pct: 0.05,
      cuotas_despues_entrega_pct: 0.05,
    }
    expect(bonoPiePct(pie)).toBeCloseTo(0.07, 9)
    expect(tieneBonoPie(pie)).toBe(true)
  })

  it('resto negativo → bono pie 0, nunca negativo', () => {
    const pie = {
      ...DEFAULT_PIE,
      pie_pct: 0.2,
      upfront_pct: 0.25,
      cuoton_pct: 0,
      cuotas_antes_entrega_pct: 0,
      cuotas_despues_entrega_pct: 0,
    }
    expect(bonoPiePct(pie)).toBe(0)
    expect(bonoPieUf(1000, pie)).toBe(0)
    expect(tieneBonoPie(pie)).toBe(false)
  })

  it('tramos que suman el pie con ruido flotante → sin bono pie', () => {
    const pie = {
      ...DEFAULT_PIE,
      pie_pct: 0.2,
      upfront_pct: 0.02,
      cuoton_pct: 0.08,
      cuotas_antes_entrega_pct: 0.05,
      cuotas_despues_entrega_pct: 0.05,
    }
    expect(tieneBonoPie(pie)).toBe(false)
  })

  it('tramos que suman 0,15 con pie 0,20 → hay bono pie', () => {
    const pie = {
      ...DEFAULT_PIE,
      pie_pct: 0.2,
      upfront_pct: 0.05,
      cuoton_pct: 0,
      cuotas_antes_entrega_pct: 0.05,
      cuotas_despues_entrega_pct: 0.05,
    }
    expect(tieneBonoPie(pie)).toBe(true)
  })
})
