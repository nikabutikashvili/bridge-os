import { RouteTabsList, RouteTabsTrigger } from "../../components/ui/route-tabs";
import {
  bridgeDetailHref,
  type BridgeDetailTab
} from "./detail-model";

interface BridgeDetailTabsProps {
  readonly activeTab: BridgeDetailTab;
  readonly bridgeId: string;
}

const tabs: readonly { readonly label: string; readonly value: BridgeDetailTab }[] = [
  { label: "Overview", value: "overview" },
  { label: "Inspections", value: "inspections" },
  { label: "Findings", value: "findings" },
  { label: "Recommendations", value: "recommendations" },
  { label: "Technical data", value: "technical" },
  { label: "Documents / Evidence", value: "documents" }
];

export function BridgeDetailTabs({
  activeTab,
  bridgeId
}: BridgeDetailTabsProps): React.ReactElement {
  return (
    <div className="sticky top-0 z-10 mt-4 border-b border-border-strong bg-background px-4">
      <RouteTabsList aria-label="Bridge detail sections" className="border-b-0">
        {tabs.map((tab) => (
          <RouteTabsTrigger
            href={bridgeDetailHref(bridgeId, tab.value)}
            isActive={activeTab === tab.value}
            key={tab.value}
          >
            {tab.label}
          </RouteTabsTrigger>
        ))}
      </RouteTabsList>
    </div>
  );
}
