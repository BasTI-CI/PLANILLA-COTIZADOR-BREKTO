/**
 * Forma **esperada** de cada fila PostgREST antes del mapeo a `UnidadSupabase`.
 *
 * Renombra propiedades para que coincidan 1:1 con las columnas de tu tabla
 * (TypeScript te marcará errores en `mapUnidadRowDefinitivo` hasta alinear tipos).
 *
 * Tipos numéricos: Supabase suele devolver `number`; los % pueden venir como
 * decimal 0–1 o como 0–100 según negocio — normaliza en el mapper.
 */
export interface ProyectoRowDefinitivo {
  id: string | number
  nombre: string | null
  comuna?: string | null
  barrio?: string | null
  direccion?: string | null
  /** Si la inmobiliaria viene en join o columna plana */
  inmobiliaria_nombre?: string | null
  id_inmobiliaria?: string | number | null
  estado?: string | null
}

export interface UnidadRowDefinitivo {
  id: string | number
  proyecto_id: string | number

  numero: string | null
  tipologia?: string | null
  sup_interior_m2?: number | null
  sup_terraza_m2?: number | null
  sup_total_m2?: number | null
  orientacion?: string | null
  entrega?: string | null

  precio_lista_uf: number | null
  /** Si no existe, el mapper puede derivar de lista − neto */
  descuento_uf?: number | null
  precio_neto_uf: number | null

  /** Decimales 0–1 (ej. 0.15). Si la BD guarda 15, dividir en el mapper. */
  bono_descuento_pct?: number | null
  bono_max_pct?: number | null
  bono_aplica_adicionales?: boolean | null

  pie_pct?: number | null
  estacionamiento_uf?: number | null
  bodega_uf?: number | null
  disponible?: boolean | null
}
