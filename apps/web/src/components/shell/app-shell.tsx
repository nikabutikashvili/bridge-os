"use client";

import {
  Archive,
  Calculator,
  ClipboardList,
  FileStack,
  Waypoints
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { GlobalSearch } from "../../features/search/global-search";
import { useBreadcrumbLabel } from "./breadcrumb-context";

export type NavigationItem =
  | "Budget"
  | "Documents"
  | "Planning"
  | "Portfolio"
  | "Work Packages";

const navigation = [
  { href: "/bridges", icon: Waypoints, label: "Portfolio" },
  { href: "/planning", icon: ClipboardList, label: "Planning" },
  { href: "/budget", icon: Calculator, label: "Budget" },
  { href: "/work-packages", icon: Archive, label: "Work Packages" },
  { href: "/documents", icon: FileStack, label: "Documents" }
] as const;

function resolveActiveItem(pathname: string): NavigationItem {
  const match = navigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.label ?? "Portfolio";
}

interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps): React.ReactElement {
  const pathname = usePathname();
  const activeItem = resolveActiveItem(pathname);
  const breadcrumbLabel = useBreadcrumbLabel();
  const isObjectSet =
    pathname === "/bridges" ||
    pathname === "/planning" ||
    pathname === "/budget" ||
    pathname === "/work-packages" ||
    pathname === "/documents";
  const isObjectView =
    pathname.startsWith("/bridges/") || pathname.startsWith("/work-packages/");

  return (
    <div className="grid h-screen grid-cols-[196px_minmax(0,1fr)] bg-background text-foreground">
      <aside
        aria-label="Primary navigation"
        className="flex min-h-0 min-w-0 flex-col border-r border-chrome bg-sidebar text-sidebar-text"
      >
        <Link
          aria-label="Bridge OS portfolio"
          className="flex h-9 items-center gap-2.5 border-b border-white/15 px-3"
          href="/bridges"
        >
          <span aria-hidden="true" className="grid size-3.5 grid-cols-2 gap-px">
            <span className="bg-chrome-foreground" />
            <span className="bg-chrome-foreground/35" />
            <span className="bg-chrome-foreground/35" />
            <span className="bg-chrome-foreground" />
          </span>
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] text-chrome-foreground">
            BRIDGE OS
          </span>
        </Link>

        <nav className="min-h-0 pt-4">
          <p className="px-3 mb-2 font-mono text-[10px] tracking-[0.18em] text-sidebar-muted">
            WORKSPACE
          </p>
          <ul className="m-0 grid list-none p-0">
            {navigation.map(({ href, icon: Icon, label }) => {
              const isActive = activeItem === label;
              return (
                <li key={label}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center gap-2.5 border-l-2 border-transparent px-3 text-[12px] text-sidebar-link transition-colors",
                      "hover:bg-sidebar-hover hover:text-chrome-foreground",
                      isActive
                        ? "border-l-chrome-foreground bg-sidebar-active text-chrome-foreground"
                        : undefined
                    )}
                    href={href}
                  >
                    <Icon aria-hidden="true" size={14} strokeWidth={1.6} />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="grid min-h-0 min-w-0 grid-rows-[36px_minmax(0,1fr)]">
        <header className="flex h-9 items-center justify-between gap-4 border-b border-chrome bg-chrome px-3 text-chrome-foreground">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-chrome-muted"
          >
            <Link className="hover:text-chrome-foreground" href="/bridges">
              BRIDGE OS
            </Link>
            <span aria-hidden="true" className="text-white/25">
              /
            </span>
            <span aria-current="page" className="truncate text-chrome-foreground">
              {(breadcrumbLabel ?? activeItem).toUpperCase()}
            </span>
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-3">
            <GlobalSearch />
            <span className="font-mono text-[10px] tracking-[0.18em] text-chrome-muted">
              DEMO
            </span>
          </div>
        </header>

        <main
          className={cn(
            "min-h-0 min-w-0",
            isObjectSet
              ? "flex flex-col overflow-hidden"
              : isObjectView
                ? "flex flex-col overflow-auto"
                : "grid content-start gap-4 overflow-auto p-4"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
