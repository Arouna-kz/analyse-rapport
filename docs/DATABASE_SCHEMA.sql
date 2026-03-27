-- =====================================================
-- DATABASE SCHEMA - Plateforme d'Analyse IA
-- =====================================================
-- Ce fichier contient toutes les requêtes SQL pour créer
-- les tables de la base de données.
-- Exécutez ces requêtes dans l'ordre dans Supabase SQL Editor
-- =====================================================

-- Activer l'extension pgvector pour les embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- ENUMS (Types personnalisés)
-- =====================================================

CREATE TYPE report_status AS ENUM ('pending', 'processing', 'completed', 'error');
CREATE TYPE report_type AS ENUM ('past', 'current', 'future');
CREATE TYPE prediction_type AS ENUM ('optimistic', 'realistic', 'pessimistic');
CREATE TYPE validation_status AS ENUM ('pending_review', 'approved', 'rejected', 'needs_correction');
CREATE TYPE alert_type AS ENUM ('kpi_threshold_exceeded', 'anomaly_detected', 'trend_reversal', 'missing_data', 'quality_issue');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE app_role AS ENUM ('super_admin', 'admin', 'analyst', 'reviewer', 'viewer', 'data_steward');
CREATE TYPE consolidation_strategy AS ENUM ('merge_sequential', 'merge_weighted', 'merge_smart_ai');

-- =====================================================
-- TABLE: reports
-- Stocke les rapports uploadés par les utilisateurs
-- =====================================================

CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  report_type report_type NOT NULL DEFAULT 'current',
  status report_status NOT NULL DEFAULT 'pending',
  file_path TEXT,
  file_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" ON public.reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" ON public.reports
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: report_analyses
-- Stocke les analyses générées par l'IA
-- =====================================================

CREATE TABLE public.report_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  summary TEXT,
  key_points TEXT[],
  kpis JSONB DEFAULT '{}'::jsonb,
  insights TEXT,
  arena_score NUMERIC,
  arena_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses of their reports" ON public.report_analyses
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM reports WHERE reports.id = report_analyses.report_id AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Service role can insert analyses" ON public.report_analyses
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: report_embeddings
-- Stocke les embeddings vectoriels pour la recherche sémantique
-- =====================================================

CREATE TABLE public.report_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view embeddings of their reports" ON public.report_embeddings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM reports WHERE reports.id = report_embeddings.report_id AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Service role can insert embeddings" ON public.report_embeddings
  FOR INSERT WITH CHECK (true);

-- Index pour la recherche vectorielle
CREATE INDEX ON public.report_embeddings USING hnsw (embedding vector_cosine_ops);

-- =====================================================
-- TABLE: chat_conversations
-- Stocke les conversations de chat
-- =====================================================

CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations" ON public.chat_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" ON public.chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON public.chat_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON public.chat_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: chat_messages
-- Stocke les messages de chat
-- =====================================================

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid()
  ));

CREATE POLICY "Users can create messages in their conversations" ON public.chat_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid()
  ));

-- =====================================================
-- TABLE: report_predictions
-- Stocke les prédictions générées
-- =====================================================

CREATE TABLE public.report_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_reports UUID[] NOT NULL,
  prediction_type prediction_type NOT NULL,
  predicted_kpis JSONB DEFAULT '{}'::jsonb,
  confidence_scores JSONB DEFAULT '{}'::jsonb,
  methodology JSONB DEFAULT '{}'::jsonb,
  assumptions TEXT[],
  risk_factors TEXT[],
  recommendations TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.report_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their predictions" ON public.report_predictions
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create predictions" ON public.report_predictions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- =====================================================
-- TABLE: saved_prediction_scenarios
-- Stocke les scénarios de prédiction sauvegardés
-- =====================================================

CREATE TABLE public.saved_prediction_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  base_report_ids UUID[] NOT NULL,
  predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_prediction_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved predictions" ON public.saved_prediction_scenarios
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create their saved predictions" ON public.saved_prediction_scenarios
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their saved predictions" ON public.saved_prediction_scenarios
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their saved predictions" ON public.saved_prediction_scenarios
  FOR DELETE USING (auth.uid() = created_by);

-- =====================================================
-- TABLE: prediction_shares
-- Stocke les liens de partage des prédictions
-- =====================================================

CREATE TABLE public.prediction_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES public.saved_prediction_scenarios(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prediction_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their shares" ON public.prediction_shares
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create shares for their predictions" ON public.prediction_shares
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM saved_prediction_scenarios WHERE saved_prediction_scenarios.id = prediction_shares.prediction_id AND saved_prediction_scenarios.created_by = auth.uid()
  ));

CREATE POLICY "Users can delete their shares" ON public.prediction_shares
  FOR DELETE USING (created_by = auth.uid());

-- =====================================================
-- TABLE: prediction_share_views
-- Stocke les vues des prédictions partagées
-- =====================================================

CREATE TABLE public.prediction_share_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES public.prediction_shares(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  city TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.prediction_share_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics for their shares" ON public.prediction_share_views
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM prediction_shares WHERE prediction_shares.id = prediction_share_views.share_id AND prediction_shares.created_by = auth.uid()
  ));

CREATE POLICY "Service role can insert view records" ON public.prediction_share_views
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: report_alerts
-- Stocke les alertes générées automatiquement
-- =====================================================

CREATE TABLE public.report_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  message TEXT NOT NULL,
  trigger_condition JSONB DEFAULT '{}'::jsonb,
  detected_value JSONB DEFAULT '{}'::jsonb,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.report_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for their reports" ON public.report_alerts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM reports WHERE reports.id = report_alerts.report_id AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Users can acknowledge their alerts" ON public.report_alerts
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM reports WHERE reports.id = report_alerts.report_id AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Service role can create alerts" ON public.report_alerts
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: report_validations
-- Stocke les validations humaines des rapports
-- =====================================================

CREATE TABLE public.report_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  validator_id UUID NOT NULL,
  status validation_status NOT NULL DEFAULT 'pending_review',
  feedback TEXT,
  annotations JSONB DEFAULT '{}'::jsonb,
  corrections JSONB DEFAULT '{}'::jsonb,
  validation_score INTEGER,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.report_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view validations of their reports" ON public.report_validations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM reports WHERE reports.id = report_validations.report_id AND reports.user_id = auth.uid()
  ));

-- =====================================================
-- TABLE: report_versions
-- Stocke l'historique des versions des rapports
-- =====================================================

CREATE TABLE public.report_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  delta JSONB DEFAULT '{}'::jsonb,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  is_published BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of their reports" ON public.report_versions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM reports WHERE reports.id = report_versions.report_id AND reports.user_id = auth.uid()
  ));

CREATE POLICY "Service role can create versions" ON public.report_versions
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: report_consolidations
-- Stocke les consolidations multi-sources
-- =====================================================

CREATE TABLE public.report_consolidations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_report_ids UUID[] NOT NULL,
  consolidation_strategy consolidation_strategy NOT NULL,
  merged_content JSONB DEFAULT '{}'::jsonb,
  merged_kpis JSONB DEFAULT '{}'::jsonb,
  conflict_resolution JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.report_consolidations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their consolidations" ON public.report_consolidations
  FOR ALL USING (auth.uid() = created_by);

-- =====================================================
-- TABLE: user_roles
-- Gestion avancée des rôles utilisateur (RBAC)
-- =====================================================

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  scope JSONB DEFAULT '{}'::jsonb,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: audit_logs
-- Journalisation immuable des actions
-- =====================================================

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  checksum TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs are insert-only" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: background_jobs
-- Gestion des tâches de fond
-- =====================================================

CREATE TABLE public.background_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
);

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage jobs" ON public.background_jobs
  FOR ALL USING (true);

-- =====================================================
-- FONCTIONS
-- =====================================================

-- Fonction pour vérifier les rôles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (expires_at IS NULL OR expires_at > NOW())
  )
$$;

-- Fonction pour la recherche sémantique
CREATE OR REPLACE FUNCTION public.search_similar_embeddings(
  query_embedding vector,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  _user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  report_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    re.id,
    re.report_id,
    re.content,
    1 - (re.embedding <=> query_embedding) as similarity,
    re.metadata
  FROM public.report_embeddings re
  INNER JOIN public.reports r ON r.id = re.report_id
  WHERE 
    (_user_id IS NULL OR r.user_id = _user_id)
    AND (1 - (re.embedding <=> query_embedding)) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Fonction pour détecter les anomalies
CREATE OR REPLACE FUNCTION public.detect_anomalies(
  _report_id UUID,
  _kpi_name TEXT,
  _threshold FLOAT DEFAULT 2.0
)
RETURNS TABLE (
  anomaly_detected BOOLEAN,
  z_score FLOAT,
  severity TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_value FLOAT;
  mean_value FLOAT;
  std_dev FLOAT;
  calculated_z_score FLOAT;
BEGIN
  SELECT (kpis->>_kpi_name)::FLOAT INTO current_value
  FROM report_analyses
  WHERE report_id = _report_id
  LIMIT 1;
  
  SELECT 
    AVG((kpis->>_kpi_name)::FLOAT),
    STDDEV((kpis->>_kpi_name)::FLOAT)
  INTO mean_value, std_dev
  FROM report_analyses ra
  INNER JOIN reports r ON r.id = ra.report_id
  WHERE r.user_id = (SELECT user_id FROM reports WHERE id = _report_id);
  
  IF std_dev > 0 THEN
    calculated_z_score := ABS(current_value - mean_value) / std_dev;
  ELSE
    calculated_z_score := 0;
  END IF;
  
  RETURN QUERY SELECT
    calculated_z_score > _threshold,
    calculated_z_score,
    CASE
      WHEN calculated_z_score > 3 THEN 'critical'
      WHEN calculated_z_score > 2 THEN 'high'
      WHEN calculated_z_score > 1 THEN 'medium'
      ELSE 'low'
    END;
END;
$$;

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger pour updated_at sur reports
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger pour updated_at sur chat_conversations
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STORAGE
-- =====================================================

-- Créer le bucket pour les rapports
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Politique pour uploader des fichiers
CREATE POLICY "Users can upload their own reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour lire ses propres fichiers
CREATE POLICY "Users can read their own reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour supprimer ses propres fichiers
CREATE POLICY "Users can delete their own reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
