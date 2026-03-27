import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  shareId: string;
  viewerInfo?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { shareId, viewerInfo }: NotificationRequest = await req.json();

    // Get share details with prediction and creator info
    const { data: share, error: shareError } = await supabase
      .from('prediction_shares')
      .select(`
        *,
        saved_prediction_scenarios (
          name,
          created_at,
          predictions
        )
      `)
      .eq('id', shareId)
      .single();

    if (shareError || !share) {
      console.error('Share not found:', shareError);
      return new Response(
        JSON.stringify({ error: 'Share not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get creator's email (assuming you have a profiles table or using auth metadata)
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(share.created_by);

    if (userError || !user?.email) {
      console.error('Creator email not found:', userError);
      return new Response(
        JSON.stringify({ error: 'Creator email not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send notification email
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Prédictions Partagées <onboarding@resend.dev>",
        to: [user.email],
        subject: `📊 Quelqu'un a consulté votre prédiction "${share.saved_prediction_scenarios.name}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Nouvelle consultation de prédiction</h2>
            
            <p>Bonjour,</p>
            
            <p>Votre prédiction partagée <strong>"${share.saved_prediction_scenarios.name}"</strong> vient d'être consultée.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Nombre total de vues :</strong> ${share.view_count}</p>
              <p style="margin: 5px 0;"><strong>Date de partage :</strong> ${new Date(share.created_at).toLocaleDateString('fr-FR')}</p>
              ${share.expires_at ? `<p style="margin: 5px 0;"><strong>Expire le :</strong> ${new Date(share.expires_at).toLocaleDateString('fr-FR')}</p>` : ''}
            </div>
            
            ${viewerInfo?.ipAddress ? `<p style="font-size: 12px; color: #6b7280;">IP: ${viewerInfo.ipAddress}</p>` : ''}
            
            <p>Vous recevrez un récapitulatif hebdomadaire de toutes les consultations de vos prédictions partagées.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            
            <p style="font-size: 12px; color: #6b7280;">
              Cette notification automatique vous informe de l'activité sur vos prédictions partagées.
            </p>
          </div>
        `,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend API error:', emailData);
      throw new Error(emailData.message || 'Failed to send email');
    }

    console.log("Notification email sent:", emailData);

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
