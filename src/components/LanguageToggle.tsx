"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Languages } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-8 px-2.5 font-medium transition-all text-muted-foreground hover:text-foreground"
      >
        <Languages className="h-4 w-4" />
        <span className="text-[13px]">{language === "en" ? "English" : "Spanish"}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-0.5" />
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-36 rounded-xl border border-border bg-background dark:bg-[#1a1a1a] shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1.5">
            <button
              onClick={() => { setLanguage("en"); setIsOpen(false); }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-muted transition-colors text-left"
            >
              English
              {language === "en" && <Check className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => { setLanguage("es"); setIsOpen(false); }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-muted transition-colors text-left"
            >
              Spanish
              {language === "es" && <Check className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
