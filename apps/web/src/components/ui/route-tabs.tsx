import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Visually mirrors shadcn's Tabs (underline indicator, muted/active text) but
 * is built from `nav` + `next/link` rather than Radix `Tabs`. The tab groups
 * in this app are URL/search-param driven — each "tab" is a real navigation
 * that triggers a fresh RSC data fetch — so wrapping them in Radix `Tabs`
 * (which owns selection state itself) would silently convert them to
 * client-only switching and break per-tab server fetch / URL-shareability.
 *
 * `variant="underline"` is a borderless strip (bridge/planning detail
 * sub-nav); `variant="card"` is a bordered strip with rounded top corners
 * meant to sit directly above a table frame with rounded bottom corners,
 * so the two visually merge into one card.
 */
interface RouteTabsListProps {
  readonly "aria-label": string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly sticky?: boolean;
  readonly variant?: "card" | "underline";
}

export function RouteTabsList({
  children,
  className,
  sticky = false,
  variant = "underline",
  ...props
}: RouteTabsListProps): React.ReactElement {
  return (
    <nav
      className={cn(
        "flex min-w-0 items-stretch gap-1 overflow-x-auto",
        variant === "underline"
          ? "border-b border-border"
          : "border border-b-0 border-border bg-card",
        sticky ? "sticky top-0 z-10 bg-background" : undefined,
        className
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

interface RouteTabsTriggerProps extends Pick<LinkProps, "href"> {
  readonly children: ReactNode;
  readonly isActive: boolean;
}

export function RouteTabsTrigger({
  children,
  href,
  isActive
}: RouteTabsTriggerProps): React.ReactElement {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 text-[12px] font-medium text-muted-foreground transition-colors",
        "hover:text-foreground",
        isActive ? "border-b-foreground text-foreground" : undefined
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

export function RouteTabsCount({ children }: { readonly children: ReactNode }): React.ReactElement {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}
