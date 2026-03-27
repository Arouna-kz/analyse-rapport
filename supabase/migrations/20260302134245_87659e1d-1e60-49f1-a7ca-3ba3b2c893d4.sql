CREATE OR REPLACE FUNCTION public.search_similar_embeddings(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5
)
RETURNS TABLE(id uuid, report_id uuid, content text, similarity double precision, metadata jsonb)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

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
    r.user_id = auth.uid()
    AND (1 - (re.embedding <=> query_embedding)) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;