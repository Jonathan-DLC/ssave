"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="w-full py-6 px-4 mt-auto animate-fade-in" style={{ animationDelay: "0.4s", opacity: 0 }}>
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-xs text-muted-foreground">
          {t("footerDesc")}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {t("footerCopyright", { year: new Date().getFullYear().toString() })}
        </p>
      </div>
    </footer>
  );
}
