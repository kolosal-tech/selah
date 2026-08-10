import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_LOCALE,
  estLocale,
  localePourAcceptLanguage,
  localePourPays,
} from "@/i18n/config";
import { isPublicPath } from "@/lib/public-paths";

function withDefaultLocale(request: NextRequest, response: NextResponse) {
  if (estLocale(request.cookies.get(COOKIE_LOCALE)?.value)) return response;

  const pays = request.headers.get("x-vercel-ip-country");
  const locale = pays
    ? localePourPays(pays)
    : (localePourAcceptLanguage(request.headers.get("accept-language")) ?? "en");
  response.cookies.set(COOKIE_LOCALE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Les pages publiques servent aussi de témoin de disponibilité : elles ne
  // doivent pas dépendre d'un aller-retour Supabase Auth pour s'afficher.
  if (isPublicPath(pathname)) {
    return withDefaultLocale(request, NextResponse.next({ request }));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return withDefaultLocale(request, NextResponse.redirect(url));
  }

  // Première visite sans langue choisie : pays (géo-IP Vercel), sinon langue
  // du navigateur. Le cookie est posé un an ; le sélecteur de langue et
  // l'inscription le réécrivent.
  return withDefaultLocale(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp|mp4|webm)$).*)"],
};
