# Checklist antes de commit / push — Cotizador Brekto

Usar esta lista en cada cambio sustantivo o antes de publicar en `main`.

## Entorno

- [ ] Copia `.env.example` → `.env.local` y completa Supabase **solo** si vas a probar carga desde BD; sin `.env` la app debe arrancar en **cotización manual** (proyecto mock). La BD de ejemplo **no** es el esquema definitivo de producción (`variables_calculo.md` — prioridad motor vs capa datos).
- [ ] `pnpm install` (recomendado; el repo declara `packageManager: pnpm@10.33.0`). Si cambiaste `package.json`, vuelve a correr `pnpm install` y **commitea `pnpm-lock.yaml`** actualizado. Si `pnpm` falla por permisos en tu entorno, `npm install` es alternativa válida (puede generar `package-lock.json`; no mezclar ambos locks en el mismo PR sin consenso).

## Verificación automática

- [ ] `pnpm test` o `npm test` — todos los tests en verde.
- [ ] `pnpm run build` o `npm run build` — `tsc` + `vite build` sin errores.

## Verificación manual (localhost)

- [ ] `pnpm dev` / `npm run dev` → abrir `http://localhost:5173/`.
- [ ] **Cotización:** cargar o ingresar unidad, revisar precio de compra / tasación / escrituración.
- [ ] **Simulador:** crédito y barra pie vs LTV coherentes con valor escrituración.
- [ ] **Resumen / Flujo / PDF:** navegación sin errores en consola del navegador (F12).

## Documentación

- [ ] Si cambian fórmulas: actualizar `variables_calculo.md` primero, luego el código.

## Limpieza (cuando toque)

- [ ] Sin dependencias npm sin uso en `package.json`.
- [ ] Sin archivos `.ts` huérfanos no referenciados.
