import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { destinationReinitialisationSure } from "@/lib/auth-password";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const destination = destinationReinitialisationSure(
    url.searchParams.get("next"),
  );

  if (code && destination === "/reset-password") {
    try {
      const supabase = await supabaseServer();
      const { error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (!error) return NextResponse.redirect(new URL(destination, url.origin));
    } catch {
      // Le code expiré, déjà consommé ou sans vérificateur PKCE reste un échec.
    }
  }

  return NextResponse.redirect(
    new URL("/forgot-password?error=link", url.origin),
  );
}
