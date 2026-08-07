import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Selah — le réseau du Réveil",
  description:
    "Communion mondiale, prière en temps réel, témoignages et adoration. Selah : pause, et médite.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = { themeColor: "#d97706" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-amber-50 font-sans text-stone-800">
        {children}
      </body>
    </html>
  );
}
