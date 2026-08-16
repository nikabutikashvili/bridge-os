"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface BridgePhotoProps {
  readonly alt: string;
  readonly src: string;
  readonly variant: "header" | "thumb";
}

export function BridgePhoto({
  alt,
  src,
  variant
}: BridgePhotoProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          aria-label={variant === "thumb" ? alt : `Enlarge ${alt}`}
          className={cn(
            "block shrink-0 cursor-zoom-in overflow-hidden bg-surface-subtle p-0",
            variant === "header"
              ? "h-[108px] w-[160px] border border-border"
              : "h-8 w-11 border border-border"
          )}
          onClick={(event) => event.stopPropagation()}
          type="button"
        >
          {/* Cross-origin API JPEGs are not in the Next image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="block size-full object-cover" src={src} />
        </button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "flex max-w-[min(92vw,960px)] items-center justify-center border-0 bg-transparent p-0 shadow-none",
          "[&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/15 [&_[data-slot=dialog-close]]:hover:text-white"
        )}
        showCloseButton
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className="max-h-[min(86vh,720px)] max-w-full border border-border-strong bg-card object-contain"
          src={src}
        />
      </DialogContent>
    </Dialog>
  );
}
