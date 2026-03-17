import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  AppState,
  Cotizacion,
  DatosGlobales,
  DatosDiversificacion,
  DatosPropiedad,
  DatosDesglosePie,
  DatosHipotecario,
  DatosRentabilidad,
} from '@/types'
import {
  DEFAULT_HIPOTECARIO,
  DEFAULT_RENTABILIDAD,
  DEFAULT_PIE,
  DEFAULT_DIVERSIFICACION,
} from '@/types'
import { calcularResultadosCotizacion } from '@/lib/engines/calculosCotizacion'

// ─────────────────────────────────────────────
// Cotización vacía por defecto
// ─────────────────────────────────────────────
const cotizacionVacia = (id: number): Cotizacion => ({
  id,
  activa: false,
  modo_fuente: 'manual',
  califica_iva: false,
  propiedad: {
    proyecto_nombre: '',
    proyecto_comuna: '',
    proyecto_barrio: '',
    proyecto_direccion: '',
    unidad_numero: '',
    unidad_tipologia: '',
    unidad_sup_interior_m2: 0,
    unidad_sup_terraza_m2: 0,
    unidad_sup_total_m2: 0,
    unidad_orientacion: '',
    unidad_entrega: '',
    precio_lista_uf: 0,
    descuento_uf: 0,
    precio_compra_uf: 0,
    bono_descuento_pct: 0,
    bono_max_pct: 0,
    estacionamiento_uf: 0,
    bodega_uf: 0,
    reserva_clp: 100_000,
  },
  pie: { ...DEFAULT_PIE },
  hipotecario: { ...DEFAULT_HIPOTECARIO },
  rentabilidad: { ...DEFAULT_RENTABILIDAD },
})

// ─────────────────────────────────────────────
// Store actions interface
// ─────────────────────────────────────────────
interface AppActions {
  // Datos globales
  setGlobal: (data: Partial<DatosGlobales>) => void
  setUfValor: (uf: number) => void

  // Cotizaciones
  agregarCotizacion: () => void
  eliminarCotizacion: (id: number) => void
  setCotizacionActiva: (idx: number) => void
  setModoFuente: (idx: number, modo: 'supabase' | 'manual') => void
  setCalificaIva: (idx: number, califica: boolean) => void

  // Setters por sección de cotización
  setRentabilidad: (idx: number, data: Partial<DatosRentabilidad>) => void
  setPropiedad: (idx: number, data: Partial<DatosPropiedad>) => void
  setPie: (idx: number, data: Partial<DatosDesglosePie>) => void
  setHipotecario: (idx: number, data: Partial<DatosHipotecario>) => void

  // Cargar unidad desde Supabase (reemplaza toda la propiedad)
  cargarDesdeSupabase: (idx: number, propiedad: DatosPropiedad) => void

  // Diversificación
  setDiversificacion: (data: Partial<DatosDiversificacion>) => void

  // Vista
  setVista: (vista: AppState['vista_actual']) => void

  // Recalcular resultados
  recalcular: () => void
}

// ─────────────────────────────────────────────
// Store (Zustand + immer)
// ─────────────────────────────────────────────
export const useAppStore = create<AppState & AppActions>()(
  immer((set, get) => ({
    // ── Estado inicial ──────────────────────
    global: {
      inversionista_nombre: '',
      inversionista_rut: '',
      cotizacion_fecha: new Date().toISOString().split('T')[0],
      uf_valor_clp: 39_836,
    },
    cotizaciones: [cotizacionVacia(0)],  // empieza con 1 cotización vacía
    diversificacion: { ...DEFAULT_DIVERSIFICACION },
    resultados: [],
    cotizacion_activa_idx: 0,
    vista_actual: 'cotizacion',

    // ── Datos globales ──────────────────────
    setGlobal: (data) =>
      set((state) => { Object.assign(state.global, data) }),

    setUfValor: (uf) =>
      set((state) => { state.global.uf_valor_clp = uf }),

    // ── Cotizaciones ────────────────────────
    agregarCotizacion: () =>
      set((state) => {
        if (state.cotizaciones.length >= 4) return
        const nuevoId = state.cotizaciones.length
        state.cotizaciones.push(cotizacionVacia(nuevoId))
        state.cotizacion_activa_idx = nuevoId
      }),

    eliminarCotizacion: (id) =>
      set((state) => {
        if (state.cotizaciones.length <= 1) return
        state.cotizaciones = state.cotizaciones
          .filter((c) => c.id !== id)
          .map((c, i) => ({ ...c, id: i }))
        state.cotizacion_activa_idx = 0
      }),

    setCotizacionActiva: (idx) =>
      set((state) => { state.cotizacion_activa_idx = idx }),

    setModoFuente: (idx, modo) =>
      set((state) => { state.cotizaciones[idx].modo_fuente = modo }),

    setCalificaIva: (idx, califica) =>
      set((state) => {
        state.cotizaciones[idx].califica_iva = califica
        // Recalcular IVA total si no está en modo manual override
        if (!state.diversificacion.diversif_iva_manual_override) {
          state.diversificacion.diversif_iva_total_clp =
            state.cotizaciones
              .filter((c) => c.activa && c.califica_iva)
              .reduce((sum, c) => sum + c.propiedad.precio_compra_uf * 0.15 * state.global.uf_valor_clp, 0)
        }
      }),

    // ── Setters por sección ─────────────────
    setRentabilidad: (idx, data) =>
      set((state) => { Object.assign(state.cotizaciones[idx].rentabilidad, data) }),

    setPropiedad: (idx, data) =>
      set((state) => {
        Object.assign(state.cotizaciones[idx].propiedad, data)
        state.cotizaciones[idx].activa = true
      }),

    setPie: (idx, data) =>
      set((state) => {
        Object.assign(state.cotizaciones[idx].pie, data)
      }),

    setHipotecario: (idx, data) =>
      set((state) => {
        Object.assign(state.cotizaciones[idx].hipotecario, data)
      }),

    // ── Carga desde Supabase ────────────────
    cargarDesdeSupabase: (idx, propiedad) =>
      set((state) => {
        state.cotizaciones[idx].propiedad = propiedad
        state.cotizaciones[idx].modo_fuente = 'supabase'
        state.cotizaciones[idx].activa = true
      }),

    // ── Diversificación ─────────────────────
    setDiversificacion: (data) =>
      set((state) => { Object.assign(state.diversificacion, data) }),

    // ── Vista ───────────────────────────────
    setVista: (vista) =>
      set((state) => { state.vista_actual = vista }),

    // ── Recalcular ──────────────────────────
    recalcular: () => {
      const { cotizaciones, global } = get()
      const resultados = cotizaciones
        .filter((c) => c.activa)
        .map((c) => calcularResultadosCotizacion(c, global.uf_valor_clp))
      set((state) => { state.resultados = resultados })
    },
  }))
)
