"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import {
  emailValidePourReinitialisation,
  motDePasseValide,
  motsDePasseIdentiques,
  urlCallbackReinitialisation,
} from "@/lib/auth-password";
import { consumeAuthAttempt } from "@/lib/auth-throttle";

export async function demanderReinitialisation(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!emailValidePourReinitialisation(email)) {
    redirect("/forgot-password?error=email");
  }

  const redirectTo = urlCallbackReinitialisation(
    process.env.APP_URL,
    process.env.NODE_ENV,
  );
  if (!redirectTo) redirect("/forgot-password?error=service");

  let acceptee = false;
  try {
    const supabase = await supabaseServer();
    // Le fournisseur d'e-mails intégré plafonne l'envoi pour tout le projet :
    // sans frein local, quelques demandes répétées privent tout le monde de
    // réinitialisation. C'est l'incident constaté le 13 août 2026.
    if (!(await consumeAuthAttempt(supabase, "password_reset"))) {
      redirect("/forgot-password?error=trop-de-tentatives");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    acceptee = !error;
  } catch {
    // Une panne réseau/configuration ne doit jamais devenir un faux succès.
  }

  redirect(
    acceptee
      ? "/forgot-password?info=accepted"
      : "/forgot-password?error=service",
  );
}

export async function enregistrerNouveauMotDePasse(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");

  if (!motDePasseValide(password)) {
    redirect("/reset-password?error=length");
  }
  if (!motsDePasseIdentiques(password, confirmation)) {
    redirect("/reset-password?error=mismatch");
  }

  let resultat: "success" | "session" | "update" | "service" = "service";
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      resultat = "session";
    } else {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        resultat = "update";
      } else {
        resultat = "success";
        // Le lien de récupération a ouvert une session temporaire. Une fois le
        // secret changé, on ferme seulement cette session locale.
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Le mot de passe est déjà modifié : une panne de déconnexion ne
          // transforme pas cette mutation réussie en échec trompeur.
        }
      }
    }
  } catch {
    resultat = "service";
  }

  if (resultat === "success") redirect("/login?info=password-updated");
  if (resultat === "session") redirect("/reset-password?error=session");
  if (resultat === "update") redirect("/reset-password?error=update");
  redirect("/reset-password?error=service");
}
