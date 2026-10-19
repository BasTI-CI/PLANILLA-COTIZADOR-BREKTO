import { describe, expect, it } from 'vitest'
import { repartirEnHojas } from './repartirEnHojas'

describe('repartirEnHojas (B-10)', () => {
  it('lista vacía → sin hojas', () => {
    expect(repartirEnHojas([], 100)).toEqual([])
  })

  it('todo cabe → 1 hoja', () => {
    expect(repartirEnHojas([30, 30, 40], 100)).toEqual([[0, 1, 2]])
  })

  it('desborde → el ítem que no cabe pasa entero a la hoja siguiente', () => {
    expect(repartirEnHojas([60, 30, 20], 100)).toEqual([[0, 1], [2]])
  })

  it('conserva el orden: un ítem chico posterior no se adelanta a una hoja anterior', () => {
    expect(repartirEnHojas([50, 60, 10], 100)).toEqual([[0], [1, 2]])
  })

  it('un ítem más alto que el disponible va solo en su hoja', () => {
    expect(repartirEnHojas([20, 150, 20], 100)).toEqual([[0], [1], [2]])
  })

  it('respeta maxPorHoja (10 filas por hoja)', () => {
    const hojas = repartirEnHojas(Array(23).fill(10), 10_000, 10)
    expect(hojas.map((h) => h.length)).toEqual([10, 10, 3])
    expect(hojas.flat()).toEqual(Array.from({ length: 23 }, (_, i) => i))
  })

  it('caso medido: Resumen 271 + A 76 + B 298 + C 271 en 823 px → C pasa a la 2ª hoja', () => {
    expect(repartirEnHojas([271, 76, 298, 271], 823)).toEqual([[0, 1, 2], [3]])
  })
})
