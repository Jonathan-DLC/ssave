"use client";

import { Download } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

export function Header() {
  return (
    <header className="w-full py-6 px-4 animate-fade-in">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
            <Download className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            s<span className="text-primary">save</span>
          </h1>
        </div>
        
        <div className="flex items-center p-1 rounded-xl bg-white/50 dark:bg-[#1a1a1a] border border-border/50 shadow-sm backdrop-blur-md">
          <ThemeToggle />
          <div className="w-px h-4 bg-border/60 mx-1" />
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
