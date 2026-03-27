-- ============================================
-- PHASE 1 & 2: ARCHITECTURE AVANCÉE
-- ============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- CREATE ALL ENUMS FIRST
-- ============================================
CREATE TYPE app_role AS ENUM (
  'super_admin',
  'admin', 
  'analyst',
  'reviewer',
  'viewer',
  'data_steward'
);

CREATE TYPE alert_type AS ENUM (
  'kpi_threshold_exceeded',
  'anomaly_detected',
  'trend_reversal',
  'missing_data',
  'quality_issue'
);

CREATE TYPE alert_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE validation_status AS ENUM (
  'pending_review',
  'approved',
  'rejected',
  'needs_correction'
);

CREATE TYPE prediction_type AS ENUM (
  'optimistic',
  'realistic',
  'pessimistic'
);

CREATE TYPE consolidation_strategy AS ENUM (
  'merge_sequential',
  'merge_weighted',
  'merge_smart_ai'
);

-- ============================================
-- TABLE: user_roles (NO RLS YET)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  scope JSONB DEFAULT '{}'::jsonb,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, role)
);

-- ============================================
-- FUNCTION: has_role (CREATED BEFORE POLICIES)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (expires_at IS NULL OR expires_at > NOW())
  )
$$;

-- NOW ENABLE RLS AND ADD POLICIES TO user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- TABLE: audit_logs (Immutable)
-- ============================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  checksum TEXT
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs are insert-only"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================
-- TABLE: report_versions
-- ============================================
CREATE TABLE public.report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  delta JSONB DEFAULT '{}'::jsonb,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_published BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(report_id, version_number)
);

ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of their reports"
  ON public.report_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_versions.report_id
        AND reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can create versions"
  ON public.report_versions FOR INSERT
  WITH CHECK (true);

-- ============================================
-- TABLE: report_validations
-- ============================================
CREATE TABLE public.report_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  validator_id UUID NOT NULL,
  status validation_status NOT NULL DEFAULT 'pending_review',
  feedback TEXT,
  annotations JSONB DEFAULT '{}'::jsonb,
  corrections JSONB DEFAULT '{}'::jsonb,
  validation_score INTEGER CHECK (validation_score >= 1 AND validation_score <= 5),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.report_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers can manage validations"
  ON public.report_validations FOR ALL
  USING (
    public.has_role(auth.uid(), 'reviewer'::app_role) OR 
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can view validations of their reports"
  ON public.report_validations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_validations.report_id
        AND reports.user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: report_alerts
-- ============================================
CREATE TABLE public.report_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  trigger_condition JSONB DEFAULT '{}'::jsonb,
  detected_value JSONB DEFAULT '{}'::jsonb,
  message TEXT NOT NULL,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.report_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for their reports"
  ON public.report_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_alerts.report_id
        AND reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can acknowledge their alerts"
  ON public.report_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_alerts.report_id
        AND reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can create alerts"
  ON public.report_alerts FOR INSERT
  WITH CHECK (true);

-- ============================================
-- TABLE: report_predictions
-- ============================================
CREATE TABLE public.report_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_reports UUID[] NOT NULL,
  prediction_type prediction_type NOT NULL,
  predicted_kpis JSONB DEFAULT '{}'::jsonb,
  confidence_scores JSONB DEFAULT '{}'::jsonb,
  methodology JSONB DEFAULT '{}'::jsonb,
  assumptions TEXT[],
  risk_factors TEXT[],
  recommendations TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.report_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their predictions"
  ON public.report_predictions FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create predictions"
  ON public.report_predictions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- ============================================
-- TABLE: report_consolidations
-- ============================================
CREATE TABLE public.report_consolidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_report_ids UUID[] NOT NULL,
  consolidation_strategy consolidation_strategy NOT NULL,
  merged_content JSONB DEFAULT '{}'::jsonb,
  merged_kpis JSONB DEFAULT '{}'::jsonb,
  conflict_resolution JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'draft'
);

ALTER TABLE public.report_consolidations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their consolidations"
  ON public.report_consolidations FOR ALL
  USING (auth.uid() = created_by);

-- ============================================
-- TABLE: background_jobs
-- ============================================
CREATE TABLE public.background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_by UUID
);

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage jobs"
  ON public.background_jobs FOR ALL
  USING (true);

-- ============================================
-- PHASE 2: OPTIMIZED VECTOR SEARCH
-- ============================================

-- Add HNSW index for optimized vector search
CREATE INDEX IF NOT EXISTS report_embeddings_embedding_idx 
  ON public.report_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- ADVANCED FUNCTIONS
-- ============================================

-- Optimized RAG search function
CREATE OR REPLACE FUNCTION public.search_similar_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  _user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  report_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
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

-- Anomaly detection function
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

-- Auto versioning trigger function
CREATE OR REPLACE FUNCTION public.create_report_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
  previous_content JSONB;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO next_version
  FROM report_versions
  WHERE report_id = NEW.id;
  
  SELECT content_snapshot INTO previous_content
  FROM report_versions
  WHERE report_id = NEW.id
  ORDER BY version_number DESC
  LIMIT 1;
  
  INSERT INTO report_versions (
    report_id,
    version_number,
    content_snapshot,
    delta,
    changed_by,
    change_reason
  ) VALUES (
    NEW.id,
    next_version,
    jsonb_build_object(
      'title', NEW.title,
      'status', NEW.status,
      'metadata', NEW.metadata
    ),
    CASE 
      WHEN previous_content IS NOT NULL THEN
        jsonb_build_object('previous', previous_content, 'current', NEW.metadata)
      ELSE '{}'::jsonb
    END,
    NEW.user_id,
    'Automatic version on update'
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER report_version_trigger
  AFTER UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.create_report_version();

-- Auto audit logging trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    changes,
    checksum
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ),
    md5(COALESCE(to_jsonb(NEW)::text, to_jsonb(OLD)::text))
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_reports_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_validations_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.report_validations
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_report_versions_report_id ON public.report_versions(report_id);
CREATE INDEX idx_report_alerts_report_id ON public.report_alerts(report_id);
CREATE INDEX idx_report_alerts_severity ON public.report_alerts(severity) WHERE NOT is_acknowledged;
CREATE INDEX idx_background_jobs_status ON public.background_jobs(status, scheduled_at);