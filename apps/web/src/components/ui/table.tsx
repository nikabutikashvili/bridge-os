"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  ...props
}: React.ComponentProps<"table">): React.ReactElement {
  return (
    <div className="relative w-full overflow-x-auto" data-slot="table-container">
      <table
        className={cn("w-full caption-bottom text-[13px] leading-5", className)}
        data-slot="table"
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">): React.ReactElement {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-chrome text-chrome-foreground [&_tr]:border-b [&_tr]:border-chrome",
        className
      )}
      data-slot="table-header"
      {...props}
    />
  );
}

function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">): React.ReactElement {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      {...props}
    />
  );
}

function TableRow({
  className,
  ...props
}: React.ComponentProps<"tr">): React.ReactElement {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors hover:bg-row-hover data-[state=selected]:bg-secondary",
        className
      )}
      data-slot="table-row"
      {...props}
    />
  );
}

function TableHead({
  className,
  ...props
}: React.ComponentProps<"th">): React.ReactElement {
  return (
    <th
      className={cn(
        "h-8 whitespace-nowrap px-3 text-left align-middle font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-chrome-foreground",
        className
      )}
      data-slot="table-head"
      scope="col"
      {...props}
    />
  );
}

function TableCell({
  className,
  ...props
}: React.ComponentProps<"td">): React.ReactElement {
  return (
    <td
      className={cn("px-3 py-2 align-middle", className)}
      data-slot="table-cell"
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">): React.ReactElement {
  return (
    <caption
      className={cn("sr-only", className)}
      data-slot="table-caption"
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
};
