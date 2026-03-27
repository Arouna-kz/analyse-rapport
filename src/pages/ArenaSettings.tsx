import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Settings2, Cpu, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ArenaConfigPanel } from '@/components/ArenaConfigPanel';
import { useArenaConfig } from '@/hooks/useArenaConfig';

const ArenaSettings = () => {
  const navigate = useNavigate();
  const { 
    config, 
    isLoaded, 
    updateModel, 
    toggleModel, 
    toggleExpertMode, 
    setJudgeModel, 
    resetToDefaults 
  } = useArenaConfig();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                <Cpu className="h-5 w-5 text-white" />
              </div>
              <span className="font-display font-bold">Paramètres Arena</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                Configuration Multi-Modèles Arena
              </h1>
              <p className="text-muted-foreground">
                Configurez les modèles IA pour le consensus multi-modèles et l'optimisation
              </p>
            </div>
          </div>
        </div>

        {/* Description Card */}
        <Card className="mb-8 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-purple-500" />
              Fonctionnement de l'Arena
            </CardTitle>
            <CardDescription>
              Le système Arena envoie vos requêtes à plusieurs modèles IA simultanément, puis un modèle "Juge" 
              synthétise les réponses pour produire une "Réponse Gold" optimale, éliminant les hallucinations 
              et combinant les meilleures idées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-background/50 border">
                <div className="text-lg font-bold text-purple-500 mb-1">1. Parallélisation</div>
                <p className="text-sm text-muted-foreground">
                  Requête envoyée simultanément à tous les modèles activés
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border">
                <div className="text-lg font-bold text-pink-500 mb-1">2. Agrégation</div>
                <p className="text-sm text-muted-foreground">
                  Collecte des réponses avec scores de confiance
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border">
                <div className="text-lg font-bold text-accent mb-1">3. Synthèse</div>
                <p className="text-sm text-muted-foreground">
                  Le modèle Juge produit la Réponse Gold finale
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Arena Config Panel */}
        <ArenaConfigPanel
          config={config}
          onUpdateModel={updateModel}
          onToggleModel={toggleModel}
          onToggleExpertMode={toggleExpertMode}
          onSetJudgeModel={setJudgeModel}
          onResetDefaults={resetToDefaults}
        />
      </main>
    </div>
  );
};

export default ArenaSettings;
