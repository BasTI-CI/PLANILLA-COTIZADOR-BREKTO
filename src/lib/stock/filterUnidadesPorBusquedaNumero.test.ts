import { describe, it, expect } from 'vitest'
import { filterUnidadesPorBusquedaNumero } from './filterUnidadesPorBusquedaNumero'
import type { UnidadSupabase } from '@/types'

const u = (numero: string): UnidadSupabase => ({
  id: '1',
  proyecto_id: 'p',
  numero,
  tipologia: '1D',
  sup_interior_m2: 1,
  sup_terraza_m2: 0,
  sup_total_m2: 1,
  orientacion: '',
  entrega: '',
  precio_lista_uf: 1,
  descuento_uf: 0,
  precio_neto_uf: 1,
  bono_descuento_pct: 0,
  bono_max_pct: 0,
  bono_aplica_adicionales: false,
  pie_pct: 0,
  estacionamiento_uf: 0,
  bodega_uf: 0,
  disponible: true,
})

describe('filterUnidadesPorBusquedaNumero', () => {
  const list = [u('1205'), u('A-301'), u('99')]

  it('query vacía → sin filtro', () => {
    expect(filterUnidadesPorBusquedaNumero(list, '')).toEqual(list)
  })

  it('coincidencia parcial insensible a mayúsculas', () => {
    expect(filterUnidadesPorBusquedaNumero(list, 'a-3')).toEqual([u('A-301')])
  })
})
