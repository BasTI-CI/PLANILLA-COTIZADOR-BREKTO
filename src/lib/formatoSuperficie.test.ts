import { describe, it, expect } from 'vitest'
import { formatSuperficie, formatM2 } from './formatoSuperficie'

describe('formatoSuperficie', () => {
  it('redondea el ruido de float (unidad 914, Cot. G)', () => {
    expect(formatSuperficie(52.400000000000006)).toBe('52,4')
    expect(formatM2(52.400000000000006)).toBe('52,4 m²')
  })

  it('enteros sin decimales de relleno', () => {
    expect(formatSuperficie(80)).toBe('80')
    expect(formatM2(80)).toBe('80 m²')
  })

  it('usa coma decimal y máximo 2 decimales', () => {
    expect(formatSuperficie(43.6)).toBe('43,6')
    expect(formatSuperficie(43.65)).toBe('43,65')
    expect(formatSuperficie(52.456)).toBe('52,46')
  })

  it('cero se muestra como 0', () => {
    expect(formatM2(0)).toBe('0 m²')
  })

  it('valores no finitos se muestran como —', () => {
    expect(formatSuperficie(NaN)).toBe('—')
    expect(formatM2(NaN)).toBe('—')
    expect(formatSuperficie(Infinity)).toBe('—')
    expect(formatM2(Infinity)).toBe('—')
  })

  it('separador de miles con punto', () => {
    expect(formatSuperficie(1234.5)).toBe('1.234,5')
  })
})
