# Cotizador BREKTO - Guía para Desarrollo

## 1) Requisitos

- Node.js 20.19+ (recomendado Node 22 LTS)
- pnpm 10+

Verifica versiones:

```bash
node -v
pnpm -v
```

Si `pnpm` no existe en tu entorno:

```bash
corepack enable
corepack pnpm -v
```

## 2) Instalar dependencias

Desde esta carpeta (`Planilla Cotizador Brekto`):

```bash
pnpm install
```

## 3) Configurar variables de entorno

1. Copia `.env.example` a `.env.local`
2. Completa valores reales de Supabase

```bash
cp .env.example .env.local
```

Variables requeridas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 4) Levantar entorno local

```bash
pnpm dev
```

Abre la URL que muestre Vite (normalmente `http://localhost:5173`).

## 5) Build de producción local

```bash
pnpm build
pnpm preview
```

## 6) Supabase y base de datos (alcance)

- La **base de datos actual** en Supabase es **provisional**: solo valida el flujo de carga y los cálculos con **una inmobiliaria y un proyecto**. **No** es el esquema de producción (multi-inmobiliaria, multi-proyecto, gran volumen de unidades).
- El **contrato de negocio** del cotizador está en `variables_calculo.md` y en `src/types/index.ts` + motores en `src/lib/engines/`. El stock y el mapeo a formulario viven en **`src/lib/stock/`** (`StockRepository`, repo de prueba, validación previa al motor). Cuando exista la BD definitiva, se añade o sustituye el repositorio; los hooks usan `createDefaultStockRepository()`.
- **Tabla de prueba** usada hoy: `Stock_Imagina_Prueba`. Columnas esperadas por el código: `id`, `depto`, `modelo`, `orientacion`, `precio`, `sup_int`, `sup_terr`, `sup_total`, `dcto`, `precio_dcto`, `bono5`, `bono10`. Si falta la tabla o cambia el esquema **de esta tabla de ejemplo**, falla solo la **carga desde Supabase**; la cotización **manual** sigue funcionando.

## 7) Comandos de validación recomendados

```bash
pnpm exec tsc -b --noEmit
pnpm build
```

## 8) Notas del proyecto

- El `package.json` funcional está en esta carpeta.
- El `package.json` de la carpeta raíz del workspace no levanta esta app.
- Se eliminaron credenciales de Supabase hardcodeadas en código fuente. Ahora el proyecto exige variables de entorno para evitar secretos embebidos.
- Este proyecto usa `pnpm-lock.yaml` como lockfile oficial.
