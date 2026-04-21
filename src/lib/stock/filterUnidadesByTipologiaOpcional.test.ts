import { describe, it, expect } from 'vitest'
import { filterUnidadesByTipologiaOpcional } from './filterUnidadesByTipologiaOpcional'
import type { UnidadSupabase } from '@/types'

const u = (tipologia: string): UnidadSupabase => ({
  id: '1',
  proyecto_id: 'p',
  numero: '1',
  tipologia,
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

describe('filterUnidadesByTipologiaOpcional', () => {
  const list = [u('1D1B'), u('2D2B')]

  it('sin tipología seleccionada → sin filtro', () => {
    expect(filterUnidadesByTipologiaOpcional(list, '', ['1D1B'])).toEqual(list)
    expect(filterUnidadesByTipologiaOpcional(list, '   ', ['1D1B'])).toEqual(list)
  })

  it('catálogo vacío → sin filtro aunque haya selección', () => {
    expect(filterUnidadesByTipologiaOpcional(list, '2D2B', [])).toEqual(list)
  })

  it('catálogo con datos y tipología → filtra', () => {
    expect(filterUnidadesByTipologiaOpcional(list, '2D2B', ['1D1B', '2D2B'])).toEqual([u('2D2B')])
  })
})
