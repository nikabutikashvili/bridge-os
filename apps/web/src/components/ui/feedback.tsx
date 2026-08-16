import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

interface EmptyStateProps {
  readonly action?: ReactNode;
  readonly compact?: boolean;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly title: string;
}

export function EmptyState({
  action,
  compact = false,
  description,
  icon,
  title
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex min-h-[220px] items-center justify-center gap-3 text-left",
        compact ? "min-h-[218px]" : "border-y border-border py-7"
      )}
    >
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center border border-border text-muted-foreground"
      >
        {icon ?? <Inbox size={20} strokeWidth={1.6} />}
      </div>
      <div className="min-w-0 max-w-[360px]">
        <h3 className="m-0 text-[13px] font-semibold leading-5">{title}</h3>
        {description ? (
          <p className="m-0 mt-0.5 text-xs leading-4 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="ml-2 shrink-0">{action}</div> : null}
    </div>
  );
}

interface LoadingSkeletonProps {
  readonly label?: string;
  readonly lines?: number;
}

export function LoadingSkeleton({
  label = "Loading content",
  lines = 4
}: LoadingSkeletonProps): React.ReactElement {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-2.5 py-3.5" role="status">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          className={cn(
            "h-3 w-full",
            index % 3 === 1 ? "w-[82%]" : undefined,
            index % 3 === 2 ? "w-[64%]" : undefined
          )}
          key={index}
        />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  readonly action?: ReactNode;
  readonly actionHref?: string;
  readonly actionLabel?: string;
  readonly description: string;
  readonly title?: string;
}

export function ErrorState({
  action,
  actionHref,
  actionLabel = "Try again",
  description,
  title = "Unable to load data"
}: ErrorStateProps): React.ReactElement {
  return (
    <div
      className="flex min-h-16 items-center gap-3 rounded-lg border border-critical-border bg-critical-bg px-3 py-3 text-critical"
      role="alert"
    >
      <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <h3 className="m-0 text-[13px] font-semibold leading-[18px]">{title}</h3>
        <p className="m-0 mt-0.5 text-xs leading-[18px] text-critical-text-soft">{description}</p>
      </div>
      {action ?? (actionHref ? (
        <Link
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold text-foreground shadow-xs hover:bg-secondary"
          href={actionHref}
        >
          <RotateCw aria-hidden="true" size={14} />
          {actionLabel}
        </Link>
      ) : null)}
    </div>
  );
}
