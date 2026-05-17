import { supabase } from '@/integrations/supabase/client';

/**
 * Origine du "relais" d'authentification : c'est l'URL Site configurée
 * côté backend (Supabase Auth). Tous les emails (reset password, confirmation)
 * pointent vers ce domaine. La page /reset-password de ce domaine relaie
 * ensuite vers le domaine d'origine de l'utilisateur (Vercel, custom domain...).
 */
export const RELAY_ORIGIN = 'https://report-whisperer-41.lovable.app';

/**
 * Construit l'URL de redirection à passer à supabase.auth.resetPasswordForEmail
 * ou signUp. Si on est déjà sur le relais, on cible directement /reset-password.
 * Sinon on passe par le relais avec un paramètre return_to.
 */
export function buildAuthRedirectUrl(path: string): string {
  const currentOrigin = window.location.origin;
  if (currentOrigin === RELAY_ORIGIN) {
    return `${RELAY_ORIGIN}${path}`;
  }
  const returnTo = encodeURIComponent(currentOrigin);
  return `${RELAY_ORIGIN}${path}?return_to=${returnTo}`;
}

/**
 * Validation STRICTE côté serveur via edge function.
 * Vérifie le format et la présence dans la whitelist en utilisant le service_role
 * (donc indépendant de la session utilisateur courante, qui peut ne pas exister
 * lors d'un flow de reset password).
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
