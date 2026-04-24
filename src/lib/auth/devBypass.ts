/**
 * En `pnpm dev` (solo Vite en modo desarrollo), el gate SSO se omite por defecto
 * para trabajar en UI/lógica sin pasar por Brekto2 ni el JWT.
 *
 * Para probar el flujo real en local, crea `.env.local` con:
 *   VITE_DEV_BYPASS_AUTH=false
 *
 * `pnpm build` / Netlify: `import.meta.env.DEV` es siempre false.
 *
 * Preview deploys (revisión de stakeholders sin SSO): setear en Netlify
 *   VITE_PREVIEW_BYPASS_AUTH=true
 * ⚠️ Bandera temporal. En producción real NUNCA debe existir esta env var
 * (si no existe → vale `undefined` → no entra al `return true`). Para
 * apagar el bypass de preview: borrar la variable en el panel de Netlify
 * y redeploy.
 */
export function isDevAuthBypassEnabled(): boolean {
  if (import.meta.env.VITE_PREVIEW_BYPASS_AUTH === 'true') return true
  if (!import.meta.env.DEV) return false
  return import.meta.env.VITE_DEV_BYPASS_AUTH !== 'false'
}
