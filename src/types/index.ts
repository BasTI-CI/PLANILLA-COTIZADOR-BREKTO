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
  /** Correo del cliente / inversionista. Usado en header del PDF operacional (UGC / Jira). */
  inversionista_correo: string
  /** Datos del asesor comercial — usados en ambos exportables (comercial y operacional). */
  asesor_nombre: string
  asesor_correo: string
  asesor_telefono: string
  cotizacion_fecha: string         // ISO date string
  uf_valor_clp: number             // valor UF del día (API o manual)
}

// ------------------------------------------------------------------
// 2. COTIZACIÓN — datos de una unidad individual
// Se repite hasta 4 veces (índices 0–3, equiv. a, b, c, d)
// ------------------------------------------------------------------
export type FuenteDatos = 'supabase' | 'manual'

/** Promociones comerciales (checkboxes en cotización → leyenda en PDF individual). */
export interface PromocionesCotizacion {
  arriendo_garantizado: boolean
  kit_arriendo: boolean
  kit_inversionista: boolean
  credito_pie_institucion: boolean
  bono_amoblado: boolean
  credito_aval: boolean
  promo_gastos_operacionales: boolean
  /** Leyenda fija si está marcado. */
  comentario_devolucion_iva: boolean
  /** Gift Card al cliente. Si está activo, el monto se ingresa en `gift_card_cliente_clp`. */
  gift_card_cliente: boolean
  /** Monto en CLP de la Gift Card. Solo se considera si `gift_card_cliente = true`. */
  gift_card_cliente_clp: number
}

export const DEFAULT_PROMOCIONES: PromocionesCotizacion = {
  arriendo_garantizado: false,
  kit_arriendo: false,
  kit_inversionista: false,
  credito_pie_institucion: false,
  bono_amoblado: false,
  credito_aval: false,
  promo_gastos_operacionales: false,
  comentario_devolucion_iva: false,
  gift_card_cliente: false,
  gift_card_cliente_clp: 0,
}

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

  // Precios (desde Supabase o manual) — ver variables_calculo.md §1.0.0
  precio_lista_uf: number               // catálogo depto antes de descuentos comerciales
  descuento_uf: number
  precio_neto_uf: number               // neto tras dcto. sobre lista; el «precio de compra depto» mostrado es ×(1−bono_max_pct) si aplica
  /** Bono pie = beneficio inmobiliario (mismo % en negocio). Pie a documentar (`pie_pct`) debe ser ≥ este %. */
  bono_descuento_pct: number           // variables_calculo.md §1
  bono_max_pct: number                 // §1; en UI: Descuento por Bonificación (%)
  bono_aplica_adicionales: boolean    // variables_calculo.md §1

  // Adicionales (UF a precio de compra de cada ítem; ver §1.0.0)
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
  pie_n_cuotas_total: number            // N° cuotas para diversificación (flujo); no usado en calculosPie
}

export interface DatosHipotecario {
  hipotecario_tasa_anual: number         // decimal (ej: 0.034 = 3.4%)
  hipotecario_plazo_anos: number         // años (ej: 30)
  hipotecario_aprobacion_pct: number     // LTV decimal (ej: 0.9 = 90%)
  hipotecario_seg_desgravamen_uf: number // UF/mes fijo
  hipotecario_seg_sismos_uf: number      // UF/mes fijo
  hipotecario_tasa_seg_vida_pct: number  // % mensual sobre saldo
}

export type TipoRenta = 'larga' | 'corta'

export interface DatosRentabilidad {
  /** Qué perfil de ingreso usa el flujo de caja y el comparativo arriendo–dividendo (ambos perfiles se pueden llenar abajo). */
  tipo_renta: TipoRenta
  plusvalia_anual_pct: number            // decimal (ej: 0.042 = 4.2%)
  plusvalia_anos: number                 // horizonte (default: 5)

  // ── Renta Larga ──────────────────────────────────────────────────
  // Ingreso mensual neto (después de comisión corretaje, vacancia, etc.)
  arriendo_mensual_clp: number           // $CLP neto final que va al flujo

  // ── Renta Corta (AirBnB / alquiler temporal) ─────────────────────
  airbnb_admin_pct: number               // % comisión plataforma/administrador (decimal)
  gastos_comunes_clp: number             // $CLP/mes costos fijos
  /** Tarifa/noche que cobra el propietario (CLP). */
  airbnb_valor_dia_clp: number
  /** Ocupación mensual 0–1 (p. ej. 0,68 = 68%). */
  airbnb_ocupacion_pct: number
}

// Objeto cotización completo (1 de hasta 4)
export interface Cotizacion {
  id: number                             // 0, 1, 2 ó 3
  modo_fuente: FuenteDatos               // 'supabase' | 'manual'
  activa: boolean                        // si esta cotización tiene datos
  califica_iva: boolean                  // ☑ checkbox hoja Flujo — ¿la unidad recibe devolución IVA?
  /** Mes absoluto (1–60) de entrega en el horizonte de 60 meses; `null` = sin definir (el asesor lo ingresa en Flujo). */
  mes_entrega_flujo: number | null

  propiedad: DatosPropiedad
  pie: DatosDesglosePie
  hipotecario: DatosHipotecario
  rentabilidad: DatosRentabilidad
  promociones: PromocionesCotizacion
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
  /** precioCompraDeptoUf + est + bod (UF), pre-BI. @see precioCompra.ts */
  precio_compra_total_uf: number
  valor_tasacion_uf: number
  /** Base banco / pie % / crédito / plusvalía base (variables_calculo.md §1.0.0) */
  valor_escritura_uf: number
  beneficio_inmobiliario_uf: number    // variables_calculo.md §2 — tasación × bono_descuento_pct
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
  // 15% × precio de compra del solo departamento (UF×CLP); sin est/bod ni base escrituración
  // Se puede sobrescribir manualmente si el usuario lo necesita
  diversif_iva_manual_override: boolean  // false = calculado auto, true = ingresado manual
  diversif_iva_total_clp: number         // monto de devolución IVA total

  /** Gastos de escrituración desglosados (se descuentan del capital inicial al inicio) */
  diversif_gastos_operacionales_clp: number
  diversif_amoblado_otros_clp: number
}

export interface FilaDiversificacion {
  mes: number
  capital_inicio: number                      // saldo al inicio del mes (base sobre la que rentabiliza este mes)
  ahorro_mensual: number
  rentabilizacion: number                     // capital_inicio × tasa_mensual (no incluye movimientos del mes)
  egreso_pie_clp: number                      // upfront + cuotas antes/después + cuotón del mes (siempre ≥ 0)
  dividendo_menos_arriendo_clp: number        // (dividendo − arriendo neto) post-entrega. Positivo = egreso, negativo = ingreso.
  iva_inyeccion: number                       // 0 salvo mes de IVA
  capital_fin: number                         // capital_inicio + ahorro − (pie + div−arr) + iva + rentabilización
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

  // UI state
  cotizacion_activa_idx: number          // cuál cotización está enfocada
}

// ------------------------------------------------------------------
// 6. ENTIDADES PARA CARGA DESDE API / SUPABASE
// Objetos normalizados hacia DatosPropiedad. El mapeo desde filas de BD es
// PROVISIONAL (ver variables_calculo.md — capa datos vs motor); sustituir cuando
// exista el esquema definitivo multi-inmobiliaria / multi-proyecto.
// ------------------------------------------------------------------
export interface InmobiliariaSupabase {
  id: string
  codigo: string
  nombre: string
}

export interface ProyectoSupabase {
  id: string
  nombre: string
  comuna: string
  barrio: string
  direccion: string
  inmobiliaria?: string
  imagen_url?: string
  /** FK hacia catálogo inmobiliarias (string para coincidir con selects). */
  id_inmobiliaria?: string
  /** Copia del `estado` en BD si aplica (p. ej. para leyendas). */
  estado?: string
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
  precio_neto_uf: number
  bono_descuento_pct: number
  bono_max_pct: number
  bono_aplica_adicionales: boolean
  pie_pct: number
  estacionamiento_uf: number
  bodega_uf: number
  disponible: boolean
  /** Denormalizados en el stock maestro (Brekto). Si vienen, tienen precedencia sobre `ProyectoSupabase` al mapear a `DatosPropiedad`. */
  proyecto_nombre?: string
  comuna?: string
}

// ------------------------------------------------------------------
// 7. VALORES POR DEFECTO (para nuevas cotizaciones)
// ------------------------------------------------------------------
export const DEFAULT_HIPOTECARIO: DatosHipotecario = {
  hipotecario_tasa_anual: 0.034,         // 3.4%
  hipotecario_plazo_anos: 30,
  hipotecario_aprobacion_pct: 0.9,       // 90%
  hipotecario_seg_desgravamen_uf: 0.0157,
  hipotecario_seg_sismos_uf: 0.0082,
  hipotecario_tasa_seg_vida_pct: 0.000285,
}

export const DEFAULT_RENTABILIDAD: DatosRentabilidad = {
  tipo_renta: 'larga',
  plusvalia_anual_pct: 0.042,            // 4.2%
  plusvalia_anos: 5,
  arriendo_mensual_clp: 0,
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
  diversif_gastos_operacionales_clp: 2_000_000,
  diversif_amoblado_otros_clp: 1_000_000,
}
