"use client";

import * as React from "react";

type Language = "en" | "es";

interface Translations {
  [key: string]: string;
}

const en: Translations = {
  headerTitle: "ssave",
  pasteLink: "Paste your link",
  supportedPlatforms: "YouTube or X (Twitter) — Download as MP4 or MP3",
  download: "Download",
  downloading: "Downloading...",
  error: "Error",
  success: "Downloaded!",
  mp3OnlyYT: "Only YT",
  footerDesc: "Download video and audio from your favorite platforms.",
  footerCopyright: "© {year} ssave — For personal use only.",
  detected: "detected",
  placeholderUrl: "https://x.com/username/status/...",
};

const es: Translations = {
  headerTitle: "ssave",
  pasteLink: "Pega tu enlace",
  supportedPlatforms: "YouTube o X (Twitter) — Descarga en MP4 o MP3",
  download: "Descargar",
  downloading: "Descargando...",
  error: "Error",
  success: "¡Descargado!",
  mp3OnlyYT: "Solo YT",
  footerDesc: "Descarga videos y audio de tus plataformas favoritas.",
  footerCopyright: "© {year} ssave — Solo para uso personal.",
  detected: "detectado",
  placeholderUrl: "https://x.com/username/status/...",
};

const translations: Record<Language, Translations> = { en, es };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("en");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("language") as Language;
    if (saved === "en" || saved === "es") {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string, params?: Record<string, string>) => {
    let text = translations[language][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  // Prevent hydration mismatch by rendering children directly, but t() works on client side
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {mounted ? children : <div className="opacity-0">{children}</div>}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
