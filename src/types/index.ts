// ============================================================
// BREKTO COTIZADOR — Tipos TypeScript
// Arquitectura: array de hasta 4 Cotizacion[], + datos globales
// ============================================================

// ------------------------------------------------------------------
// 1. DATOS GLOBALES (compartidos por toda la sesión de cotización)
// ------------------------------------------------------------------
export interface DatosGlobales {
  inversionista_nombre: string
  inversionista_rut: string
  cotizacion_fecha: string         // ISO date string
  uf_valor_clp: number             // valor UF del día (API o manual)
}

// ------------------------------------------------------------------
// 2. COTIZACIÓN — datos de una unidad individual
// Se repite hasta 4 veces (índices 0–3, equiv. a, b, c, d)
// ------------------------------------------------------------------
export type FuenteDatos = 'supabase' | 'manual'

export interface DatosPropiedad {
  // Identificación del proyecto
  proyecto_nombre: string
  proyecto_comuna: string
  proyecto_barrio: string
  proyecto_direccion: string

  // Datos de la unidad
  unidad_numero: string
  unidad_tipologia: string              // Studio, 1D1B, 2D2B, etc.
  unidad_sup_interior_m2: number
  unidad_sup_terraza_m2: number
  unidad_sup_total_m2: number
  unidad_orientacion: string
  unidad_entrega: string               // "Inmediata" o fecha

  // Precios (desde Supabase o manual)
  precio_lista_uf: number
  descuento_uf: number
  precio_compra_uf: number             // = precio_lista - descuento
  bono_descuento_pct: number           // % bono aplicado
  bono_max_pct: number

  // Adicionales
  estacionamiento_uf: number
  bodega_uf: number
  reserva_clp: number
}

export interface DatosDesglosePie {
  pie_pct: number                        // % pie total (ej: 0.10 = 10%)
  upfront_pct: number                    // % abono inicial
  cuoton_pct: number                     // % cuotón
  cuoton_n_cuotas: number               // N° cuotas del cuotón
  cuotas_antes_entrega_pct: number
  cuotas_antes_entrega_n: number
  cuotas_despues_entrega_pct: number
  cuotas_despues_entrega_n: number
  pie_n_cuotas_total: number            // N° cuotas totales del pie
}

export interface DatosHipotecario {
  hipotecario_tasa_anual: number         // decimal (ej: 0.034 = 3.4%)
  hipotecario_plazo_anos: number         // años (ej: 30)
  hipotecario_aprobacion_pct: number     // LTV decimal (ej: 0.9 = 90%)
  hipotecario_abono_voluntario: number   // $CLP
  hipotecario_seg_desgravamen_uf: number // UF/mes fijo
  hipotecario_seg_sismos_uf: number      // UF/mes fijo
  hipotecario_tasa_seg_vida_pct: number  // % mensual sobre saldo
}

export type TipoRenta = 'larga' | 'corta'

export interface DatosRentabilidad {
  tipo_renta: TipoRenta                  // selector mutuamente excluyente
  plusvalia_anual_pct: number            // decimal (ej: 0.042 = 4.2%)
  plusvalia_anos: number                 // horizonte (default: 5)

  // ── Renta Larga ──────────────────────────────────────────────────
  // Ingreso mensual neto (después de comisión corretaje, vacancia, etc.)
  arriendo_mensual_clp: number           // $CLP neto final que va al flujo

  // ── Renta Corta (AirBnB / alquiler temporal) ─────────────────────
  // El arriendo_mensual_clp se calcula = ingreso_bruto - admin - gastos_comunes
  airbnb_ingreso_bruto_clp: number       // ingreso mensual bruto calculado externamente
  airbnb_admin_pct: number               // % comisión plataforma/administrador (default: 0.25)
  gastos_comunes_clp: number             // $CLP/mes gastos comunes
  // Campos informativos (no entran al flujo directamente):
  airbnb_valor_dia_clp: number           // $CLP por noche (referencia)
  airbnb_ocupacion_pct: number           // % ocupación mensual (referencia)
}

// Objeto cotización completo (1 de hasta 4)
export interface Cotizacion {
  id: number                             // 0, 1, 2 ó 3
  modo_fuente: FuenteDatos               // 'supabase' | 'manual'
  activa: boolean                        // si esta cotización tiene datos
  califica_iva: boolean                  // ☑ checkbox hoja Flujo — ¿la unidad recibe devolución IVA?

  propiedad: DatosPropiedad
  pie: DatosDesglosePie
  hipotecario: DatosHipotecario
  rentabilidad: DatosRentabilidad
}

// ------------------------------------------------------------------
// 3. RESULTADOS CALCULADOS (derivados de Cotizacion, no editables)
// ------------------------------------------------------------------
export interface ResultadosHipotecario {
  monto_credito_uf: number
  monto_credito_clp: number
  dividendo_capital_uf: number           // cuota sin seguros
  dividendo_total_uf: number             // cuota con todos los seguros
  dividendo_total_clp: number
  tabla_amortizacion: FilaAmortizacion[]
}

export interface FilaAmortizacion {
  mes: number
  capital_uf: number
  interes_uf: number
  seg_vida_uf: number
  seg_desgravamen_uf: number
  seg_sismos_uf: number
  cuota_total_uf: number
  cuota_total_clp: number
  saldo_uf: number
}

export interface ResultadosPlusvaliaVenta {
  precio_venta_5anos_uf: number
  ganancia_venta_uf: number
  ganancia_venta_clp: number
  utilidad_pct: number                   // sobre el pie invertido
}

export interface ResultadosArriendo {
  // El ingreso neto que va al flujo (= arriendo neto larga, o neto renta corta)
  ingreso_neto_flujo_clp: number
  resultado_mensual_clp: number          // ingreso_neto - dividendo

  // Renta Larga
  cap_rate_anual_pct: number

  // Renta Corta
  airbnb_ingreso_bruto_clp: number
  airbnb_admin_clp: number
  airbnb_resultado_clp: number
  airbnb_cap_rate_anual_pct: number
}

export interface ResultadosCotizacion {
  cotizacion_id: number
  escrituracion_uf: number               // precio_compra + bono_pie
  bono_pie_uf: number
  pie_total_uf: number
  pie_total_clp: number
  hipotecario: ResultadosHipotecario
  plusvalia: ResultadosPlusvaliaVenta
  arriendo: ResultadosArriendo
}

// ------------------------------------------------------------------
// 4. DIVERSIFICACIÓN DE AHORROS (módulo 60 meses)
// ------------------------------------------------------------------
export interface DatosDiversificacion {
  diversif_tasa_mensual: number          // decimal (ej: 0.006 = 0.6%)
  diversif_capital_inicial_clp: number
  diversif_ahorro_mensual_clp: number

  // IVA — calculado automáticamente desde las cotizaciones con califica_iva=true
  // 15% × precio_compra_uf × uf_valor_clp por cada cotización elegible
  // Se puede sobrescribir manualmente si el usuario lo necesita
  diversif_iva_manual_override: boolean  // false = calculado auto, true = ingresado manual
  diversif_iva_total_clp: number         // monto de devolución IVA total

  // Mes de entrega del primer departamento
  // A partir de este mes, el flujo incluye (Dividendo - Arriendo) en vez de cuota pie
  mes_entrega_primer_depto: number       // mes absoluto (1-60)

  diversif_gasto_escrituracion_clp: number
}

export interface FilaDiversificacion {
  mes: number
  capital_inicio: number
  ahorro_mensual: number
  rentabilizacion: number                // interés ganado ese mes
  egreso_cuotas: number                  // pago cuota pie ese mes
  iva_inyeccion: number                  // 0 salvo mes de IVA
  capital_fin: number                    // saldo al final del mes
  ganancia_acumulada: number
}

// ------------------------------------------------------------------
// 5. ESTADO GLOBAL DE LA APP (Zustand store)
// ------------------------------------------------------------------
export interface AppState {
  // Datos de la sesión
  global: DatosGlobales
  cotizaciones: Cotizacion[]             // 1 a 4 elementos
  diversificacion: DatosDiversificacion

  // Resultados calculados (actualizados automáticamente)
  resultados: ResultadosCotizacion[]

  // UI state
  cotizacion_activa_idx: number          // cuál cotización está enfocada
  vista_actual: 'cotizacion' | 'resumen' | 'flujo' | 'pdf'
}

// ------------------------------------------------------------------
// 6. ENTIDADES DE SUPABASE (tabla de stock)
// ------------------------------------------------------------------
export interface ProyectoSupabase {
  id: string
  nombre: string
  comuna: string
  barrio: string
  direccion: string
  inmobiliaria?: string
  imagen_url?: string
}

export interface UnidadSupabase {
  id: string
  proyecto_id: string
  numero: string
  tipologia: string
  sup_interior_m2: number
  sup_terraza_m2: number
  sup_total_m2: number
  orientacion: string
  entrega: string
  precio_lista_uf: number
  descuento_uf: number
  precio_compra_uf: number
  bono_descuento_pct: number
  bono_max_pct: number
  pie_pct: number
  estacionamiento_uf: number
  bodega_uf: number
  disponible: boolean
}

// ------------------------------------------------------------------
// 7. VALORES POR DEFECTO (para nuevas cotizaciones)
// ------------------------------------------------------------------
export const DEFAULT_HIPOTECARIO: DatosHipotecario = {
  hipotecario_tasa_anual: 0.034,         // 3.4%
  hipotecario_plazo_anos: 30,
  hipotecario_aprobacion_pct: 0.9,       // 90%
  hipotecario_abono_voluntario: 0,
  hipotecario_seg_desgravamen_uf: 0.0157,
  hipotecario_seg_sismos_uf: 0.0082,
  hipotecario_tasa_seg_vida_pct: 0.000285,
}

export const DEFAULT_RENTABILIDAD: DatosRentabilidad = {
  tipo_renta: 'larga',
  plusvalia_anual_pct: 0.042,            // 4.2%
  plusvalia_anos: 5,
  arriendo_mensual_clp: 0,
  airbnb_ingreso_bruto_clp: 0,
  airbnb_admin_pct: 0.25,
  gastos_comunes_clp: 0,
  airbnb_valor_dia_clp: 0,
  airbnb_ocupacion_pct: 0.68,
}

export const DEFAULT_PIE: DatosDesglosePie = {
  pie_pct: 0.10,
  upfront_pct: 0,
  cuoton_pct: 0,
  cuoton_n_cuotas: 0,
  cuotas_antes_entrega_pct: 0,
  cuotas_antes_entrega_n: 0,
  cuotas_despues_entrega_pct: 0,
  cuotas_despues_entrega_n: 0,
  pie_n_cuotas_total: 60,
}

export const DEFAULT_DIVERSIFICACION: DatosDiversificacion = {
  diversif_tasa_mensual: 0.006,          // 0.6%
  diversif_capital_inicial_clp: 15_000_000,
  diversif_ahorro_mensual_clp: 600_000,
  diversif_iva_manual_override: false,   // auto-calculado
  diversif_iva_total_clp: 0,
  mes_entrega_primer_depto: 37,          // mes 37 por defecto (a ajustar por usuario)
  diversif_gasto_escrituracion_clp: 3_000_000,
}
