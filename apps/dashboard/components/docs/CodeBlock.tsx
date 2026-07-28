"use client";

import { useState } from "react";
import { Check, Clipboard, Terminal } from "lucide-react";

interface CodeBlockProps {
  children?: string;
  language?: string;
  tabs?: { label: string; code: string }[];
}

export default function CodeBlock({ children, language = "bash", tabs }: CodeBlockProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentCode = (tabs ? tabs[activeTab]?.code : children) || "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCode.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative my-6 overflow-hidden rounded-xl border border-glass bg-card/90 backdrop-blur-xl shadow-xl font-mono text-xs">
      {/* Top Header Bar with Tabs or Language Indicator */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2 text-muted-foreground text-[11px]">
        {tabs ? (
          <div className="flex items-center gap-1">
            {tabs.map((tab, idx) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-all ${
                  activeTab === idx
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "hover:text-foreground text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 font-semibold text-foreground/80">
            <Terminal className="h-3.5 w-3.5 text-primary" />
            <span>{language}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-card hover:text-foreground transition-colors"
          title="Copy snippet"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 font-bold" />
          ) : (
            <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 overflow-x-auto text-foreground/90 leading-6">
        <code>{currentCode.trim()}</code>
      </pre>
    </div>
  );
}
