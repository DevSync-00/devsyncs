"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents() {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("main h2, main h3"));
    const items: TOCItem[] = elements.map((el, idx) => {
      if (!el.id) {
        el.id = `heading-${idx}`;
      }
      return {
        id: el.id,
        text: el.textContent || "",
        level: el.tagName === "H2" ? 2 : 3,
      };
    });
    setHeadings(items);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -60% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <aside className="w-56 shrink-0 space-y-3 font-mono text-xs hidden xl:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
        <List className="h-3.5 w-3.5" /> On This Page
      </div>
      <div className="space-y-1 border-l border-border/60 pl-3">
        {headings.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block truncate transition-all ${
              item.level === 3 ? "pl-3 text-[11px]" : "font-medium"
            } ${
              activeId === item.id
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.text}
          </a>
        ))}
      </div>
    </aside>
  );
}
