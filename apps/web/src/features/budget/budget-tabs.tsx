import {
  RouteTabsList,
  RouteTabsTrigger
} from "../../components/ui/route-tabs";
import {
  budgetProgramHref,
  budgetScenariosHref
} from "./budget-query";

interface BudgetTabsProps {
  readonly view: "scenarios" | "program" | "compare";
  readonly planningYear: number;
  readonly scenarioId: string | null;
}

export function BudgetTabs({
  view,
  planningYear,
  scenarioId
}: BudgetTabsProps): React.ReactElement {
  return (
    <RouteTabsList aria-label="Budget workspace" className="shrink-0 px-2">
      <RouteTabsTrigger
        href={budgetScenariosHref(scenarioId ?? undefined)}
        isActive={view === "scenarios" || view === "compare"}
      >
        Scenarios
      </RouteTabsTrigger>
      <RouteTabsTrigger
        href={budgetProgramHref(planningYear)}
        isActive={view === "program"}
      >
        Live programme
      </RouteTabsTrigger>
    </RouteTabsList>
  );
}
