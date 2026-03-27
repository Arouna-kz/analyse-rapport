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
  Settings2, 
  Sparkles, 
  Brain, 
  Zap, 
  Shield, 
  Globe, 
  Calculator, 
  FileText,
  RotateCcw,
  Eye,
  EyeOff,
  Server
} from 'lucide-react';
import { useArenaConfig } from '@/hooks/useArenaConfig';
import { AIModel } from '@/lib/arenaConfig';

const getModelIcon = (modelId: string) => {
  if (modelId.includes('gemini')) return <Sparkles className="h-4 w-4" />;
  if (modelId.includes('gpt')) return <Brain className="h-4 w-4" />;
  if (modelId.includes('deepseek')) return <Calculator className="h-4 w-4" />;
  if (modelId.includes('qwen')) return <Globe className="h-4 w-4" />;
  if (modelId.includes('glm')) return <FileText className="h-4 w-4" />;
  if (modelId.includes('llama')) return <Zap className="h-4 w-4" />;
  return <Brain className="h-4 w-4" />;
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
    'rag': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  };
  return colors[cap] || 'bg-muted text-muted-foreground';
};

interface ArenaConfigPanelProps {
  onClose?: () => void;
  // Optional: allow passing config externally for standalone page usage
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
  
  // Use external config if provided, otherwise use hook
  const config = externalConfig || arenaHook.config;
  const updateModel = onUpdateModel || arenaHook.updateModel;
  const toggleModel = onToggleModel || arenaHook.toggleModel;
  const toggleExpertMode = onToggleExpertMode || arenaHook.toggleExpertMode;
  const setJudgeModel = onSetJudgeModel || arenaHook.setJudgeModel;
  const getEnabledModels = arenaHook.getEnabledModels;
  const resetToDefaults = onResetDefaults || arenaHook.resetToDefaults;

  const [editingApiKey, setEditingApiKey] = useState<string | null>(null);

  const enabledModels = getEnabledModels();
  const judgeCapableModels = config.models.filter(m => 
    m.capabilities.includes('judge') && (m.isLovableAI || m.baseUrl)
  );

  const handleBaseUrlChange = (modelId: string, baseUrl: string) => {
    updateModel(modelId, { baseUrl });
  };

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
                Orchestrez la compétition entre modèles IA pour des résultats optimaux
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
                  ? 'Affiche les réponses individuelles de chaque modèle avant la synthèse' 
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
                    {model.isLovableAI && (
                      <Badge variant="secondary" className="text-xs">Lovable AI</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Ce modèle analysera les réponses des autres pour produire la Réponse Gold
          </p>
        </div>

        {/* Active Models Summary */}
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-accent" />
            <span className="font-medium">Modèles actifs: {enabledModels.length}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {enabledModels.map(model => (
              <Badge key={model.id} variant="outline" className="text-xs">
                {model.name}
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
                  <p className="text-xs text-muted-foreground">
                    Pré-configurés, prêts à l'emploi
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-3">
              {config.models.filter(m => m.isLovableAI).map(model => (
                <ModelCard 
                  key={model.id} 
                  model={model}
                  onToggle={() => toggleModel(model.id)}
                />
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* External Models */}
          <AccordionItem value="external" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Server className="h-4 w-4 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Modèles Externes (vLLM/Ollama)</p>
                  <p className="text-xs text-muted-foreground">
                    Configurez vos propres endpoints OpenAI-compatibles
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              {config.models.filter(m => !m.isLovableAI).map(model => (
                <div key={model.id} className="space-y-3 p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getModelIcon(model.id)}
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">{model.role}</p>
                      </div>
                    </div>
                    <Switch 
                      checked={model.enabled} 
                      onCheckedChange={() => toggleModel(model.id)}
                      disabled={!model.baseUrl}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Base URL (endpoint compatible OpenAI)</Label>
                    <Input
                      placeholder="https://your-server.com/v1/chat/completions"
                      value={model.baseUrl}
                      onChange={(e) => handleBaseUrlChange(model.id, e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {model.capabilities.map(cap => (
                      <Badge 
                        key={cap} 
                        variant="secondary" 
                        className={`text-xs ${getCapabilityColor(cap)}`}
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              
              <p className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                💡 Les modèles externes doivent exposer un endpoint compatible avec l'API OpenAI 
                (POST /v1/chat/completions). Hébergez-les sur des serveurs cloud accessibles 
                (AWS, Azure, RunPod, etc.) pour permettre la connexion depuis Lovable Cloud.
              </p>
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

const ModelCard = ({ model, onToggle }: { model: AIModel; onToggle: () => void }) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
      <div className="flex items-center gap-3">
        {getModelIcon(model.id)}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{model.name}</p>
            {model.capabilities.includes('judge') && (
              <Shield className="h-3 w-3 text-amber-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{model.role}</p>
        </div>
      </div>
      <Switch checked={model.enabled} onCheckedChange={onToggle} />
    </div>
  );
};

export default ArenaConfigPanel;
