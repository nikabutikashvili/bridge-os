import {
  RouteTabsCount,
  RouteTabsList,
  RouteTabsTrigger
} from "../../components/ui/route-tabs";
import {
  workPackageListHref,
  type WorkPackageListView
} from "./work-package-query";

interface WorkPackageTabsProps {
  readonly draftCount: number;
  readonly queueCount: number;
  readonly view: WorkPackageListView;
}

export function WorkPackageTabs({
  draftCount,
  queueCount,
  view
}: WorkPackageTabsProps): React.ReactElement {
  return (
    <RouteTabsList aria-label="Work package register" className="shrink-0 px-2">
      <RouteTabsTrigger href={workPackageListHref("drafts")} isActive={view === "drafts"}>
        <span>Drafts</span>
        <RouteTabsCount>{draftCount}</RouteTabsCount>
      </RouteTabsTrigger>
      <RouteTabsTrigger href={workPackageListHref("queue")} isActive={view === "queue"}>
        <span>Creation queue</span>
        <RouteTabsCount>{queueCount}</RouteTabsCount>
      </RouteTabsTrigger>
    </RouteTabsList>
  );
}
