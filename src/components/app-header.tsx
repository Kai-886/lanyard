"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Command, Moon, Plus, Sun } from "lucide-react";
import { useEffect } from "react";
import { Kbd, cx } from "@/components/ui";
import { useTheme } from "@/components/theme";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/leads", label: "Rail" },
  { href: "/events", label: "Events" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggle } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("lanyard:palette", { detail: { open: true } }));
      }
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (typing) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        router.push("/leads/new");
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("lanyard:focus-search"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const openPalette = () =>
    window.dispatchEvent(new CustomEvent("lanyard:palette", { detail: { open: true } }));

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-paper-3 bg-paper/88 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-ink text-[13px] font-black text-paper transition-transform group-hover:-rotate-6">
              L
            </span>
            <span className="display hidden text-[17px] tracking-tight sm:block">Lanyard</span>
          </Link>

          <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative rounded-[3px] px-3 py-2 text-sm transition-colors",
                    active ? "text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-[1px] h-[2px] bg-signal" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={openPalette}
              className="hairline hidden h-9 cursor-pointer items-center gap-2 rounded-[3px] bg-paper-2 px-3 text-ink-3 transition-colors hover:text-ink sm:flex"
              aria-label="Open command palette"
            >
              <Command size={14} aria-hidden />
              <span className="meta">Search</span>
              <Kbd>⌘K</Kbd>
            </button>

            <button
              type="button"
              onClick={toggle}
              aria-label={mode === "dark" ? "Switch to light mode" : "Switch to backstage (dark) mode"}
              className="hairline flex h-9 w-9 cursor-pointer items-center justify-center rounded-[3px] text-ink-2 transition-colors hover:text-ink"
            >
              {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <Link
              href="/leads/new"
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[3px] bg-signal px-3 text-[13px] font-semibold text-on-signal transition-transform hover:brightness-105 active:translate-y-px"
            >
              <Plus size={15} aria-hidden />
              New lead
            </Link>
          </div>
        </div>
      </div>
      {/* Woven lanyard rule — 6px diagonal band (PRD §8.4). */}
      <div className="lanyard" style={{ ["--lanyard" as string]: "var(--signal)" }} />
    </header>
  );
}
