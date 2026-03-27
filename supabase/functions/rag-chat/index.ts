import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { callAI, handleAIError } from '../_shared/ai-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, conversationId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = { id: data.claims.sub };

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('RAG search for query:', query);

    // Generate embedding for the query (always uses OpenAI embeddings API)
    const queryEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!queryEmbeddingResponse.ok) {
      throw new Error('Failed to generate query embedding');
    }

    const queryEmbeddingData = await queryEmbeddingResponse.json();
    const queryEmbedding = queryEmbeddingData.data[0].embedding;

    // Use optimized HNSW vector search function
    const { data: results, error: searchError } = await supabase
      .rpc('search_similar_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5
      });

    if (searchError) {
      console.error('Vector search error:', searchError);
      throw new Error('Failed to search embeddings');
    }

    console.log('Found', results?.length || 0, 'relevant chunks via HNSW index');

    // Build context from top results with similarity scores
    const context = results
      ?.map((r: any) => `[${r.report_id}] (Similarity: ${(r.similarity * 100).toFixed(1)}%)\n${r.content}`)
      .join('\n\n---\n\n') || '';

    // Get conversation history if conversationId provided
    let messages: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (history) {
        messages = history;
      }
    }

    // Generate response using RAG via AI provider abstraction
    const systemPrompt = `Tu es un assistant IA expert en analyse de rapports. Utilise le contexte suivant pour répondre aux questions de l'utilisateur de manière précise et détaillée.

Contexte des rapports:
${context}

Si la réponse n'est pas dans le contexte, dis-le clairement. Ne fabrique pas d'informations.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: query }
    ];

    const chatResponse = await callAI({
      messages: chatMessages,
      model: 'google/gemini-2.5-flash',
      temperature: 0.7,
      stream: true,
    });

    if (!chatResponse.ok) {
      throw new Error('Failed to generate chat response');
    }

    // Return streaming response
    return new Response(chatResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error: any) {
    console.error('RAG chat error:', error);
    return handleAIError(error, corsHeaders);
  }
});
