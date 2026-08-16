import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-2.5 rounded-md border border-l-[3px] px-3.5 py-2.5",
  {
    variants: {
      variant: {
        warning: "border-warning-border border-l-warning bg-warning-bg text-warning",
        critical: "border-critical-border border-l-critical bg-critical-bg text-critical",
        info: "border-info-border border-l-info bg-info-bg text-info"
      }
    },
    defaultVariants: {
      variant: "warning"
    }
  }
);

interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps): React.ReactElement {
  return (
    <div
      className={cn(alertVariants({ variant, className }))}
      data-slot="alert"
      role="status"
      {...props}
    />
  );
}

function AlertBody({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div className={cn("grid min-w-0 flex-1 gap-0.5", className)} data-slot="alert-body" {...props} />
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<"strong">): React.ReactElement {
  return (
    <strong
      className={cn("text-[11px] leading-4", className)}
      data-slot="alert-title"
      {...props}
    />
  );
}

const alertDescriptionTextClasses: Record<NonNullable<AlertProps["variant"]>, string> = {
  warning: "text-warning-text-soft",
  critical: "text-critical-text-soft",
  info: "text-info"
};

function AlertDescription({
  className,
  variant = "warning",
  ...props
}: React.ComponentProps<"span"> &
  Pick<AlertProps, "variant"> & { variant?: NonNullable<AlertProps["variant"]> }): React.ReactElement {
  return (
    <span
      className={cn("text-[11px] leading-4", alertDescriptionTextClasses[variant], className)}
      data-slot="alert-description"
      {...props}
    />
  );
}

export { Alert, AlertBody, AlertDescription, AlertTitle };
