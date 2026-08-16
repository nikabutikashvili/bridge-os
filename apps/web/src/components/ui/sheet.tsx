"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Sheet({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>): React.ReactElement {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>): React.ReactElement {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>): React.ReactElement {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>): React.ReactElement {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>): React.ReactElement {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  );
}

const sheetSideClasses = {
  right:
    "inset-y-3 right-3 h-[calc(100dvh-1.5rem)] w-full max-w-[600px] rounded-xl border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  left: "inset-y-3 left-3 h-[calc(100dvh-1.5rem)] w-full max-w-[600px] rounded-xl border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  top: "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  bottom:
    "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
} as const;

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  readonly side?: "bottom" | "left" | "right" | "top";
  readonly showCloseButton?: boolean;
}): React.ReactElement {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col gap-0 overflow-hidden border-border bg-card text-card-foreground shadow-[var(--shadow-panel)] outline-none",
          "data-[state=open]:animate-in data-[state=open]:duration-200",
          "data-[state=closed]:animate-out data-[state=closed]:duration-150",
          sheetSideClasses[side],
          className
        )}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            className="absolute top-3.5 right-3.5 rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/20"
            data-slot="sheet-close"
          >
            <XIcon size={17} />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3.5",
        className
      )}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetBody({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      data-slot="sheet-body"
      {...props}
    />
  );
}

function SheetFooter({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3",
        className
      )}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>): React.ReactElement {
  return (
    <SheetPrimitive.Title
      className={cn("text-sm font-semibold leading-5 text-foreground", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>): React.ReactElement {
  return (
    <SheetPrimitive.Description
      className={cn("text-[10px] font-bold uppercase tracking-wide text-primary", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
};
