import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, Save, Eye, EyeOff, Loader2, AlertTriangle, Activity, BarChart3, Clock, Zap, AlertCircle, CheckCircle2, TrendingUp, Download, FileText, Bell, Settings2, DollarSign, Mail, SendHorizonal } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AIConfigRow {
  id: string;
  config_key: string;
  config_value: string;
  description: string | null;
  updated_at: string;
}

interface UsageLog {
  id: string;
  function_name: string;
  provider: string;
  model: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

const SENSITIVE_KEYS = ['OPENAI_API_KEY', 'GOOGLE_AI_API_KEY', 'CUSTOM_AI_API_KEY'];

const PROVIDER_OPTIONS = [
  { value: 'lovable', label: 'Lovable AI Gateway', description: 'Par défaut — utilise le gateway Lovable' },
  { value: 'openai', label: 'OpenAI Direct', description: 'Clé API OpenAI requise' },
  { value: 'gemini', label: 'Google Gemini', description: 'Clé API Google AI requise' },
  { value: 'ollama', label: 'Ollama (local)', description: 'Serveur Ollama local requis' },
  { value: 'custom', label: 'Custom Endpoint', description: 'Endpoint OpenAI-compatible' },
];

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(40, 80%, 55%)',
  'hsl(0, 65%, 55%)',
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [configs, setConfigs] = useState<AIConfigRow[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPeriod, setLogsPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [errorThreshold, setErrorThreshold] = useState<number>(10);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [emailAlertSending, setEmailAlertSending] = useState(false);
  const [lastEmailSentAt, setLastEmailSentAt] = useState<number | null>(null);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsageLogs();
  }, [isAdmin, logsPeriod]);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Authentification requise');
      navigate('/auth');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin']);

    if (!roles || roles.length === 0) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from('ai_config')
      .select('*')
      .order('config_key');

    if (error) {
      toast.error('Erreur lors du chargement de la configuration');
    } else {
      setConfigs(data || []);
      const initial: Record<string, string> = {};
      (data || []).forEach((c: AIConfigRow) => { initial[c.config_key] = c.config_value; });
      setEditedValues(initial);
    }
    setLoading(false);
  };

  const fetchUsageLogs = async () => {
    setLogsLoading(true);
    const now = new Date();
    const since = new Date();
    if (logsPeriod === '24h') since.setHours(now.getHours() - 24);
    else if (logsPeriod === '7d') since.setDate(now.getDate() - 7);
    else since.setDate(now.getDate() - 30);

    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!error) setUsageLogs((data as UsageLog[]) || []);
    setLogsLoading(false);
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Fonction', 'Fournisseur', 'Modèle', 'Statut', 'Latence (ms)', 'Tokens entrée', 'Tokens sortie', 'Tokens total', 'Erreur'];
    const rows = usageLogs.map(l => [
      new Date(l.created_at).toLocaleString('fr-FR'),
      l.function_name, l.provider, l.model, l.status,
      l.latency_ms ?? '', l.input_tokens ?? '', l.output_tokens ?? '', l.total_tokens ?? '',
      l.error_message ?? ''
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ai-logs-${logsPeriod}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Rapport de monitoring IA', 14, 20);
    doc.setFontSize(10);
    doc.text(`Période : ${logsPeriod} | Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 28);
    doc.text(`Total: ${totalCalls} appels | Succès: ${successCalls} | Erreurs: ${errorCalls} | Latence moy: ${avgLatency}ms | Tokens: ${totalTokens}`, 14, 35);

    autoTable(doc, {
      startY: 42,
      head: [['Date', 'Fonction', 'Fournisseur', 'Modèle', 'Statut', 'Latence', 'Tokens']],
      body: usageLogs.slice(0, 200).map(l => [
        new Date(l.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        l.function_name, l.provider, l.model, l.status,
        l.latency_ms ? `${l.latency_ms}ms` : '—',
        l.total_tokens ?? '—'
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`ai-logs-${logsPeriod}-${Date.now()}.pdf`);
    toast.success('Export PDF téléchargé');
  };

  // Alert check moved after stats computation below

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updates = configs.map(c =>
        supabase
          .from('ai_config')
          .update({
            config_value: editedValues[c.config_key] ?? c.config_value,
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          })
          .eq('config_key', c.config_key)
      );
      await Promise.all(updates);
      toast.success('Configuration IA sauvegardée avec succès');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    }
    setSaving(false);
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const currentProvider = editedValues['AI_PROVIDER'] || 'lovable';

  const isFieldRelevant = (key: string): boolean => {
    if (key === 'AI_PROVIDER') return true;
    if (currentProvider === 'openai' && key === 'OPENAI_API_KEY') return true;
    if (currentProvider === 'gemini' && key === 'GOOGLE_AI_API_KEY') return true;
    if (currentProvider === 'ollama' && (key === 'OLLAMA_BASE_URL' || key === 'OLLAMA_MODEL')) return true;
    if (currentProvider === 'custom' && key.startsWith('CUSTOM_AI_')) return true;
    return false;
  };

  // --- Stats computation ---
  const totalCalls = usageLogs.length;
  const successCalls = usageLogs.filter(l => l.status === 'success').length;
  const errorCalls = usageLogs.filter(l => l.status === 'error').length;
  const avgLatency = totalCalls > 0
    ? Math.round(usageLogs.reduce((s, l) => s + (l.latency_ms || 0), 0) / totalCalls)
    : 0;
  const totalTokens = usageLogs.reduce((s, l) => s + (l.total_tokens || 0), 0);

  // Calls per function
  const callsByFunction = usageLogs.reduce<Record<string, number>>((acc, l) => {
    acc[l.function_name] = (acc[l.function_name] || 0) + 1;
    return acc;
  }, {});
  const functionChartData = Object.entries(callsByFunction)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, count }));

  // Calls per provider
  const callsByProvider = usageLogs.reduce<Record<string, number>>((acc, l) => {
    acc[l.provider] = (acc[l.provider] || 0) + 1;
    return acc;
  }, {});
  const providerPieData = Object.entries(callsByProvider).map(([name, value]) => ({ name, value }));

  // Calls per model
  const callsByModel = usageLogs.reduce<Record<string, number>>((acc, l) => {
    acc[l.model] = (acc[l.model] || 0) + 1;
    return acc;
  }, {});
  const modelChartData = Object.entries(callsByModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name: name.length > 25 ? name.slice(0, 22) + '…' : name, count }));

  // --- Cost estimation per model ---
  const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
    'google/gemini-2.5-pro': { input: 0.00125, output: 0.005 },
    'google/gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
    'google/gemini-2.5-flash-lite': { input: 0.000025, output: 0.0001 },
    'openai/gpt-5': { input: 0.005, output: 0.015 },
    'openai/gpt-5-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  };
  const defaultCost = { input: 0.001, output: 0.003 };

  const costByModel = usageLogs.reduce<Record<string, number>>((acc, l) => {
    const rates = MODEL_COST_PER_1K[l.model] || defaultCost;
    const cost = ((l.input_tokens || 0) / 1000) * rates.input + ((l.output_tokens || 0) / 1000) * rates.output;
    acc[l.model] = (acc[l.model] || 0) + cost;
    return acc;
  }, {});
  const totalEstimatedCost = Object.values(costByModel).reduce((s, c) => s + c, 0);
  const costChartData = Object.entries(costByModel)
    .sort((a, b) => b[1] - a[1])
    .map(([name, cost]) => ({ name: name.length > 25 ? name.slice(0, 22) + '…' : name, cost: Number(cost.toFixed(4)) }));

  // Cost timeline
  const costTimelineData = (() => {
    const bucket: Record<string, number> = {};
    const isHourly = logsPeriod === '24h';
    usageLogs.forEach(l => {
      const d = new Date(l.created_at);
      const key = isHourly
        ? `${d.getHours().toString().padStart(2, '0')}h`
        : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      const rates = MODEL_COST_PER_1K[l.model] || defaultCost;
      const cost = ((l.input_tokens || 0) / 1000) * rates.input + ((l.output_tokens || 0) / 1000) * rates.output;
      bucket[key] = (bucket[key] || 0) + cost;
    });
    return Object.entries(bucket)
      .map(([time, cost]) => ({ time, cost: Number(cost.toFixed(4)) }))
      .sort((a, b) => a.time.localeCompare(b.time));
  })();

  // Timeline data (calls per day/hour)
  const timelineData = (() => {
    const bucket: Record<string, { success: number; error: number }> = {};
    const isHourly = logsPeriod === '24h';
    usageLogs.forEach(l => {
      const d = new Date(l.created_at);
      const key = isHourly
        ? `${d.getHours().toString().padStart(2, '0')}h`
        : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!bucket[key]) bucket[key] = { success: 0, error: 0 };
      if (l.status === 'success') bucket[key].success++;
      else bucket[key].error++;
    });
    return Object.entries(bucket)
      .map(([time, v]) => ({ time, ...v }))
      .sort((a, b) => a.time.localeCompare(b.time));
  })();

  const errorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0;

  // Check error rate alert
  useEffect(() => {
    if (!alertEnabled || totalCalls === 0) { setAlertTriggered(false); return; }
    if (errorRate >= errorThreshold) {
      setAlertTriggered(true);
    } else {
      setAlertTriggered(false);
    }
  }, [errorRate, errorThreshold, alertEnabled, totalCalls]);

  const sendEmailAlert = async () => {
    setEmailAlertSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-error-alert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorRate,
          threshold: errorThreshold,
          period: logsPeriod,
          totalCalls,
          errorCalls,
        }),
      });
      if (res.ok) {
        toast.success('Notification email envoyée avec succès');
        setLastEmailSentAt(Date.now());
      } else {
        const err = await res.json();
        toast.error(err.error || 'Échec de l\'envoi');
      }
    } catch {
      toast.error('Erreur lors de l\'envoi de la notification');
    }
    setEmailAlertSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Cette page est réservée aux administrateurs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour au tableau de bord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">Administration</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue="monitoring" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="h-4 w-4" /> Monitoring IA
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Shield className="h-4 w-4" /> Configuration
            </TabsTrigger>
          </TabsList>

          {/* MONITORING TAB */}
          <TabsContent value="monitoring" className="space-y-6">
            {/* Alert Banner */}
            {alertTriggered && (
              <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
                <Bell className="h-5 w-5 text-destructive animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">⚠️ Alerte : taux d'erreur élevé</p>
                  <p className="text-xs text-muted-foreground">
                    Le taux d'erreur IA est de {errorRate.toFixed(1)}% (seuil : {errorThreshold}%) sur la période {logsPeriod}.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={sendEmailAlert}
                  disabled={emailAlertSending || (lastEmailSentAt !== null && Date.now() - lastEmailSentAt < 300000)}
                >
                  {emailAlertSending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                  {lastEmailSentAt && Date.now() - lastEmailSentAt < 300000 ? 'Envoyé' : 'Notifier par email'}
                </Button>
              </div>
            )}

            {/* Period selector + Export + Alert config */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Période :</span>
              {(['24h', '7d', '30d'] as const).map(p => (
                <Button
                  key={p}
                  variant={logsPeriod === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogsPeriod(p)}
                >
                  {p === '24h' ? '24 heures' : p === '7d' ? '7 jours' : '30 jours'}
                </Button>
              ))}
              {logsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}

              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={usageLogs.length === 0}>
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} disabled={usageLogs.length === 0}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                </Button>
              </div>
            </div>

            {/* Alert Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Alertes automatiques
                </CardTitle>
                <CardDescription>Recevez une alerte quand le taux d'erreur IA dépasse un seuil</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="alert-toggle" className="text-sm">Activé</Label>
                    <input
                      id="alert-toggle"
                      type="checkbox"
                      checked={alertEnabled}
                      onChange={e => setAlertEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="threshold" className="text-sm whitespace-nowrap">Seuil d'erreur (%)</Label>
                    <Input
                      id="threshold"
                      type="number"
                      min={1}
                      max={100}
                      value={errorThreshold}
                      onChange={e => setErrorThreshold(Number(e.target.value))}
                      className="w-20 h-8 text-sm"
                      disabled={!alertEnabled}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Taux actuel : <span className={errorRate >= errorThreshold ? 'text-destructive font-semibold' : 'text-foreground'}>{errorRate.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <BarChart3 className="h-3.5 w-3.5" /> Total appels
                  </div>
                  <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs mb-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Succès
                  </div>
                  <p className="text-2xl font-bold text-foreground">{successCalls}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs mb-1 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> Erreurs
                  </div>
                  <p className="text-2xl font-bold text-foreground">{errorCalls}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Clock className="h-3.5 w-3.5" /> Latence moy.
                  </div>
                  <p className="text-2xl font-bold text-foreground">{avgLatency}<span className="text-sm font-normal text-muted-foreground">ms</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Zap className="h-3.5 w-3.5" /> Tokens
                  </div>
                  <p className="text-2xl font-bold text-foreground">{totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <DollarSign className="h-3.5 w-3.5" /> Coût estimé
                  </div>
                  <p className="text-2xl font-bold text-foreground">${totalEstimatedCost.toFixed(4)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1: Timeline + Provider Pie */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Appels dans le temps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="success" name="Succès" fill="hsl(150, 60%, 45%)" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="error" name="Erreurs" fill="hsl(0, 65%, 55%)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée pour cette période</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Par fournisseur</CardTitle>
                </CardHeader>
                <CardContent>
                  {providerPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={providerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {providerPieData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2: By function + By model */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Par fonction</CardTitle>
                </CardHeader>
                <CardContent>
                  {functionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={functionChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Appels" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Par modèle</CardTitle>
                </CardHeader>
                <CardContent>
                  {modelChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={modelChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Appels" fill="hsl(210, 70%, 55%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cost Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Coût estimé par modèle
                  </CardTitle>
                  <CardDescription>Estimation basée sur les tarifs publics par token</CardDescription>
                </CardHeader>
                <CardContent>
                  {costChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={costChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, 'Coût']} />
                        <Bar dataKey="cost" name="Coût ($)" fill="hsl(40, 80%, 55%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Évolution des coûts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {costTimelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={costTimelineData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                        <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, 'Coût']} />
                        <Area type="monotone" dataKey="cost" name="Coût ($)" stroke="hsl(40, 80%, 55%)" fill="hsl(40, 80%, 55%)" fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Logs Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Logs récents</CardTitle>
                <CardDescription>Les 50 derniers appels IA</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Fonction</th>
                        <th className="py-2 pr-3">Fournisseur</th>
                        <th className="py-2 pr-3">Modèle</th>
                        <th className="py-2 pr-3">Statut</th>
                        <th className="py-2 pr-3">Latence</th>
                        <th className="py-2">Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageLogs.slice(0, 50).map(log => (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs max-w-[150px] truncate">{log.function_name}</td>
                          <td className="py-2 pr-3">
                            <Badge variant="secondary" className="text-xs">{log.provider}</Badge>
                          </td>
                          <td className="py-2 pr-3 text-xs max-w-[150px] truncate">{log.model}</td>
                          <td className="py-2 pr-3">
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                              {log.status}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-xs tabular-nums">{log.latency_ms ? `${log.latency_ms}ms` : '—'}</td>
                          <td className="py-2 text-xs tabular-nums">{log.total_tokens ?? '—'}</td>
                        </tr>
                      ))}
                      {usageLogs.length === 0 && (
                        <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucun log pour cette période</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONFIG TAB */}
          <TabsContent value="config" className="space-y-6 max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Fournisseur IA</CardTitle>
                <CardDescription>
                  Sélectionnez le fournisseur d'IA. Les modifications sont appliquées sans redéploiement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="provider">Fournisseur actif</Label>
                <Select
                  value={currentProvider}
                  onValueChange={(v) => setEditedValues(prev => ({ ...prev, AI_PROVIDER: v }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-muted-foreground text-xs ml-2">— {opt.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Configuration du fournisseur</CardTitle>
                <CardDescription>
                  Champs pour « {PROVIDER_OPTIONS.find(p => p.value === currentProvider)?.label} »
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {configs
                  .filter(c => c.config_key !== 'AI_PROVIDER' && isFieldRelevant(c.config_key))
                  .map(c => {
                    const isSensitive = SENSITIVE_KEYS.includes(c.config_key);
                    const isVisible = visibleKeys.has(c.config_key);
                    return (
                      <div key={c.config_key} className="space-y-1.5">
                        <Label htmlFor={c.config_key} className="text-sm font-medium">{c.config_key}</Label>
                        {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                        <div className="flex gap-2">
                          <Input
                            id={c.config_key}
                            type={isSensitive && !isVisible ? 'password' : 'text'}
                            value={editedValues[c.config_key] ?? ''}
                            onChange={(e) => setEditedValues(prev => ({ ...prev, [c.config_key]: e.target.value }))}
                            placeholder={c.description || ''}
                            className="font-mono text-sm"
                          />
                          {isSensitive && (
                            <Button variant="ghost" size="icon" onClick={() => toggleVisibility(c.config_key)}>
                              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {configs.filter(c => c.config_key !== 'AI_PROVIDER' && isFieldRelevant(c.config_key)).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Aucune configuration supplémentaire requise.</p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="lg">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sauvegarder la configuration
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
