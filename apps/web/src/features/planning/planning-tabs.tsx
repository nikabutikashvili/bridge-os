import type { PlanningResponse, PlanningView } from "@bridge-os/contracts";

import {
  RouteTabsCount,
  RouteTabsList,
  RouteTabsTrigger
} from "../../components/ui/route-tabs";
import { planningHref } from "./planning-query";

interface PlanningTabsProps {
  readonly summary: PlanningResponse["summary"];
  readonly view: PlanningView;
}

const tabs = [
  {
    count: "recommendedUnplanned",
    label: "Unplanned",
    title: "Recommended / unplanned",
    view: "recommended-unplanned"
  },
  { count: "planned", label: "Planned", title: "Planned", view: "planned" },
  { count: "budgeted", label: "Budgeted", title: "Budgeted", view: "budgeted" },
  {
    count: "tenderPreparation",
    label: "Tender prep",
    title: "Tender preparation",
    view: "tender-preparation"
  },
  {
    count: "tenderedReady",
    label: "Tendered",
    title: "Tendered / ready",
    view: "tendered-ready"
  },
  {
    count: "inProgress",
    label: "In progress",
    title: "In progress",
    view: "in-progress"
  },
  { count: "completed", label: "Completed", title: "Completed", view: "completed" }
] as const satisfies readonly {
  readonly count: keyof PlanningResponse["summary"];
  readonly label: string;
  readonly title: string;
  readonly view: PlanningView;
}[];

export function PlanningTabs({
  summary,
  view
}: PlanningTabsProps): React.ReactElement {
  return (
    <RouteTabsList
      aria-label="Maintenance planning lifecycle"
      className="shrink-0 px-2"
    >
      {tabs.map((tab) => (
        <RouteTabsTrigger
          href={planningHref(tab.view)}
          isActive={tab.view === view}
          key={tab.view}
        >
          <span title={tab.title}>{tab.label}</span>
          <RouteTabsCount>{summary[tab.count]}</RouteTabsCount>
        </RouteTabsTrigger>
      ))}
    </RouteTabsList>
  );
}
