"use client";

import type { ReactNode } from "react";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "./sheet";

interface DetailPanelProps {
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: string;
}

export function DetailPanel({
  children,
  eyebrow,
  onClose,
  open,
  title
}: DetailPanelProps): React.ReactElement {
  return (
    <Sheet onOpenChange={(next) => (next ? undefined : onClose())} open={open}>
      <SheetContent aria-describedby={undefined} className="sm:max-w-[600px]">
        <SheetHeader>
          <div className="min-w-0">
            {eyebrow ? <SheetDescription>{eyebrow}</SheetDescription> : null}
            <SheetTitle className="truncate">{title}</SheetTitle>
          </div>
        </SheetHeader>
        <SheetBody className="px-[18px] pb-7">{children}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}
