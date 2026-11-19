"use client";

import { Upload } from "lucide-react";
import { useState } from "react";

export function DropZone({ accept, onFile, onFiles, label }: { accept: string; onFile?: (f: File) => void; onFiles?: (f: File[]) => void; label: string }) {
  const take = (list: FileList | null | undefined) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (onFiles) onFiles(files);
    else onFile?.(files[0]!);
  };
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${over ? "border-accent bg-accent/8" : "border-border hover:border-accent/60"}`}
    >
      <Upload size={28} className="text-accent" />
      <span className="text-sm text-muted">{label}</span>
      <input type="file" accept={accept} multiple={!!onFiles} className="sr-only" onChange={(e) => take(e.target.files)} />
    </label>
  );
}

