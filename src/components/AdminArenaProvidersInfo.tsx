import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminProvider {
  id: string;
  name: string;
  provider_type: string;
  model_name: string;
  role_description: string | null;
  priority: number;
}

const providerLabel: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
  custom: 'Personnalisé',
};

const providerColor: Record<string, string> = {
  openai: 'bg-green-500/10 text-green-700 dark:text-green-300',
  gemini: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  ollama: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  custom: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

export const AdminArenaProvidersInfo = () => {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('public-arena-providers');
        if (!error && mounted) {
          setProviders((data as { providers: AdminProvider[] })?.providers || []);
        }
      } catch (e) {
        console.error('Failed to load admin providers:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des fournisseurs administrateur...
        </CardContent>
      </Card>
    );
  }

  if (providers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Fournisseurs configurés par l'administrateur
          </CardTitle>
          <CardDescription>
            Aucun fournisseur externe n'est actuellement activé par l'administrateur.
            Le consensus Arena utilisera uniquement les modèles Lovable AI et vos modèles personnels ci-dessous.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Fournisseurs activés par l'administrateur ({providers.length})
        </CardTitle>
        <CardDescription>
          Ces modèles sont configurés de manière centralisée et participeront automatiquement
          au consensus Arena (analyse, prédictions, génération de rapports). Vous ne pouvez pas
          les modifier ici.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {providers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background/60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-md bg-muted shrink-0">
                <Server className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <Badge variant="secondary" className={`text-xs ${providerColor[p.provider_type] || ''}`}>
                    {providerLabel[p.provider_type] || p.provider_type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{p.model_name}</p>
                {p.role_description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{p.role_description}</p>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">Actif</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AdminArenaProvidersInfo;
