"use client";

import { Command } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, FileDown, Moon, Plus, Sun, UserRound } from "lucide-react";
import { Kbd, cx } from "@/components/ui";
import { useTheme } from "@/components/theme";

type Action = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const reduce = useReducedMotion();
  const { toggle } = useTheme();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail;
      setOpen(detail?.open ?? true);
      setQuery("");
    };
    window.addEventListener("lanyard:palette", handler);
    return () => window.removeEventListener("lanyard:palette", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (href: string) => () => {
    setOpen(false);
    router.push(href);
  };

  const actions: Action[] = [
    { id: "new", label: "Capture a new lead", hint: "N", run: go("/leads/new") },
    { id: "rail", label: "Open the rail", hint: "All badges", run: go("/leads") },
    { id: "events", label: "Open events", run: go("/events") },
    { id: "settings", label: "Open settings", run: go("/settings") },
    { id: "due", label: "Show overdue follow-ups", run: go("/leads?due=overdue") },
    { id: "today", label: "Show follow-ups due today", run: go("/leads?due=today") },
    { id: "hot", label: "Show hot leads", run: go("/leads?sort=temperature") },
    {
      id: "export",
      label: "Export all leads as CSV",
      run: () => {
        setOpen(false);
        // Anchor click keeps the browser's download behaviour without touching
        // window.location (which the compiler treats as immutable).
        const a = document.createElement("a");
        a.href = "/api/export";
        a.rel = "noopener";
        a.click();
      },
    },
    {
      id: "theme",
      label: "Toggle light / backstage",
      run: () => {
        toggle();
        setOpen(false);
      },
    },
  ];

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-90 flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.14 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgb(var(--shadow-color)/0.55)] backdrop-blur-[3px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0.7, 0.3, 1] }}
            className="ticket hairline relative z-10 w-full max-w-xl overflow-hidden rounded-[4px]"
          >
            <div className="lanyard" />
            <Command loop label="Command palette">
              <div className="flex items-center gap-2 border-b border-paper-3 px-4 py-3">
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Jump to a badge, view or action…"
                  autoFocus
                  className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
                />
                <Kbd>Esc</Kbd>
              </div>

              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">
                  Nothing matches “{query}”.
                </Command.Empty>

                <Command.Group heading="Actions" className="flex flex-col gap-0.5">
                  {filtered.map((a) => (
                    <CommandItem key={a.id} action={a}>
                      {a.label}
                    </CommandItem>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  new: <Plus size={15} />,
  rail: <UserRound size={15} />,
  events: <CalendarDays size={15} />,
  export: <FileDown size={15} />,
  theme: <Moon size={15} />,
};

function CommandItem({ action, children }: { action: Action; children: React.ReactNode }) {
  return (
    <Command.Item
      value={`${action.label} ${action.hint ?? ""}`}
      onSelect={action.run}
      className={cx(
        "flex cursor-pointer items-center gap-2.5 rounded-[3px] px-3 py-2 text-sm text-ink-2",
        "data-[selected=true]:bg-paper-2 data-[selected=true]:text-ink",
      )}
    >
      <span className="text-ink-3">{ICONS[action.id] ?? <Sun size={15} />}</span>
      <span className="flex-1 truncate">{children}</span>
      {action.hint ? <span className="meta text-ink-3">{action.hint}</span> : null}
    </Command.Item>
  );
}
