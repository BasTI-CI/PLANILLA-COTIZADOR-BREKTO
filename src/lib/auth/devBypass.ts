/**
 * En `pnpm dev` (solo Vite en modo desarrollo), el gate SSO se omite por defecto
 * para trabajar en UI/lógica sin pasar por Brekto2 ni el JWT.
 *
 * Para probar el flujo real en local, crea `.env.local` con:
 *   VITE_DEV_BYPASS_AUTH=false
 *
 * `pnpm build` / Netlify: `import.meta.env.DEV` es siempre false → nunca se omite la autenticación.
 */
export function isDevAuthBypassEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  return import.meta.env.VITE_DEV_BYPASS_AUTH !== 'false'
}
