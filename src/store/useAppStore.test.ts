import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import { unidadSupabaseToDatosPropiedad } from '@/lib/stock/mapToDatosPropiedad'
import type { ProyectoSupabase, UnidadSupabase } from '@/types'

const inicial = useAppStore.getState()

beforeEach(() => {
  useAppStore.setState(inicial, true)
})

describe('useAppStore — tope de cotizaciones', () => {
  it('agregarCotizacion se detiene en 10', () => {
    for (let i = 0; i < 15; i++) useAppStore.getState().agregarCotizacion()
    const { cotizaciones, cotizacion_activa_idx } = useAppStore.getState()
    expect(cotizaciones).toHaveLength(10)
    expect(cotizaciones.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(cotizacion_activa_idx).toBe(9)
  })

  it('eliminarCotizacion renumera ids 0..8', () => {
    for (let i = 0; i < 15; i++) useAppStore.getState().agregarCotizacion()
    useAppStore.getState().eliminarCotizacion(4)
    const { cotizaciones } = useAppStore.getState()
    expect(cotizaciones.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('useAppStore — barrio al cargar una unidad (B-11)', () => {
  const proyecto: ProyectoSupabase = {
    id: 'p1', nombre: 'Edificio', comuna: 'Ñuñoa', barrio: 'COD-123', direccion: '',
  }
  const unidad: UnidadSupabase = {
    id: 'u1', proyecto_id: 'p1', numero: '1001', tipologia: '2D2B',
    sup_interior_m2: 50, sup_terraza_m2: 5, sup_total_m2: 55, orientacion: 'N', entrega: '2027-06',
    precio_lista_uf: 4000, descuento_uf: 0, precio_neto_uf: 4000, bono_descuento_pct: 0.1,
    bono_max_pct: 0, bono_aplica_adicionales: false, pie_pct: 0.1,
    estacionamiento_uf: 0, bodega_uf: 0, disponible: true,
  }

  it('cargarDesdeSupabase vacía el barrio escrito a mano', () => {
    const { setPropiedad, cargarDesdeSupabase } = useAppStore.getState()
    setPropiedad(0, { proyecto_barrio: 'Ñuñoa' })
    expect(useAppStore.getState().cotizaciones[0].propiedad.proyecto_barrio).toBe('Ñuñoa')
    cargarDesdeSupabase(0, unidadSupabaseToDatosPropiedad(proyecto, unidad))
    expect(useAppStore.getState().cotizaciones[0].propiedad.proyecto_barrio).toBe('')
  })
})
