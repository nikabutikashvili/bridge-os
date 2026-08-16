"use client";

import type { BridgePortfolioQuery } from "@bridge-os/contracts";
import { ListFilter, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface PortfolioFiltersProps {
  readonly query: BridgePortfolioQuery;
}

const inspectionOptions = [
  { label: "Any due state", value: "" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Due within 180 days", value: "DUE_SOON" },
  { label: "Current", value: "CURRENT" },
  { label: "Unknown", value: "UNKNOWN" }
] as const;

const findingOptions = [
  { label: "Any finding state", value: "" },
  { label: "With open findings", value: "true" },
  { label: "Without open findings", value: "false" }
] as const;

const urgencyOptions = [
  { label: "Any urgency", value: "" },
  { label: "Immediate", value: "SOFORT" },
  { label: "Short term", value: "KURZFRISTIG" },
  { label: "Medium term", value: "MITTELFRISTIG" },
  { label: "Long term", value: "LANGFRISTIG" }
] as const;

const sortOptions = [
  { label: "Attention", value: "attention" },
  { label: "Condition", value: "condition" },
  { label: "Latest inspection", value: "latestInspection" },
  { label: "Age", value: "constructionYear" }
] as const;

const directionOptions = [
  { label: "Highest first", value: "desc" },
  { label: "Lowest first", value: "asc" }
] as const;

/** Radix `Select.Item` forbids an empty-string value, so "any" options use this sentinel instead. */
const SELECT_ANY_VALUE = "__any__";

export function PortfolioFilters({
  query
}: PortfolioFiltersProps): React.ReactElement {
  const router = useRouter();

  function applyFilters(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>
  ): void {
    event.preventDefault();
    const params = new URLSearchParams();

    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value.trim() !== "" && value !== SELECT_ANY_VALUE) {
        params.set(key, value.trim());
      }
    }
    if (params.get("sort") === "attention") {
      params.delete("sort");
    }
    if (params.get("direction") === "desc") {
      params.delete("direction");
    }

    const queryString = params.toString();
    router.push(queryString.length === 0 ? "/bridges" : `/bridges?${queryString}`);
  }

  return (
    <form
      action="/bridges"
      className="flex flex-wrap items-end gap-2"
      method="get"
      onSubmit={applyFilters}
    >
      <div className="grid min-w-[8.5rem] w-[10rem] gap-1">
        <Label htmlFor="filter-road">Road</Label>
        <Input
          defaultValue={query.road}
          id="filter-road"
          name="road"
          placeholder="A57"
          type="search"
        />
      </div>

      <SelectFilter
        defaultValue={query.inspectionStatus ?? ""}
        label="Inspection"
        name="inspectionStatus"
        options={inspectionOptions}
      />
      <SelectFilter
        defaultValue={
          query.hasOpenFinding === undefined ? "" : String(query.hasOpenFinding)
        }
        label="Findings"
        name="hasOpenFinding"
        options={findingOptions}
      />
      <SelectFilter
        defaultValue={query.recommendationUrgency ?? ""}
        label="Urgency"
        name="recommendationUrgency"
        options={urgencyOptions}
      />

      <RangeFields
        from={{
          defaultValue: query.conditionMin,
          label: "Minimum condition score",
          max: "4",
          min: "1",
          name: "conditionMin",
          placeholder: "Min",
          step: "0.1"
        }}
        legend="Condition"
        to={{
          defaultValue: query.conditionMax,
          label: "Maximum condition score",
          max: "4",
          min: "1",
          name: "conditionMax",
          placeholder: "Max",
          step: "0.1"
        }}
      />
      <RangeFields
        from={{
          defaultValue: query.constructionYearFrom,
          label: "Construction year from",
          max: "2200",
          min: "1700",
          name: "constructionYearFrom",
          placeholder: "From"
        }}
        legend="Year"
        to={{
          defaultValue: query.constructionYearTo,
          label: "Construction year to",
          max: "2200",
          min: "1700",
          name: "constructionYearTo",
          placeholder: "To"
        }}
      />

      <SelectFilter defaultValue={query.sort} label="Sort" name="sort" options={sortOptions} />
      <SelectFilter
        defaultValue={query.direction}
        label="Order"
        name="direction"
        options={directionOptions}
      />

      <div className="ml-auto flex shrink-0 items-center gap-1 pb-px">
        <Button size="sm" type="submit">
          <ListFilter aria-hidden="true" size={12} strokeWidth={1.6} />
          Apply
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/bridges">
            <X aria-hidden="true" size={12} strokeWidth={1.6} />
            Reset
          </Link>
        </Button>
      </div>
    </form>
  );
}

function RangeFields({
  from,
  legend,
  to
}: {
  readonly from: RangeInputProps;
  readonly legend: string;
  readonly to: RangeInputProps;
}): React.ReactElement {
  return (
    <div className="grid gap-1" role="group" aria-label={legend}>
      <Label>{legend}</Label>
      <div className="flex items-center gap-1">
        <RangeInput {...from} />
        <span aria-hidden="true" className="font-mono text-[10px] text-muted-foreground">
          /
        </span>
        <RangeInput {...to} />
      </div>
    </div>
  );
}

interface RangeInputProps {
  readonly defaultValue?: number | string | undefined;
  readonly label: string;
  readonly max: string;
  readonly min: string;
  readonly name: string;
  readonly placeholder: string;
  readonly step?: string | undefined;
}

function RangeInput({
  defaultValue,
  label,
  max,
  min,
  name,
  placeholder,
  step
}: RangeInputProps): React.ReactElement {
  return (
    <Input
      aria-label={label}
      className="w-14"
      defaultValue={defaultValue}
      max={max}
      min={min}
      name={name}
      placeholder={placeholder}
      step={step}
      type="number"
    />
  );
}

function SelectFilter({
  defaultValue,
  label,
  name,
  options
}: {
  readonly defaultValue?: string;
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly label: string; readonly value: string }[];
}): React.ReactElement {
  const id = `filter-${name}`;
  return (
    <div className="grid w-[9.25rem] gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Select
        defaultValue={defaultValue === undefined || defaultValue === "" ? SELECT_ANY_VALUE : defaultValue}
        name={name}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value === "" ? SELECT_ANY_VALUE : option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
