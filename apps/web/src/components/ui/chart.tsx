"use client";

import * as RechartsPrimitive from "recharts";

import { cn } from "../../lib/cn";

export interface ChartConfigEntry {
  readonly color?: string;
  readonly label?: React.ReactNode;
}

export type ChartConfig = Record<string, ChartConfigEntry>;

interface ChartContainerProps {
  readonly children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"];
  readonly className?: string;
  readonly config: ChartConfig;
}

export function ChartContainer({
  children,
  className,
  config
}: ChartContainerProps): React.ReactElement {
  const colorVars = Object.fromEntries(
    Object.entries(config)
      .filter((entry): entry is [string, { color: string }] => entry[1].color !== undefined)
      .map(([key, entry]) => [`--color-${key}`, entry.color])
  ) as React.CSSProperties;

  return (
    <div className={cn("h-full w-full", className)} style={colorVars}>
      <RechartsPrimitive.ResponsiveContainer height="100%" width="100%">
        {children}
      </RechartsPrimitive.ResponsiveContainer>
    </div>
  );
}
