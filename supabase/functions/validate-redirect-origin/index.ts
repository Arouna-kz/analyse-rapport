// Strict server-side validation of a return_to origin against the whitelist.
// Public endpoint (no JWT) — used by the reset-password relay before redirecting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RELAY_ORIGIN = "https://report-whisperer-41.lovable.app";

function normalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Reject if any path/query/hash — must be a pure origin
    if (url.pathname !== "/" && url.pathname !== "") return null;
    if (url.search || url.hash) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { origin } = await req.json().catch(() => ({ origin: null }));
    if (!origin || typeof origin !== "string") {
      return new Response(JSON.stringify({ allowed: false, reason: "missing_origin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizeOrigin(origin);
    if (!normalized) {
      return new Response(JSON.stringify({ allowed: false, reason: "invalid_origin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (normalized === RELAY_ORIGIN) {
      return new Response(JSON.stringify({ allowed: true, origin: normalized, source: "relay" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await supabase
      .from("allowed_redirect_domains")
      .select("origin")
      .eq("is_active", true)
      .eq("origin", normalized)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ allowed: false, reason: "lookup_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ allowed: !!data, origin: normalized, source: "whitelist" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(JSON.stringify({ allowed: false, reason: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
