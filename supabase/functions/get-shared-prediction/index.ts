import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { shareToken } = await req.json();

    if (!shareToken) {
      return new Response(
        JSON.stringify({ error: 'Share token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the share record
    const { data: share, error: shareError } = await supabase
      .from('prediction_shares')
      .select('*, saved_prediction_scenarios(*)')
      .eq('share_token', shareToken)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired share link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This share link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client info
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || req.headers.get('referrer') || '';

    // Get geographic info from IP (using ipapi.co free service)
    let geoData = { country: null, city: null };
    if (clientIp && clientIp !== 'unknown') {
      try {
        const geoResponse = await fetch(`https://ipapi.co/${clientIp}/json/`);
        if (geoResponse.ok) {
          const geo = await geoResponse.json();
          geoData = {
            country: geo.country_name || null,
            city: geo.city || null,
          };
        }
      } catch (err) {
        console.error('Failed to fetch geo data:', err);
      }
    }

    // Log detailed view event
    await supabase
      .from('prediction_share_views')
      .insert({
        share_id: share.id,
        ip_address: clientIp,
        user_agent: userAgent,
        country: geoData.country,
        city: geoData.city,
        referrer: referrer,
        metadata: {},
      });

    // Increment view count
    await supabase
      .from('prediction_shares')
      .update({ view_count: share.view_count + 1 })
      .eq('id', share.id);

    // Send notification email in background (don't await to avoid blocking)
    fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        shareId: share.id,
        viewerInfo: {
          ipAddress: clientIp,
          userAgent: userAgent,
        },
      }),
    }).catch(err => console.error('Failed to send notification email:', err));

    return new Response(
      JSON.stringify({ prediction: share.saved_prediction_scenarios }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
