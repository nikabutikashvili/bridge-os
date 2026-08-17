"use client";

import {
  budgetScenarioResponseSchema,
  type BudgetScenarioResponse
} from "@bridge-os/contracts";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";

interface ScenarioSessionValue {
  readonly scenario: BudgetScenarioResponse | null;
  applyScenario: (next: BudgetScenarioResponse) => void;
}

const ScenarioSessionContext = createContext<ScenarioSessionValue | null>(null);

export function ScenarioSession({
  children,
  initial
}: {
  readonly children: ReactNode;
  readonly initial: BudgetScenarioResponse | null;
}): React.ReactElement {
  const [scenario, setScenario] = useState(initial);
  useEffect(() => {
    setScenario(initial);
  }, [initial]);

  return (
    <ScenarioSessionContext.Provider
      value={{ applyScenario: setScenario, scenario }}
    >
      {children}
    </ScenarioSessionContext.Provider>
  );
}

export function useScenarioSession(): ScenarioSessionValue {
  const value = useContext(ScenarioSessionContext);
  if (value === null) {
    throw new Error("useScenarioSession must be used within ScenarioSession.");
  }
  return value;
}

export async function readScenarioResponse(
  response: Response
): Promise<BudgetScenarioResponse> {
  if (!response.ok) {
    throw await mutationError(response);
  }
  return budgetScenarioResponseSchema.parse(await response.json());
}

export async function mutationError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return new Error(
    payload?.error?.message ?? `Request failed (${String(response.status)}).`
  );
}
