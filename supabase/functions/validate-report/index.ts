import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, status, feedback, annotations, corrections, validationScore } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating report:', reportId, 'with status:', status);

    // Check if user has reviewer role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['reviewer', 'admin', 'super_admin'])
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'User does not have reviewer permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update validation
    const { data: validation, error } = await supabase
      .from('report_validations')
      .upsert({
        report_id: reportId,
        validator_id: user.id,
        status,
        feedback,
        annotations,
        corrections,
        validation_score: validationScore,
        reviewed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If rejected or needs correction, create alert
    if (status === 'rejected' || status === 'needs_correction') {
      await supabase.from('report_alerts').insert({
        report_id: reportId,
        alert_type: 'quality_issue',
        severity: status === 'rejected' ? 'high' : 'medium',
        trigger_condition: { validation_status: status },
        detected_value: { validator: user.id, score: validationScore },
        message: `Rapport ${status === 'rejected' ? 'rejeté' : 'nécessite des corrections'}: ${feedback || 'Aucune raison spécifiée'}`
      });
    }

    // If approved, update report metadata
    if (status === 'approved') {
      await supabase
        .from('reports')
        .update({
          metadata: {
            validated: true,
            validated_by: user.id,
            validated_at: new Date().toISOString(),
            validation_score: validationScore
          }
        })
        .eq('id', reportId);
    }

    return new Response(
      JSON.stringify({ validation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
