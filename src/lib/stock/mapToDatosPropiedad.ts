import type { DatosPropiedad, ProyectoSupabase, UnidadSupabase } from '@/types'

export type MapUnidadToPropiedadOptions = {
  /** Reserva comercial por defecto si la API no envía el dato. */
  reserva_clp_default?: number
}

const DEFAULT_RESERVA = 100_000

/**
 * Puente único: fila de stock normalizada → `DatosPropiedad` del motor.
 * Cualquier nuevo backend debe mapear primero a `UnidadSupabase` y luego usar esto,
 * o extender esta función con opciones explícitas (sin tocar fórmulas en engines).
 */
export function unidadSupabaseToDatosPropiedad(
  proyecto: ProyectoSupabase,
  unidad: UnidadSupabase,
  options: MapUnidadToPropiedadOptions = {}
): DatosPropiedad {
  const reserva = options.reserva_clp_default ?? DEFAULT_RESERVA
  return {
    proyecto_nombre: proyecto.nombre,
    proyecto_comuna: proyecto.comuna,
    proyecto_barrio: proyecto.barrio ?? '',
    proyecto_direccion: proyecto.direccion ?? '',
    unidad_numero: unidad.numero,
    unidad_tipologia: unidad.tipologia,
    unidad_sup_interior_m2: unidad.sup_interior_m2,
    unidad_sup_terraza_m2: unidad.sup_terraza_m2,
    unidad_sup_total_m2: unidad.sup_total_m2,
    unidad_orientacion: unidad.orientacion,
    unidad_entrega: unidad.entrega,
    precio_lista_uf: unidad.precio_lista_uf,
    descuento_uf: unidad.descuento_uf,
    precio_neto_uf: unidad.precio_neto_uf,
    bono_descuento_pct: unidad.bono_descuento_pct,
    bono_max_pct: unidad.bono_max_pct,
    bono_aplica_adicionales: unidad.bono_aplica_adicionales,
    estacionamiento_uf: unidad.estacionamiento_uf,
    bodega_uf: unidad.bodega_uf,
    reserva_clp: reserva,
  }
}
