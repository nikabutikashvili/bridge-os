import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly description?: string;
  readonly eyebrow?: string;
  readonly title: string;
}

export function PageHeader({
  actions,
  description,
  eyebrow,
  title
}: PageHeaderProps): React.ReactElement {
  return (
    <header className="flex items-end justify-between gap-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="m-0 mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="m-0 text-[15px] font-medium leading-5 tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="m-0 mt-1 max-w-[42rem] text-[12px] leading-4 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

interface SectionHeaderProps {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly description?: string;
  readonly id?: string;
  readonly meta?: ReactNode;
  readonly title: string;
}

export function SectionHeader({
  actions,
  className,
  description,
  id,
  meta,
  title
}: SectionHeaderProps): React.ReactElement {
  return (
    <header className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2
            className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground"
            id={id}
          >
            {title}
          </h2>
          {meta ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="m-0 mt-0.5 text-[12px] leading-4 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
