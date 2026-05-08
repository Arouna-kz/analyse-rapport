import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings2, Sparkles, Brain, Zap, Shield, Globe, Calculator, FileText,
  RotateCcw, Eye, EyeOff, Server, Key, Link2
} from 'lucide-react';
import { useArenaConfig } from '@/hooks/useArenaConfig';
import { AIModel, ModelProvider, PROVIDER_URLS } from '@/lib/arenaConfig';

const getModelIcon = (modelId: string) => {
  if (modelId.includes('gemini') || modelId.includes('gemma')) return <Sparkles className="h-4 w-4" />;
  if (modelId.includes('gpt')) return <Brain className="h-4 w-4" />;
  if (modelId.includes('deepseek')) return <Calculator className="h-4 w-4" />;
  if (modelId.includes('qwen')) return <Globe className="h-4 w-4" />;
  if (modelId.includes('mistral')) return <Zap className="h-4 w-4" />;
  if (modelId.includes('llama')) return <FileText className="h-4 w-4" />;
  return <Server className="h-4 w-4" />;
};

const getCapabilityColor = (cap: string) => {
  const colors: Record<string, string> = {
    'reasoning': 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
    'synthesis': 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
    'judge': 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    'analysis': 'bg-green-500/20 text-green-700 dark:text-green-300',
    'multilingual': 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
    'speed': 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
    'writing': 'bg-pink-500/20 text-pink-700 dark:text-pink-300',
    'precision': 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
    'verification': 'bg-red-500/20 text-red-700 dark:text-red-300',
    'math': 'bg-teal-500/20 text-teal-700 dark:text-teal-300',
    'logic': 'bg-slate-500/20 text-slate-700 dark:text-slate-300',
    'versatile': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  };
  return colors[cap] || 'bg-muted text-muted-foreground';
};

const getProviderLabel = (provider: ModelProvider) => {
  const labels: Record<ModelProvider, string> = {
    lovable: 'Lovable AI',
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    ollama: 'Ollama',
    custom: 'Personnalisé',
  };
  return labels[provider];
};

const getProviderColor = (provider: ModelProvider) => {
  const colors: Record<ModelProvider, string> = {
    lovable: 'bg-primary/10 text-primary',
    openai: 'bg-green-500/10 text-green-700 dark:text-green-300',
    gemini: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    ollama: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
    custom: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  };
  return colors[provider];
};

interface ArenaConfigPanelProps {
  onClose?: () => void;
  config?: ReturnType<typeof useArenaConfig>['config'];
  onUpdateModel?: (modelId: string, updates: Partial<AIModel>) => void;
  onToggleModel?: (modelId: string) => void;
  onToggleExpertMode?: () => void;
  onSetJudgeModel?: (modelId: string) => void;
  onResetDefaults?: () => void;
}

export const ArenaConfigPanel = ({ 
  onClose,
  config: externalConfig,
  onUpdateModel,
  onToggleModel,
  onToggleExpertMode,
  onSetJudgeModel,
  onResetDefaults
}: ArenaConfigPanelProps) => {
  const arenaHook = useArenaConfig();
  
  const config = externalConfig || arenaHook.config;
  const updateModel = onUpdateModel || arenaHook.updateModel;
  const toggleModel = onToggleModel || arenaHook.toggleModel;
  const toggleExpertMode = onToggleExpertMode || arenaHook.toggleExpertMode;
  const setJudgeModel = onSetJudgeModel || arenaHook.setJudgeModel;
  const getEnabledModels = arenaHook.getEnabledModels;
  const resetToDefaults = onResetDefaults || arenaHook.resetToDefaults;

  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  const enabledModels = getEnabledModels();
  const judgeCapableModels = config.models.filter(m => 
    m.capabilities.includes('judge') && (m.isLovableAI || m.baseUrl)
  );

  const lovableModels = config.models.filter(m => m.provider === 'lovable');
  const ollamaModels = config.models.filter(m => m.provider === 'ollama');
  const externalModels = config.models.filter(m => !['lovable', 'ollama'].includes(m.provider));

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Configuration Arena Multi-Modèles</CardTitle>
              <CardDescription>
                Configurez chaque modèle individuellement avec son propre fournisseur et endpoint
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Expert Mode Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            {config.showExpertMode ? (
              <Eye className="h-5 w-5 text-primary" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Mode Expert</p>
              <p className="text-sm text-muted-foreground">
                {config.showExpertMode 
                  ? 'Affiche les réponses individuelles de chaque modèle' 
                  : 'Affiche uniquement la Réponse Gold finale'}
              </p>
            </div>
          </div>
          <Switch 
            checked={config.showExpertMode} 
            onCheckedChange={toggleExpertMode}
          />
        </div>

        {/* Judge Model Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            Modèle Juge (Synthèse finale)
          </Label>
          <Select value={config.judgeModelId} onValueChange={setJudgeModel}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner le modèle juge" />
            </SelectTrigger>
            <SelectContent>
              {judgeCapableModels.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    {getModelIcon(model.id)}
                    <span>{model.name}</span>
                    <Badge variant="secondary" className={`text-xs ${getProviderColor(model.provider)}`}>
                      {getProviderLabel(model.provider)}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Models Summary */}
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-accent" />
            <span className="font-medium">
              {enabledModels.length} modèle{enabledModels.length > 1 ? 's' : ''} actif{enabledModels.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {enabledModels.map(model => (
              <Badge key={model.id} variant="outline" className="text-xs">
                {model.name}
                <span className={`ml-1 px-1 rounded text-[10px] ${getProviderColor(model.provider)}`}>
                  {getProviderLabel(model.provider)}
                </span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Models Configuration */}
        <Accordion type="multiple" className="space-y-2">
          {/* Lovable AI Models */}
          <AccordionItem value="lovable" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Modèles Lovable AI</p>
                  <p className="text-xs text-muted-foreground">Pré-configurés, prêts à l'emploi</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-3">
              {lovableModels.map(model => (
                <LovableModelCard key={model.id} model={model} onToggle={() => toggleModel(model.id)} />
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* Ollama Models */}
          <AccordionItem value="ollama" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Server className="h-4 w-4 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Modèles Ollama (Self-hosted)</p>
                  <p className="text-xs text-muted-foreground">
                    Modèles locaux avec diversité maximale pour le consensus
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              {ollamaModels.map(model => (
                <ExternalModelCard 
                  key={model.id} 
                  model={model}
                  onToggle={() => toggleModel(model.id)}
                  onUpdate={(updates) => updateModel(model.id, updates)}
                  showApiKey={showApiKeys[model.id]}
                  onToggleApiKey={() => setShowApiKeys(prev => ({ ...prev, [model.id]: !prev[model.id] }))}
                />
              ))}
              <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg space-y-1">
                <p className="font-medium">💡 Configuration Ollama</p>
                <p>1. Installez Ollama : <code className="bg-muted px-1 rounded">curl -fsSL https://ollama.ai/install.sh | sh</code></p>
                <p>2. Téléchargez les modèles : <code className="bg-muted px-1 rounded">ollama pull llama3.1:8b mistral:7b qwen2.5:7b</code></p>
                <p>3. Exposez l'API : <code className="bg-muted px-1 rounded">OLLAMA_HOST=0.0.0.0 ollama serve</code></p>
                <p>4. Entrez l'URL de votre serveur ci-dessus (ex: <code className="bg-muted px-1 rounded">http://your-server:11434/v1/chat/completions</code>)</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* External API Models */}
          <AccordionItem value="external" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Globe className="h-4 w-4 text-violet-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium">APIs Externes (OpenAI, Gemini, Custom)</p>
                  <p className="text-xs text-muted-foreground">
                    Accès direct aux APIs avec vos propres clés
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              {externalModels.map(model => (
                <ExternalModelCard 
                  key={model.id} 
                  model={model}
                  onToggle={() => toggleModel(model.id)}
                  onUpdate={(updates) => updateModel(model.id, updates)}
                  showApiKey={showApiKeys[model.id]}
                  onToggleApiKey={() => setShowApiKeys(prev => ({ ...prev, [model.id]: !prev[model.id] }))}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {onClose && (
          <Button onClick={onClose} className="w-full">
            Appliquer la configuration
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const LovableModelCard = ({ model, onToggle }: { model: AIModel; onToggle: () => void }) => (
  <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
    <div className="flex items-center gap-3">
      {getModelIcon(model.id)}
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{model.name}</p>
          {model.capabilities.includes('judge') && <Shield className="h-3 w-3 text-amber-500" />}
        </div>
        <p className="text-xs text-muted-foreground">{model.role}</p>
        {model.modelName && (
          <p className="text-[10px] text-muted-foreground/70 font-mono">{model.modelName}</p>
        )}
      </div>
    </div>
    <Switch checked={model.enabled} onCheckedChange={onToggle} />
  </div>
);

const ExternalModelCard = ({ 
  model, 
  onToggle, 
  onUpdate, 
  showApiKey, 
  onToggleApiKey 
}: { 
  model: AIModel; 
  onToggle: () => void; 
  onUpdate: (updates: Partial<AIModel>) => void;
  showApiKey?: boolean;
  onToggleApiKey: () => void;
}) => {
  const needsApiKey = model.provider !== 'ollama';
  const canEnable = model.baseUrl && (!needsApiKey || model.apiKey);

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getModelIcon(model.id)}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{model.name}</p>
              <Badge variant="secondary" className={`text-xs ${getProviderColor(model.provider)}`}>
                {getProviderLabel(model.provider)}
              </Badge>
              {model.capabilities.includes('judge') && <Shield className="h-3 w-3 text-amber-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{model.role}</p>
          </div>
        </div>
        <Switch 
          checked={model.enabled} 
          onCheckedChange={onToggle}
          disabled={!canEnable}
        />
      </div>
      
      {/* Base URL */}
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          URL de l'endpoint
        </Label>
        <Input
          placeholder={PROVIDER_URLS[model.provider] || 'https://your-server/v1/chat/completions'}
          value={model.baseUrl}
          onChange={(e) => onUpdate({ baseUrl: e.target.value })}
          className="text-sm font-mono"
        />
      </div>

      {/* Model Name */}
      <div className="space-y-1">
        <Label className="text-xs">Nom du modèle (envoyé à l'API)</Label>
        <Input
          placeholder="ex: llama3.1:8b, gpt-4o, gemini-2.5-pro"
          value={model.modelName || ''}
          onChange={(e) => onUpdate({ modelName: e.target.value })}
          className="text-sm font-mono"
        />
      </div>

      {/* API Key (not for Ollama) */}
      {needsApiKey && (
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Key className="h-3 w-3" />
            Clé API
          </Label>
          <div className="flex gap-2">
            <Input
              type={showApiKey ? 'text' : 'password'}
              placeholder="sk-..."
              value={model.apiKey || ''}
              onChange={(e) => onUpdate({ apiKey: e.target.value })}
              className="text-sm font-mono"
            />
            <Button variant="ghost" size="sm" onClick={onToggleApiKey}>
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1">
        {model.capabilities.map(cap => (
          <Badge key={cap} variant="secondary" className={`text-xs ${getCapabilityColor(cap)}`}>
            {cap}
          </Badge>
        ))}
      </div>

      {!canEnable && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ Configurez l'URL{needsApiKey ? ' et la clé API' : ''} pour activer ce modèle
        </p>
      )}
    </div>
  );
};

export default ArenaConfigPanel;
