import * as React from "react";

import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">): React.ReactElement {
  return (
    <input
      className={cn(
        "flex h-7 w-full min-w-0 rounded-sm border border-border-strong bg-transparent px-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground",
        "hover:border-foreground/40",
        "focus-visible:border-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
