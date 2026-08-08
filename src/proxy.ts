import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_LOCALE,
  estLocale,
  localePourAcceptLanguage,
  localePourPays,
} from "@/i18n/config";

// `/sw.js` et `/hors-ligne` DOIVENT rester publics : le navigateur récupère le
// service worker sans cookie applicatif, et la page de repli doit s'afficher
// justement quand la session ne peut pas être vérifiée.
const PUBLIC_PATHS = [
  "/",
  "/decouvrir",
  "/login",
  "/signup",
  "/manifest.json",
  "/sw.js",
  "/hors-ligne",
];

export async function proxy(request: NextRequest) {
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

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/");
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Première visite sans langue choisie : pays (géo-IP Vercel), sinon langue
  // du navigateur. Le cookie est posé un an ; le sélecteur de langue et
  // l'inscription le réécrivent.
  if (!estLocale(request.cookies.get(COOKIE_LOCALE)?.value)) {
    const pays = request.headers.get("x-vercel-ip-country");
    const locale = pays
      ? localePourPays(pays)
      : (localePourAcceptLanguage(request.headers.get("accept-language")) ?? "en");
    response.cookies.set(COOKIE_LOCALE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp|mp4|webm)$).*)"],
};
