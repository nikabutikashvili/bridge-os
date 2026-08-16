import {
  RouteTabsCount,
  RouteTabsList,
  RouteTabsTrigger
} from "../../components/ui/route-tabs";
import { documentListHref, type DocumentListView } from "./document-query";

interface DocumentTabsProps {
  readonly healthCount: number;
  readonly registerCount: number;
  readonly view: DocumentListView;
}

export function DocumentTabs({
  healthCount,
  registerCount,
  view
}: DocumentTabsProps): React.ReactElement {
  return (
    <RouteTabsList aria-label="Document workspace" className="shrink-0 px-2">
      <RouteTabsTrigger href={documentListHref("register")} isActive={view === "register"}>
        <span>Register</span>
        <RouteTabsCount>{registerCount}</RouteTabsCount>
      </RouteTabsTrigger>
      <RouteTabsTrigger href={documentListHref("health")} isActive={view === "health"}>
        <span>Data health</span>
        <RouteTabsCount>{healthCount}</RouteTabsCount>
      </RouteTabsTrigger>
    </RouteTabsList>
  );
}
