import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ssave — Descarga Videos de YouTube y X",
  description:
    "Descarga videos (MP4) y audio (MP3) de YouTube y X (Twitter) de forma rápida y sencilla. Pega tu enlace y descarga al instante.",
  keywords: ["descargar video", "youtube mp3", "youtube mp4", "twitter video", "convertidor"],
  openGraph: {
    title: "ssave — Descarga Videos de YouTube y X",
    description: "Descarga videos y audio de tus plataformas favoritas.",
    type: "website",
  },
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={plusJakarta.variable}>
      <body className="antialiased font-sans" style={{ fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif" }}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
