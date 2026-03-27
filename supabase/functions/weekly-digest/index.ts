import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    // Get date range for last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get all shares with views in the last week
    const { data: shares, error: sharesError } = await supabase
      .from('prediction_shares')
      .select(`
        *,
        saved_prediction_scenarios (
          name,
          predictions
        )
      `)
      .gte('created_at', oneWeekAgo.toISOString())
      .gt('view_count', 0);

    if (sharesError) {
      console.error('Error fetching shares:', sharesError);
      throw sharesError;
    }

    // Group shares by creator
    const sharesByCreator = new Map<string, any[]>();
    shares?.forEach(share => {
      const existing = sharesByCreator.get(share.created_by) || [];
      sharesByCreator.set(share.created_by, [...existing, share]);
    });

    let emailsSent = 0;

    // Send digest to each creator
    for (const [creatorId, userShares] of sharesByCreator) {
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(creatorId);

      if (userError || !user?.email) {
        console.error(`Creator email not found for ${creatorId}:`, userError);
        continue;
      }

      const totalViews = userShares.reduce((sum, share) => sum + share.view_count, 0);
      const mostViewedShare = userShares.reduce((max, share) => 
        share.view_count > max.view_count ? share : max
      , userShares[0]);

      // Generate share rows for email
      const shareRows = userShares
        .sort((a, b) => b.view_count - a.view_count)
        .map(share => `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px;">${share.saved_prediction_scenarios.name}</td>
            <td style="padding: 12px 8px; text-align: center;">${share.view_count}</td>
            <td style="padding: 12px 8px; text-align: center;">${new Date(share.created_at).toLocaleDateString('fr-FR')}</td>
          </tr>
        `).join('');

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: "Prédictions Partagées <onboarding@resend.dev>",
          to: [user.email],
          subject: `📊 Résumé hebdomadaire de vos prédictions partagées`,
          html: `
...
          `,
        }),
      });

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        console.error('Resend API error:', emailData);
        continue;
      }

      console.log(`Weekly digest sent to ${user.email}:`, emailData);
      emailsSent++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        message: `Weekly digest sent to ${emailsSent} user(s)` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error("Error in weekly-digest function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
