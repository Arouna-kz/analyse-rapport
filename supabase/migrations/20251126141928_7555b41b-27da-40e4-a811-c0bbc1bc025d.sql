-- Fix security warnings: add search_path to functions

DROP FUNCTION IF EXISTS public.search_similar_embeddings(vector, float, int, uuid);
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
STABLE
SECURITY DEFINER
SET search_path = public
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

DROP FUNCTION IF EXISTS public.detect_anomalies(UUID, TEXT, FLOAT);
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
STABLE
SECURITY DEFINER
SET search_path = public
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