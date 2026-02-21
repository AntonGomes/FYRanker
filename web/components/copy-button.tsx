"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { COPY_FEEDBACK_DURATION_MS } from "@/lib/constants";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      title="Copy address"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
