import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft,
  Book,
  Upload,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Bell,
  Share2,
  Settings,
  HelpCircle,
  FileText,
  Users,
  Shield,
  Zap,
} from "lucide-react";

const Documentation = () => {
  const [activeSection, setActiveSection] = useState("introduction");

  const sections = [
    { id: "introduction", label: "Introduction", icon: Book },
    { id: "premiers-pas", label: "Premiers pas", icon: Users },
    { id: "tableau-de-bord", label: "Tableau de bord", icon: BarChart3 },
    { id: "upload", label: "Upload de rapports", icon: Upload },
    { id: "generation", label: "Génération IA", icon: Zap },
    { id: "analyse", label: "Analyse des rapports", icon: FileText },
    { id: "chat", label: "Chat IA", icon: MessageSquare },
    { id: "predictions", label: "Prédictions", icon: TrendingUp },
    { id: "alertes", label: "Alertes", icon: Bell },
    { id: "arena", label: "Arena Multi-Modèles", icon: Shield },
    { id: "partage", label: "Partage et export", icon: Share2 },
    { id: "parametres", label: "Paramètres", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Book className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Guide Utilisateur</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <Card className="lg:col-span-1 h-fit lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <section.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card className="lg:col-span-3">
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <CardContent className="p-6 prose prose-slate dark:prose-invert max-w-none">
                {activeSection === "introduction" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Book className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Introduction</h2>
                        <p className="text-muted-foreground m-0">Bienvenue sur la Plateforme d'Analyse IA</p>
                      </div>
                    </div>
                    
                    <p className="text-foreground">
                      Cette application vous permet d'analyser vos rapports avec l'intelligence artificielle, 
                      de générer des prédictions et d'obtenir des insights automatiques.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground m-0">Analyse automatique</h4>
                        </div>
                        <p className="text-sm text-muted-foreground m-0">Extrayez les KPIs et insights de vos documents</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground m-0">Chat IA</h4>
                        </div>
                        <p className="text-sm text-muted-foreground m-0">Posez des questions sur vos rapports avec fichiers joints</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground m-0">Prédictions</h4>
                        </div>
                        <p className="text-sm text-muted-foreground m-0">Générez des scénarios optimistes, réalistes et pessimistes</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground m-0">Arena Multi-Modèles</h4>
                        </div>
                        <p className="text-sm text-muted-foreground m-0">Consensus multi-IA pour des réponses fiables</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Share2 className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground m-0">Export</h4>
                        </div>
                        <p className="text-sm text-muted-foreground m-0">Téléchargez vos analyses en Excel ou PDF</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "premiers-pas" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Premiers pas</h2>
                        <p className="text-muted-foreground m-0">Créez votre compte et commencez</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Création de compte</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Accédez à la page d'accueil</li>
                        <li>Cliquez sur "Commencer gratuitement"</li>
                        <li>Remplissez le formulaire d'inscription avec votre email et mot de passe</li>
                        <li>Validez votre compte (si la confirmation email est activée)</li>
                      </ol>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Connexion</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Cliquez sur "Se connecter"</li>
                        <li>Entrez vos identifiants</li>
                        <li>Vous serez redirigé vers le tableau de bord</li>
                      </ol>
                    </div>
                  </div>
                )}

                {activeSection === "tableau-de-bord" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <BarChart3 className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Tableau de bord</h2>
                        <p className="text-muted-foreground m-0">Votre centre de contrôle</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Vue d'ensemble</h3>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li><strong>Nombre total de rapports</strong> : Compteur de tous vos documents</li>
                        <li><strong>Analyses complétées</strong> : Nombre d'analyses terminées</li>
                        <li><strong>Alertes actives</strong> : Notifications nécessitant votre attention</li>
                      </ul>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Actions rapides</h3>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li><strong>Nouveau rapport</strong> : Uploader un nouveau document</li>
                        <li><strong>Générer prédiction</strong> : Créer des scénarios prédictifs</li>
                        <li><strong>Chat IA</strong> : Démarrer une conversation avec l'assistant</li>
                        <li><strong>Voir les alertes</strong> : Consulter les notifications</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeSection === "upload" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Upload de rapports</h2>
                        <p className="text-muted-foreground m-0">Importez vos documents pour analyse</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Formats supportés</h3>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">PDF</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">DOCX</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">TXT</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">XLSX</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">XLS</span>
                      </div>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Comment uploader</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Cliquez sur "Nouveau rapport" dans le tableau de bord</li>
                        <li>Cliquez sur la zone d'upload ou glissez-déposez votre fichier</li>
                        <li>Donnez un titre à votre rapport</li>
                        <li>Sélectionnez le type de rapport (Passé, Présent, Futur)</li>
                        <li>Cliquez sur "Uploader et analyser"</li>
                      </ol>

                      <div className="p-4 bg-muted/50 rounded-lg border border-border mt-4">
                        <h4 className="font-semibold text-foreground mb-2">États du traitement</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• <strong>En attente</strong> : Le fichier est en file d'attente</li>
                          <li>• <strong>En cours</strong> : L'IA analyse votre document</li>
                          <li>• <strong>Terminé</strong> : L'analyse est disponible</li>
                          <li>• <strong>Erreur</strong> : Un problème est survenu</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "generation" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Zap className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Génération de rapports IA</h2>
                        <p className="text-muted-foreground m-0">Créez des rapports professionnels automatiquement</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Étapes de génération</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Accédez à "Générer Rapport" depuis le tableau de bord</li>
                        <li>Uploadez votre fichier de données (PDF, DOCX, TXT, CSV, Excel)</li>
                        <li>Choisissez la source du modèle de rédaction</li>
                        <li>Donnez un titre au rapport</li>
                        <li>Ajoutez des instructions supplémentaires si nécessaire</li>
                        <li>Cliquez sur "Générer le rapport"</li>
                      </ol>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Sources de modèle</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground mb-2">Fichier modèle</h4>
                          <p className="text-sm text-muted-foreground">Uploadez un exemple de rapport dont l'IA suivra le style</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground mb-2">Rapports existants</h4>
                          <p className="text-sm text-muted-foreground">L'IA s'inspire de vos rapports déjà analysés</p>
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Amélioration interactive</h3>
                      <p className="text-foreground">Après génération, vous pouvez :</p>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li>Saisir des retours pour améliorer l'analyse</li>
                        <li>Demander plus de détails sur certains aspects</li>
                        <li>Ajuster le ton ou le niveau de détail</li>
                        <li>Relancer la génération avec vos précisions</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeSection === "analyse" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <FileText className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Analyse des rapports</h2>
                        <p className="text-muted-foreground m-0">Consultez les insights générés par l'IA</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Consulter une analyse</h3>
                      <p className="text-foreground">Cliquez sur un rapport dans la liste pour voir :</p>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li><strong>Résumé</strong> : Vue d'ensemble générée par l'IA</li>
                        <li><strong>Points clés</strong> : Éléments importants identifiés</li>
                        <li><strong>KPIs</strong> : Indicateurs de performance extraits</li>
                        <li><strong>Insights</strong> : Recommandations et observations</li>
                        <li><strong>Graphiques</strong> : Visualisations des données</li>
                      </ul>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Graphiques interactifs</h3>
                      <p className="text-foreground">Les graphiques peuvent être :</p>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li><strong>Agrandis</strong> : Cliquez sur l'icône d'expansion</li>
                        <li><strong>Téléchargés</strong> : Exportez en image</li>
                        <li><strong>Partagés</strong> : Générez un lien de partage</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeSection === "chat" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <MessageSquare className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Chat IA</h2>
                        <p className="text-muted-foreground m-0">Conversez avec l'assistant intelligent</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Démarrer une conversation</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Cliquez sur "Chat IA" dans le menu</li>
                        <li>Posez votre question dans le champ de texte</li>
                        <li>L'assistant répond en utilisant vos rapports comme contexte</li>
                      </ol>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Joindre des fichiers</h3>
                      <p className="text-foreground">
                        Enrichissez vos questions avec des fichiers (📎) ou des images (🖼️). Maximum 5 fichiers par message.
                        Formats acceptés : PDF, DOCX, Excel, TXT, images.
                      </p>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Exemples de questions</h3>
                      <div className="space-y-2">
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-sm text-foreground italic">"Quels sont les principaux KPIs de mon dernier rapport ?"</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-sm text-foreground italic">"Compare les performances entre janvier et février"</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-sm text-foreground italic">"Quelles tendances observes-tu dans mes données ?"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "predictions" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <TrendingUp className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Prédictions multi-scénarios</h2>
                        <p className="text-muted-foreground m-0">Générez des projections basées sur vos données</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Générer des prédictions</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Accédez à "Prédictions" dans le menu</li>
                        <li>Sélectionnez les rapports de base (minimum 2)</li>
                        <li>Choisissez la période de prédiction</li>
                        <li>Cliquez sur "Générer les prédictions"</li>
                      </ol>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Types de scénarios</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                          <h4 className="font-semibold text-green-600 dark:text-green-400">Optimiste</h4>
                          <p className="text-sm text-muted-foreground">Projections favorables</p>
                        </div>
                        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <h4 className="font-semibold text-blue-600 dark:text-blue-400">Réaliste</h4>
                          <p className="text-sm text-muted-foreground">Projections équilibrées</p>
                        </div>
                        <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <h4 className="font-semibold text-orange-600 dark:text-orange-400">Pessimiste</h4>
                          <p className="text-sm text-muted-foreground">Projections prudentes</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "alertes" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Bell className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Alertes</h2>
                        <p className="text-muted-foreground m-0">Surveillez les anomalies et seuils</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Types d'alertes</h3>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li><strong>Seuil dépassé</strong> : Un KPI dépasse une limite définie</li>
                        <li><strong>Anomalie détectée</strong> : Valeur inhabituelle identifiée</li>
                        <li><strong>Inversion de tendance</strong> : Changement de direction significatif</li>
                        <li><strong>Données manquantes</strong> : Informations absentes</li>
                        <li><strong>Problème de qualité</strong> : Incohérences détectées</li>
                      </ul>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Niveaux de sévérité</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-green-500"></span>
                          <span className="text-foreground"><strong>Faible</strong> : Information à noter</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                          <span className="text-foreground"><strong>Moyenne</strong> : Attention requise</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                          <span className="text-foreground"><strong>Élevée</strong> : Action recommandée</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500"></span>
                          <span className="text-foreground"><strong>Critique</strong> : Action urgente requise</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "arena" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Shield className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Arena Multi-Modèles</h2>
                        <p className="text-muted-foreground m-0">Consensus multi-IA pour des réponses fiables</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Comment ça fonctionne</h3>
                      <p className="text-foreground">
                        L'Arena interroge plusieurs modèles d'IA en parallèle, puis un modèle "Juge" synthétise 
                        une réponse optimale (Réponse Gold) en détectant les hallucinations et contradictions.
                      </p>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Modèles disponibles</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground">Gemini 2.5 Pro</h4>
                          <p className="text-sm text-muted-foreground">Raisonnement complexe et multimodal</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground">Gemini 2.5 Flash</h4>
                          <p className="text-sm text-muted-foreground">Rapide et équilibré</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground">GPT-5</h4>
                          <p className="text-sm text-muted-foreground">Polyvalent haut de gamme</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground">GPT-5 Mini</h4>
                          <p className="text-sm text-muted-foreground">Économique et performant</p>
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Indicateurs</h3>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li><strong>Score de consensus</strong> : Niveau d'accord entre les modèles</li>
                        <li><strong>Hallucinations</strong> : Incohérences détectées et filtrées</li>
                        <li><strong>Temps de traitement</strong> : Durée de l'analyse multi-modèles</li>
                        <li><strong>Mode Expert</strong> : Accès aux réponses individuelles de chaque modèle</li>
                      </ul>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Configuration</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Accédez à "Configuration Arena" depuis le tableau de bord</li>
                        <li>Activez/désactivez les modèles souhaités</li>
                        <li>Choisissez le modèle Juge</li>
                        <li>Ajoutez des modèles externes compatibles OpenAI (optionnel)</li>
                        <li>Sauvegardez votre configuration</li>
                      </ol>
                    </div>
                  </div>
                )}

                {activeSection === "partage" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Share2 className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Partage et export</h2>
                        <p className="text-muted-foreground m-0">Partagez et téléchargez vos analyses</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Partager une analyse</h3>
                      <ol className="list-decimal list-inside space-y-2 text-foreground">
                        <li>Ouvrez le rapport ou la prédiction</li>
                        <li>Cliquez sur l'icône de partage</li>
                        <li>Copiez le lien généré</li>
                        <li>Définissez une date d'expiration (optionnel)</li>
                      </ol>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Formats d'export</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground">Excel (.xlsx)</h4>
                          <p className="text-sm text-muted-foreground">Données structurées dans des feuilles</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <h4 className="font-semibold text-foreground">PDF</h4>
                          <p className="text-sm text-muted-foreground">Document formaté avec graphiques</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "parametres" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Settings className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground m-0">Paramètres</h2>
                        <p className="text-muted-foreground m-0">Personnalisez votre expérience</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Thème</h3>
                      <p className="text-foreground">
                        Basculez entre le mode clair et le mode sombre en cliquant sur l'icône soleil/lune 
                        dans l'en-tête de chaque page.
                      </p>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Changement de mot de passe</h3>
                      <p className="text-foreground">
                        Depuis le tableau de bord, cliquez sur l'icône de profil puis "Changer le mot de passe".
                        Vous devez saisir votre mot de passe actuel avant de pouvoir en définir un nouveau.
                      </p>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Réinitialisation du mot de passe</h3>
                      <p className="text-foreground">
                        Si vous avez oublié votre mot de passe, utilisez le lien "Mot de passe oublié ?" sur la page de connexion.
                        Un email vous sera envoyé pour réinitialiser votre mot de passe.
                      </p>

                      <h3 className="text-lg font-semibold text-foreground mt-6">Notifications</h3>
                      <p className="text-foreground">Configurez vos préférences de notifications email pour :</p>
                      <ul className="list-disc list-inside space-y-2 text-foreground">
                        <li>Nouvelles alertes</li>
                        <li>Analyses terminées</li>
                        <li>Récapitulatif hebdomadaire</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
