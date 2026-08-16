"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface BreadcrumbContextValue {
  readonly label: string | null;
  readonly setLabel: (label: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({
  children
}: {
  readonly children: ReactNode;
}): React.ReactElement {
  const [label, setLabel] = useState<string | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ label, setLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

function useBreadcrumbContext(): BreadcrumbContextValue {
  const context = useContext(BreadcrumbContext);
  if (context === null) {
    throw new Error("Breadcrumb components must be used within BreadcrumbProvider");
  }
  return context;
}

export function useBreadcrumbLabel(): string | null {
  return useBreadcrumbContext().label;
}

/**
 * Renders nothing. Lets a leaf page override the shell's breadcrumb (e.g. with
 * a bridge name) without the persistent AppShell having to re-render per-route.
 */
export function BreadcrumbOverride({
  label
}: {
  readonly label: string;
}): null {
  const { setLabel } = useBreadcrumbContext();
  useEffect(() => {
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
  return null;
}
