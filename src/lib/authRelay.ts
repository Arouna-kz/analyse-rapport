import { supabase } from '@/integrations/supabase/client';

/**
 * Mode DIRECT : les liens d'auth pointent directement sur le domaine courant.
 * Plus de passage par un domaine relais. Chaque domaine de déploiement doit
 * être ajouté dans Backend → Auth Settings → URL Configuration → Redirect URLs
 * (ex. https://mon-domaine.com/**).
 *
 * RELAY_ORIGIN est conservé uniquement pour rétro-compatibilité de l'UI admin
 * (badge "Relais"). Il n'est plus utilisé pour construire les URLs.
 */
export const RELAY_ORIGIN = 'https://report-whisperer-41.lovable.app';

/**
 * Construit l'URL de redirection à passer à supabase.auth.resetPasswordForEmail
 * ou signUp. Toujours l'origine du domaine courant.
 */
export function buildAuthRedirectUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

/**
 * Validation STRICTE côté serveur via edge function — utilisée par le code
 * legacy si un ancien email avec ?return_to= arrive encore.
 */
export async function isOriginAllowed(origin: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-redirect-origin', {
      body: { origin },
    });
    if (error) return false;
    return !!(data && (data as { allowed?: boolean }).allowed);
  } catch {
    return false;
  }
}
