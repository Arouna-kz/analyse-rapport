import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  shareId?: string;
  format?: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { shareId, format = 'csv', startDate, endDate }: ExportRequest = await req.json();

    // Build query
    let query = supabase
      .from('prediction_share_views')
      .select(`
        *,
        prediction_shares!inner(
          share_token,
          created_by,
          saved_prediction_scenarios(name)
        )
      `)
      .eq('prediction_shares.created_by', user.id)
      .order('viewed_at', { ascending: false });

    // Apply filters
    if (shareId) {
      query = query.eq('share_id', shareId);
    }
    if (startDate) {
      query = query.gte('viewed_at', startDate);
    }
    if (endDate) {
      query = query.lte('viewed_at', endDate);
    }

    const { data: views, error: viewsError } = await query;

    if (viewsError) {
      console.error('Error fetching views:', viewsError);
      throw viewsError;
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date & Time',
        'Prediction Name',
        'IP Address',
        'Country',
        'City',
        'User Agent',
        'Referrer',
      ];

      const rows = views.map(view => [
        new Date(view.viewed_at).toLocaleString('fr-FR'),
        view.prediction_shares.saved_prediction_scenarios.name,
        view.ip_address || 'N/A',
        view.country || 'N/A',
        view.city || 'N/A',
        view.user_agent || 'N/A',
        view.referrer || 'N/A',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="prediction-analytics-${Date.now()}.csv"`,
        },
      });
    } else {
      // Return JSON
      return new Response(
        JSON.stringify(views, null, 2),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="prediction-analytics-${Date.now()}.json"`,
          },
        }
      );
    }
  } catch (error: any) {
    console.error('Error in export-share-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
