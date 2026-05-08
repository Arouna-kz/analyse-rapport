import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, Trash2, Zap, CheckCircle2, XCircle, AlertCircle, Server, Globe, Cpu, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface ArenaProvider {
  id: string;
  name: string;
  provider_type: 'openai' | 'gemini' | 'ollama' | 'custom';
  base_url: string;
  model_name: string;
  has_api_key: boolean;
  api_key_masked: string | null;
  enabled: boolean;
  priority: number;
  role_description: string | null;
  last_test_status: 'success' | 'error' | 'untested' | null;
  last_test_at: string | null;
  last_test_message: string | null;
  last_test_latency_ms: number | null;
  created_at: string;
  updated_at: string;
}

const PROVIDER_TYPES = [
  { value: 'openai', label: 'OpenAI', icon: Cpu, defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'gemini', label: 'Google Gemini', icon: Globe, defaultUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-2.5-pro' },
  { value: 'ollama', label: 'Ollama (local/VPS)', icon: Server, defaultUrl: 'http://localhost:11434', defaultModel: 'llama3.1:8b' },
  { value: 'custom', label: 'Endpoint personnalisé', icon: Settings, defaultUrl: '', defaultModel: '' },
] as const;

interface FormState {
  id: string | null;
  name: string;
  provider_type: 'openai' | 'gemini' | 'ollama' | 'custom';
  base_url: string;
  model_name: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  role_description: string;
}

const emptyForm: FormState = {
  id: null,
  name: '',
  provider_type: 'openai',
  base_url: '',
  model_name: '',
  api_key: '',
  enabled: false,
  priority: 100,
  role_description: '',
};

export function ArenaProvidersManagement() {
  const [providers, setProviders] = useState<ArenaProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testingInline, setTestingInline] = useState(false);

  useEffect(() => { loadProviders(); }, []);

  const loadProviders = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_arena_providers');
    if (error) {
      toast.error('Erreur chargement fournisseurs : ' + error.message);
    } else {
      setProviders((data as ArenaProvider[]) || []);
    }
    setLoading(false);
  };

  const openNew = () => { setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (p: ArenaProvider) => {
    setForm({
      id: p.id,
      name: p.name,
      provider_type: p.provider_type,
      base_url: p.base_url,
      model_name: p.model_name,
      api_key: '', // ne pas pré-remplir, vide = ne pas modifier
      enabled: p.enabled,
      priority: p.priority,
      role_description: p.role_description || '',
    });
    setDialogOpen(true);
  };

  const handleProviderTypeChange = (type: FormState['provider_type']) => {
    const meta = PROVIDER_TYPES.find(t => t.value === type);
    setForm(f => ({
      ...f,
      provider_type: type,
      base_url: f.base_url || meta?.defaultUrl || '',
      model_name: f.model_name || meta?.defaultModel || '',
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Le nom est requis'); return; }
    if (!form.base_url.trim()) { toast.error("L'URL de base est requise"); return; }
    if (!form.model_name.trim()) { toast.error('Le nom du modèle est requis'); return; }
    if (!form.id && !form.api_key.trim() && form.provider_type !== 'ollama') {
      toast.error('La clé API est requise pour ce type de fournisseur'); return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc('admin_upsert_arena_provider', {
      _id: form.id,
      _name: form.name.trim(),
      _provider_type: form.provider_type,
      _base_url: form.base_url.trim(),
      _model_name: form.model_name.trim(),
      _api_key: form.api_key.trim() || null,
      _enabled: form.enabled,
      _priority: form.priority,
      _role_description: form.role_description.trim() || null,
    });

    if (error) {
      toast.error('Erreur sauvegarde : ' + error.message);
    } else {
      toast.success(form.id ? 'Fournisseur modifié' : 'Fournisseur créé');
      setDialogOpen(false);
      await loadProviders();
    }
    setSaving(false);
  };

  const handleTest = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const { data, error } = await supabase.functions.invoke('test-arena-provider', {
        body: { providerId },
      });
      if (error) throw error;
      if (data?.status === 'success') {
        toast.success(`✅ Test réussi (${data.latencyMs}ms)`);
      } else {
        toast.error(`❌ Échec : ${data?.message || 'Erreur inconnue'}`);
      }
      await loadProviders();
    } catch (e) {
      toast.error('Erreur de test : ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setTestingId(null);
    }
  };

  const handleTestInline = async () => {
    if (!form.base_url.trim() || !form.model_name.trim()) {
      toast.error('Renseignez URL et modèle avant de tester');
      return;
    }
    setTestingInline(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-arena-provider', {
        body: {
          inline: {
            provider_type: form.provider_type,
            base_url: form.base_url.trim(),
            model_name: form.model_name.trim(),
            api_key: form.api_key.trim() || undefined,
          }
        },
      });
      if (error) throw error;
      if (data?.status === 'success') {
        toast.success(`✅ Connexion réussie (${data.latencyMs}ms)`);
      } else {
        toast.error(`❌ ${data?.message || 'Échec'}`);
      }
    } catch (e) {
      toast.error('Erreur : ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setTestingInline(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.rpc('admin_delete_arena_provider', { _id: id });
    if (error) toast.error('Erreur suppression : ' + error.message);
    else { toast.success('Fournisseur supprimé'); await loadProviders(); }
  };

  const handleToggleEnabled = async (p: ArenaProvider, enabled: boolean) => {
    const { error } = await supabase.rpc('admin_upsert_arena_provider', {
      _id: p.id,
      _name: p.name,
      _provider_type: p.provider_type,
      _base_url: p.base_url,
      _model_name: p.model_name,
      _api_key: null,
      _enabled: enabled,
      _priority: p.priority,
      _role_description: p.role_description,
    });
    if (error) toast.error('Erreur : ' + error.message);
    else await loadProviders();
  };

  const renderTestBadge = (p: ArenaProvider) => {
    if (!p.last_test_status || p.last_test_status === 'untested') {
      return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Non testé</Badge>;
    }
    if (p.last_test_status === 'success') {
      return (
        <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" /> OK {p.last_test_latency_ms ? `(${p.last_test_latency_ms}ms)` : ''}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive">
        <XCircle className="h-3 w-3" /> Erreur
      </Badge>
    );
  };

  const enabledCount = providers.filter(p => p.enabled).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> Fournisseurs Arena
              </CardTitle>
              <CardDescription className="mt-1">
                Configurez plusieurs fournisseurs IA externes (OpenAI, Gemini, Ollama, endpoints custom).
                Tous les fournisseurs activés seront utilisés ensemble par le mode Arena pour le consensus multi-modèles.
              </CardDescription>
            </div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter un fournisseur
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{providers.length}</strong> fournisseur(s)</span>
            <span>•</span>
            <span><strong className="text-primary">{enabledCount}</strong> activé(s) pour Arena</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : providers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="mb-2">Aucun fournisseur configuré</p>
              <p className="text-xs">Cliquez sur « Ajouter un fournisseur » pour commencer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map(p => {
                const typeMeta = PROVIDER_TYPES.find(t => t.value === p.provider_type);
                const Icon = typeMeta?.icon || Settings;
                return (
                  <div key={p.id} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-md bg-muted shrink-0"><Icon className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{p.name}</h3>
                            <Badge variant="secondary" className="text-xs">{typeMeta?.label || p.provider_type}</Badge>
                            {renderTestBadge(p)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            <span className="font-mono">{p.model_name}</span> · {p.base_url}
                          </p>
                          {p.role_description && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{p.role_description}</p>
                          )}
                          {p.api_key_masked && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono">Clé : {p.api_key_masked}</p>
                          )}
                          {p.last_test_message && p.last_test_status === 'error' && (
                            <p className="text-xs text-destructive mt-1 line-clamp-2">{p.last_test_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2 mr-2">
                          <Label htmlFor={`enable-${p.id}`} className="text-xs">Activé</Label>
                          <Switch
                            id={`enable-${p.id}`}
                            checked={p.enabled}
                            onCheckedChange={(v) => handleToggleEnabled(p, v)}
                          />
                        </div>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => handleTest(p.id)}
                          disabled={testingId === p.id}
                          className="gap-1"
                        >
                          {testingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                          Tester
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                <strong>{p.name}</strong> sera définitivement supprimé. Le mode Arena ne l'utilisera plus.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur Arena'}</DialogTitle>
            <DialogDescription>
              Configurez un fournisseur IA externe à utiliser dans le mode Arena.
              {form.id && ' Laissez la clé API vide pour conserver l\'existante.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Nom du fournisseur *</Label>
                <Input
                  id="name" value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: OpenAI GPT-4o production"
                />
              </div>
              <div>
                <Label htmlFor="type">Type *</Label>
                <Select value={form.provider_type} onValueChange={(v) => handleProviderTypeChange(v as any)}>
                  <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="base_url">URL de base *</Label>
              <Input
                id="base_url" value={form.base_url}
                onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))}
                placeholder="https://api.example.com/v1"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le chemin <code>/chat/completions</code> sera ajouté automatiquement si absent.
              </p>
            </div>

            <div>
              <Label htmlFor="model_name">Nom du modèle *</Label>
              <Input
                id="model_name" value={form.model_name}
                onChange={(e) => setForm(f => ({ ...f, model_name: e.target.value }))}
                placeholder="ex: gpt-4o, gemini-2.5-pro, llama3.1:8b"
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="api_key">
                Clé API {form.provider_type === 'ollama' ? '(optionnel pour Ollama)' : '*'}
              </Label>
              <Input
                id="api_key" type="password" value={form.api_key}
                onChange={(e) => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder={form.id ? '••• Laisser vide pour ne pas modifier' : 'sk-...'}
                className="font-mono text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Stockée chiffrée côté serveur, jamais exposée au client.
              </p>
            </div>

            <div>
              <Label htmlFor="role_description">Rôle / description (optionnel)</Label>
              <Textarea
                id="role_description" value={form.role_description}
                onChange={(e) => setForm(f => ({ ...f, role_description: e.target.value }))}
                placeholder="ex: Modèle de raisonnement avancé pour la synthèse finale"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="priority">Priorité</Label>
                <Input
                  id="priority" type="number" value={form.priority}
                  onChange={(e) => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 100 }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Plus bas = plus prioritaire</p>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    id="enabled" checked={form.enabled}
                    onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))}
                  />
                  <Label htmlFor="enabled">Activer pour Arena</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline" onClick={handleTestInline}
              disabled={testingInline || saving} className="gap-2"
            >
              {testingInline ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Tester la connexion
            </Button>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {form.id ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
