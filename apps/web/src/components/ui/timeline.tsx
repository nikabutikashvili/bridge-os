import type { ReactNode } from "react";

interface TimelineProps {
  readonly children: ReactNode;
  readonly label: string;
}

export function Timeline({ children, label }: TimelineProps): React.ReactElement {
  return (
    <ol aria-label={label} className="m-0 list-none p-0">
      {children}
    </ol>
  );
}

interface TimelineItemProps {
  readonly children?: ReactNode;
  readonly date: string;
  readonly meta?: ReactNode;
  readonly title: string;
}

export function TimelineItem({
  children,
  date,
  meta,
  title
}: TimelineItemProps): React.ReactElement {
  return (
    <li className="relative grid min-h-[62px] grid-cols-[88px_12px_minmax(0,1fr)] gap-x-3 last:[&_[data-slot=timeline-line]]:hidden">
      <span
        aria-hidden="true"
        className="absolute top-3 col-start-2 h-full w-px justify-self-center bg-border"
        data-slot="timeline-line"
      />
      <span
        aria-hidden="true"
        className="relative z-10 col-start-2 mt-1.5 size-2 justify-self-center bg-foreground"
      />
      <time className="col-start-1 row-start-1 pt-0.5 text-right font-mono text-[11px] tabular-nums leading-4 text-muted-foreground">
        {date}
      </time>
      <div className="col-start-3 row-start-1 min-w-0 pb-[18px]">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="m-0 text-[13px] font-medium leading-5">{title}</h3>
          {meta ? <span className="text-[11px] leading-4 text-muted-foreground">{meta}</span> : null}
        </div>
        {children ? (
          <div className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{children}</div>
        ) : null}
      </div>
    </li>
  );
}
