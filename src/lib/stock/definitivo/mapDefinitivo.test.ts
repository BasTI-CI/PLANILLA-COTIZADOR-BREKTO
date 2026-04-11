import { describe, it, expect } from 'vitest'
import { mapUnidadRowDefinitivo } from './mapDefinitivo'

describe('mapUnidadRowDefinitivo', () => {
  it('mapea fila mínima a UnidadSupabase', () => {
    const u = mapUnidadRowDefinitivo({
      id: 'u1',
      proyecto_id: 'p1',
      numero: '101',
      precio_lista_uf: 100,
      precio_neto_uf: 90,
      bono_descuento_pct: 0.1,
      bono_max_pct: 0,
    })
    expect(u.id).toBe('u1')
    expect(u.proyecto_id).toBe('p1')
    expect(u.precio_lista_uf).toBe(100)
    expect(u.precio_neto_uf).toBe(90)
    expect(u.descuento_uf).toBe(10)
  })
})
