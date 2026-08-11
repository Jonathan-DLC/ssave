"use client";

import { cn } from "@/lib/utils";
import { Music, Video } from "lucide-react";

export type Format = "mp4" | "mp3";

interface FormatSelectorProps {
  selected: Format;
  onSelect: (format: Format) => void;
}

export function FormatSelector({ selected, onSelect }: FormatSelectorProps) {
  return (
    <div className="flex gap-2 animate-scale-in">
      {/* MP4 Option */}
      <button
        type="button"
        onClick={() => onSelect("mp4")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
          selected === "mp4"
            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
            : "bg-white/60 dark:bg-black/40 text-foreground border-border hover:bg-white dark:hover:bg-black/60 hover:border-primary/30"
        )}
      >
        <Video className="w-4 h-4" />
        <span>MP4</span>
        <span className="text-[10px] opacity-70 font-normal">Video</span>
      </button>

      {/* MP3 Option */}
      <button
        type="button"
        onClick={() => onSelect("mp3")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
          selected === "mp3"
            ? "bg-secondary text-secondary-foreground border-secondary shadow-md shadow-secondary/20"
            : "bg-white/60 dark:bg-black/40 text-foreground border-border hover:bg-white dark:hover:bg-black/60 hover:border-secondary/30"
        )}
      >
        <Music className="w-4 h-4" />
        <span>MP3</span>
        <span className="text-[10px] opacity-70 font-normal">Audio</span>
      </button>
    </div>
  );
}
