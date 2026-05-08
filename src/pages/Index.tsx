import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Brain, Sparkles, TrendingUp, BarChart3, MessageSquare, ArrowRight, LogOut, LayoutDashboard, Book } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const features = [
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Analyse des rapports passés",
      description: "Extrayez automatiquement les insights clés et les KPIs de vos rapports historiques",
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: "Traitement en temps réel",
      description: "Uploadez et analysez vos documents PDF, DOCX ou TXT instantanément",
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Génération prédictive",
      description: "Créez des rapports futurs basés sur l'analyse de vos données historiques",
    },
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: "Chat IA intelligent",
      description: "Posez des questions sur vos rapports avec notre assistant conversationnel",
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: "RAG avancé",
      description: "Recherche sémantique et génération augmentée par récupération",
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: "Insights automatiques",
      description: "Identification automatique des tendances et recommandations",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header with theme toggle */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 bg-background/10 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-accent" />
            <span className="font-display font-bold text-lg text-white">Analyse IA</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/documentation">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Book className="h-4 w-4 mr-2" />
                Documentation
              </Button>
            </Link>
            <ThemeToggle />
            {!loading && user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="gradient-hero relative overflow-hidden min-h-[85vh] flex items-center">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px]"></div>
        
        <div className="container mx-auto px-4 py-24 pt-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
              <span className="text-sm font-medium text-white">Propulsé par l'IA de nouvelle génération</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-tight">
              Transformez vos rapports
              <br />
              avec l'<span className="bg-gradient-to-r from-accent to-cyan-300 bg-clip-text text-transparent">Intelligence Artificielle</span>
            </h1>
            
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Analysez le passé, comprenez le présent, anticipez le futur.
              Une plateforme complète pour la gestion intelligente de vos documents.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!loading && user ? (
                <>
                  <Button
                    size="lg"
                    onClick={() => navigate('/dashboard')}
                    className="text-lg px-8 py-6 bg-accent hover:bg-accent/90 text-accent-foreground shadow-glow transition-base"
                  >
                    <LayoutDashboard className="mr-2 h-5 w-5" />
                    Tableau de bord
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleLogout}
                    className="text-lg px-8 py-6 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-base"
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    Déconnexion
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={() => navigate('/auth')}
                    className="text-lg px-8 py-6 bg-accent hover:bg-accent/90 text-accent-foreground shadow-glow transition-base"
                  >
                    Commencer gratuitement
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate('/auth')}
                    className="text-lg px-8 py-6 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-base"
                  >
                    En savoir plus
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent"></div>
      </div>

      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-display font-bold mb-4">
            Fonctionnalités puissantes
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tout ce dont vous avez besoin pour une analyse complète et intelligente de vos rapports
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="transition-base hover:shadow-glow hover:-translate-y-1 group">
              <CardHeader>
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 w-fit mb-4 group-hover:bg-accent/20 transition-base">
                  <div className="text-accent">
                    {feature.icon}
                  </div>
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card mt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-accent" />
              <span className="font-display font-bold text-lg">Analyse IA</span>
            </div>
            <p className="text-muted-foreground text-sm text-center">
              © 2026 Plateforme d'Analyse IA par Save Tech. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
