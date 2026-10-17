import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'

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
