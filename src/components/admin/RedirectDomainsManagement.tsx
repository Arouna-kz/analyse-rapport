import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Globe, Copy } from 'lucide-react';
import { RELAY_ORIGIN } from '@/lib/authRelay';

interface DomainRow {
  id: string;
  origin: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export const RedirectDomainsManagement = () => {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrigin, setNewOrigin] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchDomains = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('allowed_redirect_domains')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erreur lors du chargement des domaines');
    else setDomains((data as DomainRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDomains(); }, []);

  const normalizeOrigin = (raw: string): string | null => {
    try {
      const url = new URL(raw.trim());
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  };

  const handleAdd = async () => {
    const normalized = normalizeOrigin(newOrigin);
    if (!normalized) {
      toast.error('URL invalide. Exemple : https://mon-site.com');
      return;
    }
    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('allowed_redirect_domains')
      .insert({ origin: normalized, description: newDescription || null, created_by: user?.id });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Ce domaine existe déjà' : 'Erreur lors de l\'ajout');
    } else {
      toast.success('Domaine ajouté');
      setNewOrigin('');
      setNewDescription('');
      fetchDomains();
    }
    setAdding(false);
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from('allowed_redirect_domains')
      .update({ is_active })
      .eq('id', id);
    if (error) toast.error('Erreur lors de la mise à jour');
    else { toast.success(is_active ? 'Domaine activé' : 'Domaine désactivé'); fetchDomains(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce domaine ?')) return;
    const { error } = await supabase
      .from('allowed_redirect_domains')
      .delete()
      .eq('id', id);
    if (error) toast.error('Erreur lors de la suppression');
    else { toast.success('Domaine supprimé'); fetchDomains(); }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Comment ça marche
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Les emails d'authentification (reset password, confirmation) pointent toujours vers le
            <strong className="text-foreground"> domaine relais</strong> configuré côté backend :
          </p>
          <div className="flex items-center gap-2 p-2 rounded bg-background border font-mono text-xs">
            <span className="flex-1 truncate">{RELAY_ORIGIN}</span>
            <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(RELAY_ORIGIN); toast.success('Copié'); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p>
            Lorsque l'utilisateur clique sur le lien depuis un autre domaine (Vercel, domaine personnalisé...),
            la page <code>/reset-password</code> du relais vérifie que son domaine d'origine est dans la liste
            ci-dessous, puis le redirige automatiquement avec le token de session.
          </p>
          <p className="text-xs">
            Ajoutez ici chaque domaine où vous déployez l'application.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un domaine autorisé</CardTitle>
          <CardDescription>L'URL doit être complète (incluant https://)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>URL d'origine</Label>
              <Input
                placeholder="https://mon-app.vercel.app"
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="space-y-1">
              <Label>Description (optionnel)</Label>
              <Input
                placeholder="Production Vercel"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={adding}
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={adding || !newOrigin}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domaines configurés ({domains.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun domaine configuré</p>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm truncate">{d.origin}</span>
                      {d.origin === RELAY_ORIGIN && <Badge variant="secondary" className="text-xs">Relais</Badge>}
                    </div>
                    {d.description && <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.is_active} onCheckedChange={(v) => handleToggle(d.id, v)} />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(d.id)}
                      disabled={d.origin === RELAY_ORIGIN}
                      title={d.origin === RELAY_ORIGIN ? 'Le domaine relais ne peut pas être supprimé' : 'Supprimer'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
