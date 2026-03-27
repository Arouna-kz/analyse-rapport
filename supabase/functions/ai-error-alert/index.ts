import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: roles } = await sbAdmin.from('user_roles').select('role')
      .eq('user_id', user.id).in('role', ['admin', 'super_admin']);
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Accès refusé' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { errorRate, threshold, period, totalCalls, errorCalls, recipientEmail } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurée' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailTo = recipientEmail || user.email;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Report Whisperer <onboarding@resend.dev>',
        to: [emailTo],
        subject: `⚠️ Alerte IA : taux d'erreur à ${errorRate.toFixed(1)}%`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">⚠️ Alerte taux d'erreur IA</h2>
            <p>Le taux d'erreur des appels IA a dépassé le seuil configuré.</p>
            <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
              <tr style="background: #fef2f2;">
                <td style="padding: 10px; border: 1px solid #fecaca; font-weight: bold;">Taux d'erreur</td>
                <td style="padding: 10px; border: 1px solid #fecaca; color: #dc2626; font-weight: bold;">${errorRate.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">Seuil configuré</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${threshold}%</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">Période</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${period}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">Total appels</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${totalCalls}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">Appels en erreur</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${errorCalls}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 14px;">Connectez-vous au panneau d'administration pour plus de détails.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Resend error:', errText);
      return new Response(JSON.stringify({ error: 'Échec envoi email' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
