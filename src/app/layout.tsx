import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "./service-worker";
import { FondAmbiance } from "./fond-ambiance";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Selah — le réseau du Réveil",
  description:
    "Communion mondiale, prière en temps réel, témoignages et adoration. Selah : pause, et médite.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
};

export const viewport: Viewport = { themeColor: "#d97706", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased dark`}>
      <body className="min-h-full bg-slate-950 text-white font-sans selection:bg-amber-500/30">
        {/* Fond « Paradis » : nuit profonde traversée de lumières dorées et
            turquoises — jamais d'aplat opaque. Ce dégradé est le socle peint
            immédiatement ; la photographie d'ambiance vient par-dessus quand
            la connexion le permet. */}
        <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-teal-950 to-slate-950">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />
        </div>
        <FondAmbiance>{children}</FondAmbiance>
        <ServiceWorker />
      </body>
    </html>
  );
}
