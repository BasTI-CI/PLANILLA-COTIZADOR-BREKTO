import { describe, it, expect } from 'vitest'
import type { ProyectoSupabase, UnidadSupabase } from '@/types'
import { barrioInicialAlCargarUnidad, unidadSupabaseToDatosPropiedad } from './mapToDatosPropiedad'

const proyectoBase: ProyectoSupabase = {
  id: 'p1',
  nombre: 'Edificio Catálogo',
  comuna: 'Ñuñoa',
  barrio: 'Providencia',
  direccion: 'Calle 123',
}

const unidadBase: UnidadSupabase = {
  id: 'u1',
  proyecto_id: 'p1',
  numero: '1001',
  tipologia: '2D2B',
  sup_interior_m2: 50,
  sup_terraza_m2: 5,
  sup_total_m2: 55,
  orientacion: 'N',
  entrega: '2027-06',
  precio_lista_uf: 4000,
  descuento_uf: 0,
  precio_neto_uf: 4000,
  bono_descuento_pct: 0.1,
  bono_max_pct: 0,
  bono_aplica_adicionales: false,
  pie_pct: 0.1,
  estacionamiento_uf: 0,
  bodega_uf: 0,
  disponible: true,
}

describe('unidadSupabaseToDatosPropiedad — barrio (B-11)', () => {
  it('el punto de control devuelve vacío', () => {
    expect(barrioInicialAlCargarUnidad()).toBe('')
  })

  it.each(['Providencia', 'COD-123'])('proyecto.barrio = «%s» → proyecto_barrio vacío', (barrio) => {
    const prop = unidadSupabaseToDatosPropiedad({ ...proyectoBase, barrio }, unidadBase)
    expect(prop.proyecto_barrio).toBe('')
  })

  it('el resto de los campos se mapea igual', () => {
    const prop = unidadSupabaseToDatosPropiedad(proyectoBase, unidadBase)
    expect(prop.proyecto_nombre).toBe('Edificio Catálogo')
    expect(prop.proyecto_comuna).toBe('Ñuñoa')
    expect(prop.unidad_numero).toBe('1001')

    const conStock = unidadSupabaseToDatosPropiedad(proyectoBase, {
      ...unidadBase,
      proyecto_nombre: 'Edificio Stock',
      comuna: 'Macul',
    })
    expect(conStock.proyecto_nombre).toBe('Edificio Stock')
    expect(conStock.proyecto_comuna).toBe('Macul')
  })
})
