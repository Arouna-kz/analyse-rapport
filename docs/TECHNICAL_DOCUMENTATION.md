# Documentation Technique - Plateforme d'Analyse IA

## 📋 Table des matières

1. [Architecture](#architecture)
2. [Stack technologique](#stack-technologique)
3. [Structure du projet](#structure-du-projet)
4. [Base de données](#base-de-données)
5. [Authentication](#authentication)
6. [Edge Functions](#edge-functions)
7. [Système Arena Multi-Modèles](#système-arena-multi-modèles)
8. [Intégrations IA](#intégrations-ia)
9. [Déploiement](#déploiement)
10. [Configuration](#configuration)
11. [API Reference](#api-reference)

---

## Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   (React + Vite + TypeScript)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Lovable Cloud Backend                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   Auth      │ │  Database   │ │   Edge Functions    │   │
│  │  (JWT)      │ │ (PostgreSQL)│ │   (Deno Runtime)    │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  Storage    │ │  Realtime   │ │   pgvector (RAG)    │   │
│  │  (S3)       │ │ (WebSocket) │ │   Embeddings        │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External APIs                             │
│  ┌─────────────┐ ┌─────────────────────┐ ┌──────────────┐  │
│  │ Cloudmersive│ │  Lovable AI Gateway │ │    Resend    │  │
│  │ (Document)  │ │  (Multi-model LLM)  │ │   (Email)    │  │
│  └─────────────┘ └─────────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Flux de données

1. **Upload de document** : Frontend → Storage → Edge Function → Extraction Cloudmersive → Analyse IA (Arena)
2. **Chat IA** : Frontend → Edge Function → RAG Search (pgvector) → Lovable AI Gateway → Réponse
3. **Prédictions** : Rapports historiques → Edge Function → Analyse IA → Génération de scénarios
4. **Arena** : Prompt → Requêtes parallèles multi-modèles → Synthèse Juge → Réponse Gold
5. **Génération depuis modèle** : Données + Template → Edge Function → IA → Rapport structuré

---

## Stack technologique

### Frontend

| Technologie | Version | Usage |
|-------------|---------|-------|
| React | ^18.3.1 | Framework UI |
| Vite | ^5.x | Build tool |
| TypeScript | ^5.x | Typage statique |
| Tailwind CSS | ^3.x | Styles |
| shadcn/ui | - | Composants UI |
| Recharts | ^3.5.0 | Visualisation |
| React Router | ^6.30.1 | Navigation |
| TanStack Query | ^5.83.0 | State management |
| react-markdown | ^10.1.0 | Rendu markdown |
| xlsx | ^0.18.5 | Export Excel |

### Backend (Lovable Cloud)

| Service | Usage |
|---------|-------|
| PostgreSQL | Base de données relationnelle |
| pgvector | Embeddings vectoriels pour RAG |
| Auth | Authentification JWT |
| Storage | Stockage de fichiers (bucket `reports`) |
| Realtime | Subscriptions WebSocket |
| Edge Functions | Logique serveur (Deno runtime) |

### APIs externes

| Service | Usage |
|---------|-------|
| Cloudmersive | Extraction de texte (PDF/DOCX/Excel) |
| Lovable AI Gateway | LLM multi-modèles (Gemini, GPT-5) |
| Resend | Envoi d'emails (alertes, digest) |

---

## Structure du projet

```
├── docs/                          # Documentation
│   ├── DATABASE_SCHEMA.sql        # Schema SQL complet
│   ├── USER_GUIDE.md              # Guide utilisateur
│   └── TECHNICAL_DOCUMENTATION.md # Ce fichier
├── public/                        # Assets statiques
├── src/
│   ├── components/                # Composants React
│   │   ├── ui/                    # Composants shadcn/ui
│   │   ├── AnalysisRefinement.tsx  # Amélioration interactive des analyses
│   │   ├── AnalysisVersionHistory.tsx # Historique des versions d'analyse
│   │   ├── ArenaConfigPanel.tsx   # Configuration des modèles Arena
│   │   ├── ArenaResults.tsx       # Affichage résultats Arena
│   │   ├── ArenaStatus.tsx        # Indicateur statut Arena
│   │   ├── ChangePasswordDialog.tsx # Dialogue changement mot de passe
│   │   ├── ConversationSidebar.tsx # Panneau conversations chat
│   │   ├── ExpandableChart.tsx    # Graphiques extensibles
│   │   ├── ExtractedContentPreview.tsx # Prévisualisation contenu extrait
│   │   ├── FileAttachmentInput.tsx # Input fichiers joints (chat)
│   │   ├── FileTypeIndicator.tsx  # Indicateur type de fichier
│   │   ├── NavLink.tsx            # Lien de navigation
│   │   ├── PredictionCharts.tsx   # Graphiques de prédiction
│   │   ├── PredictionComparison.tsx # Comparaison de scénarios
│   │   ├── ReportActions.tsx      # Actions sur les rapports
│   │   └── ThemeToggle.tsx        # Basculement thème clair/sombre
│   ├── hooks/                     # Hooks personnalisés
│   │   ├── use-mobile.tsx         # Détection mobile
│   │   ├── use-toast.ts           # Notifications toast
│   │   ├── useArena.ts            # Logique appel Arena
│   │   └── useArenaConfig.ts      # Configuration Arena
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts          # Client Supabase (auto-généré)
│   │       └── types.ts           # Types TypeScript (auto-généré)
│   ├── lib/
│   │   ├── arenaConfig.ts         # Configuration modèles Arena
│   │   ├── exportUtils.ts         # Export Excel/PDF
│   │   ├── textUtils.ts           # Nettoyage markdown
│   │   └── utils.ts               # Utilitaires généraux
│   ├── pages/                     # Pages de l'application
│   │   ├── Index.tsx              # Page d'accueil (landing)
│   │   ├── Auth.tsx               # Authentification (login/signup)
│   │   ├── ResetPassword.tsx      # Réinitialisation mot de passe
│   │   ├── Dashboard.tsx          # Tableau de bord
│   │   ├── Upload.tsx             # Upload de fichiers
│   │   ├── Chat.tsx               # Chat IA avec RAG
│   │   ├── ReportDetail.tsx       # Détail et analyse rapport
│   │   ├── GenerateFutureReport.tsx # Génération rapport futur
│   │   ├── GenerateFromTemplate.tsx # Génération depuis modèle
│   │   ├── MultiScenarioPredictions.tsx # Prédictions multi-scénarios
│   │   ├── Alerts.tsx             # Gestion alertes
│   │   ├── ArenaSettings.tsx      # Configuration Arena
│   │   ├── SharedPrediction.tsx   # Vue partage public
│   │   ├── Documentation.tsx      # Guide utilisateur intégré
│   │   └── NotFound.tsx           # 404
│   ├── App.tsx                    # Composant racine + routes
│   ├── App.css
│   ├── main.tsx                   # Point d'entrée
│   └── index.css                  # Styles globaux + design system
├── supabase/
│   ├── config.toml                # Configuration (auto-géré)
│   └── functions/                 # Edge Functions
│       ├── analyze-report/        # Analyse de rapport
│       ├── arena/                 # Orchestration multi-modèles
│       ├── chat/                  # Chat IA simple
│       ├── rag-chat/              # Chat avec RAG (recherche sémantique)
│       ├── generate-future-report/# Génération rapport futur
│       ├── generate-from-template/# Génération depuis modèle
│       ├── multi-scenario-predictions/ # Prédictions multi-scénarios
│       ├── refine-analysis/       # Amélioration interactive d'analyse
│       ├── preview-extracted-content/ # Prévisualisation contenu extrait
│       ├── validate-report/       # Validation de rapport
│       ├── get-shared-prediction/ # Récupération prédiction partagée
│       ├── export-share-analytics/# Analytics de partage
│       ├── send-notification-email/# Envoi emails de notification
│       └── weekly-digest/         # Récapitulatif hebdomadaire
├── index.html
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## Base de données

### Schéma principal

Voir `docs/DATABASE_SCHEMA.sql` pour le schéma complet.

### Tables principales

| Table | Description |
|-------|-------------|
| `reports` | Rapports uploadés par les utilisateurs |
| `report_analyses` | Analyses générées (avec score Arena et métadonnées) |
| `report_embeddings` | Embeddings vectoriels pour recherche sémantique |
| `chat_conversations` | Conversations chat |
| `chat_messages` | Messages de chat |
| `report_predictions` | Prédictions générées |
| `saved_prediction_scenarios` | Scénarios sauvegardés |
| `prediction_shares` | Liens de partage |
| `prediction_share_views` | Suivi des vues de partages |
| `report_alerts` | Alertes automatiques |
| `report_validations` | Validations humaines |
| `report_versions` | Historique des versions |
| `report_consolidations` | Consolidations multi-sources |
| `user_roles` | Rôles RBAC |
| `audit_logs` | Journalisation immuable |
| `background_jobs` | Tâches de fond |

### Row Level Security (RLS)

Toutes les tables utilisent RLS pour isoler les données par utilisateur :

```sql
-- Exemple de politique RLS
CREATE POLICY "Users can view their own reports" 
ON public.reports
FOR SELECT 
USING (auth.uid() = user_id);
```

### Recherche vectorielle (RAG)

```sql
-- Fonction de recherche sémantique
SELECT * FROM search_similar_embeddings(
  query_embedding := '[0.1, 0.2, ...]'::vector,
  match_threshold := 0.7,
  match_count := 5,
  _user_id := 'uuid-here'
);
```

---

## Authentication

### Configuration

L'authentification utilise JWT avec email/mot de passe :

```typescript
import { supabase } from '@/integrations/supabase/client';

// Inscription
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    emailRedirectTo: `${window.location.origin}/`
  }
});

// Connexion
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Déconnexion
await supabase.auth.signOut();
```

### Changement de mot de passe sécurisé

Le changement de mot de passe exige la vérification de l'ancien mot de passe :

```typescript
// 1. Vérifier l'ancien mot de passe
const { error: verifyError } = await supabase.auth.signInWithPassword({
  email: user.email,
  password: currentPassword
});

// 2. Si vérifié, mettre à jour
const { error } = await supabase.auth.updateUser({
  password: newPassword
});
```

### Réinitialisation de mot de passe

```typescript
// Envoyer le lien de réinitialisation
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`
});
```

### Gestion de session

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    // Utilisateur connecté
  } else {
    // Utilisateur déconnecté
  }
});
```

---

## Edge Functions

### Liste des Edge Functions

| Function | JWT | Description |
|----------|-----|-------------|
| `analyze-report` | Non | Analyse un rapport uploadé |
| `arena` | Non | Orchestration multi-modèles |
| `chat` | Non | Chat IA simple |
| `rag-chat` | Oui | Chat avec recherche sémantique RAG |
| `generate-future-report` | Oui | Génère un rapport futur |
| `generate-from-template` | Oui | Génère depuis un modèle |
| `multi-scenario-predictions` | Oui | Génère des prédictions multi-scénarios |
| `refine-analysis` | Oui | Améliore une analyse existante |
| `preview-extracted-content` | Non | Prévisualise le contenu extrait |
| `validate-report` | Oui | Valide un rapport |
| `get-shared-prediction` | Non | Récupère une prédiction partagée |
| `export-share-analytics` | Oui | Analytics de partage |
| `send-notification-email` | Non | Envoi d'email de notification |
| `weekly-digest` | Non | Récapitulatif hebdomadaire |

### Structure d'une Edge Function

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { data } = await req.json();
    // Logique métier
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Appel depuis le frontend

```typescript
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { param1: 'value1' }
});
```

---

## Système Arena Multi-Modèles

### Architecture

Le système Arena implémente un mécanisme de consensus multi-modèles en 3 phases :

```
Phase 1: Requêtes parallèles
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Gemini   │  │ GPT-5    │  │ Modèle   │
│ 2.5 Pro  │  │          │  │ Externe  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     ▼             ▼             ▼
Phase 2: Synthèse par le Juge
┌────────────────────────────────────────┐
│          Modèle Juge                    │
│  - Analyse des réponses                │
│  - Détection d'hallucinations          │
│  - Score de consensus                  │
└────────────────┬───────────────────────┘
                 ▼
Phase 3: Réponse Gold
┌────────────────────────────────────────┐
│  Réponse synthétisée optimale          │
│  + Score de consensus                  │
│  + Hallucinations détectées            │
│  + Notes de synthèse                   │
└────────────────────────────────────────┘
```

### Modèles supportés (Lovable AI Gateway)

| ID | Nom API | Description |
|----|---------|-------------|
| `lovable-gemini-pro` | `google/gemini-2.5-pro` | Raisonnement complexe, multimodal |
| `lovable-gemini-flash` | `google/gemini-2.5-flash` | Rapide et équilibré |
| `lovable-gpt5` | `openai/gpt-5` | Polyvalent haut de gamme |
| `lovable-gpt5-mini` | `openai/gpt-5-mini` | Économique performant |

### Configuration hybride

L'Arena supporte des modèles externes compatibles OpenAI :

```typescript
// Modèle externe
{
  id: 'custom-model',
  name: 'Mon modèle',
  baseUrl: 'https://api.example.com/v1/chat/completions',
  isLovableAI: false,
  apiKey: 'sk-...'
}
```

### Payload de l'Arena

```typescript
// Requête
{
  prompt: "Analyser ce rapport...",
  systemPrompt: "Tu es un expert en analyse.",
  models: [...],           // Modèles à interroger
  judgeModelId: "...",     // ID du modèle juge
  context: "...",          // Contexte additionnel
  images: ["data:..."],   // Images en base64
  conversationHistory: []  // Historique conversation
}

// Réponse
{
  goldResponse: "Synthèse optimale...",
  modelResponses: [...],   // Réponses individuelles
  consensusScore: 0.87,    // Score de consensus (0-1)
  hallucinations: [...],   // Hallucinations détectées
  synthesisNotes: "...",   // Notes du juge
  processingTime: 4523     // Temps en ms
}
```

---

## Intégrations IA

### Lovable AI Gateway

Toutes les requêtes IA passent par le Lovable AI Gateway qui fournit un accès unifié aux modèles :

```typescript
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: 'Prompt système...' },
      { role: 'user', content: 'Contenu à analyser...' }
    ],
    temperature: 0.3
  })
});
```

### Cloudmersive - Extraction de documents

```typescript
const response = await fetch(
  'https://api.cloudmersive.com/convert/autodetect/to-text',
  {
    method: 'POST',
    headers: {
      'Apikey': CLOUDMERSIVE_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer
  }
);
```

---

## Déploiement

### Prérequis

- Compte Lovable avec Cloud activé
- Secrets configurés pour les Edge Functions

### Variables d'environnement (auto-générées)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_SUPABASE_PROJECT_ID=xxx
```

### Secrets Edge Functions

| Secret | Usage |
|--------|-------|
| `SUPABASE_URL` | URL du backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service admin |
| `LOVABLE_API_KEY` | Accès Lovable AI Gateway |
| `CLOUDMERSIVE_API_KEY` | Extraction documentaire |
| `RESEND_API_KEY` | Envoi d'emails |

### Déploiement

- **Frontend** : Automatiquement déployé via Lovable lors du clic "Publish"
- **Edge Functions** : Automatiquement déployées à chaque modification des fichiers
- **Base de données** : Migrations automatiques via Lovable Cloud

---

## Configuration

### Design System (Tailwind CSS)

Le design system est défini dans `src/index.css` et `tailwind.config.ts` :

```css
:root {
  --primary: 215 85% 25%;
  --accent: 185 95% 45%;
  --background: ...;
  --foreground: ...;
}

.dark {
  --primary: 185 85% 50%;
  --background: ...;
}
```

### Thème sombre

Le basculement de thème est géré par le composant `ThemeToggle` :

```typescript
document.documentElement.classList.toggle('dark');
localStorage.setItem('theme', 'dark');
```

---

## API Reference

### Client Database

```typescript
import { supabase } from '@/integrations/supabase/client';

// SELECT
const { data } = await supabase.from('reports').select('*').eq('user_id', userId);

// INSERT
const { data } = await supabase.from('reports').insert({ title, user_id }).select().single();

// UPDATE
await supabase.from('reports').update({ status: 'completed' }).eq('id', reportId);

// DELETE
await supabase.from('reports').delete().eq('id', reportId);
```

### Edge Functions Reference

| Function | Body | Description |
|----------|------|-------------|
| `analyze-report` | `{ reportId }` | Analyse un rapport |
| `arena` | `{ prompt, models, judgeModelId, ... }` | Orchestration multi-modèles |
| `chat` | `{ message, conversationId }` | Chat IA simple |
| `rag-chat` | `{ message, conversationId }` | Chat avec RAG |
| `generate-future-report` | `{ reportIds, title }` | Génère un rapport futur |
| `generate-from-template` | `{ dataContent, templateContent, title, ... }` | Génère depuis modèle |
| `multi-scenario-predictions` | `{ reportIds }` | Génère des prédictions |
| `refine-analysis` | `{ reportId, feedback, files }` | Améliore une analyse |
| `preview-extracted-content` | `{ fileUrl }` | Prévisualise contenu extrait |
| `validate-report` | `{ reportId }` | Valide un rapport |
| `get-shared-prediction` | `{ token }` | Récupère prédiction partagée |
| `export-share-analytics` | `{ shareId }` | Analytics de partage |
| `send-notification-email` | `{ to, subject, body }` | Envoie email |
| `weekly-digest` | `{}` | Récapitulatif hebdomadaire |

---

## Support

Pour contribuer ou signaler des problèmes :
1. Consultez cette documentation
2. Vérifiez les logs dans la console navigateur
3. Consultez les logs des fonctions backend via Lovable Cloud

---

© 2026 Plateforme d'Analyse IA - Documentation Technique
