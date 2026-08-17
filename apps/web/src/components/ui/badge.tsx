import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] leading-none",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        secondary: "border-border bg-muted text-muted-foreground",
        outline: "border-border-strong bg-transparent text-muted-foreground",
        neutral: "border-border bg-muted text-foreground",
        success: "border-success/35 bg-success-bg text-success",
        warning: "border-warning/35 bg-warning-bg text-warning",
        critical: "border-critical/35 bg-critical-bg text-critical",
        info: "border-info/35 bg-info-bg text-info"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  readonly asChild?: boolean;
}

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: BadgeProps): React.ReactElement {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      className={cn(badgeVariants({ variant, className }))}
      data-slot="badge"
      {...props}
    />
  );
}

export { Badge, badgeVariants };
