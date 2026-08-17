"use client";

import {
  AlertTriangle,
  Landmark,
  LoaderCircle,
  Search,
  Wrench
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";

import { cn } from "@/lib/utils";

import { searchGlobalRecords } from "./api";
import {
  buildGlobalSearchGroups,
  flattenGlobalSearchOptions,
  type GlobalSearchGroupKey,
  type GlobalSearchOption
} from "./search-model";

const SEARCH_DELAY_MS = 180;

export function GlobalSearch(): React.ReactElement {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<Awaited<
    ReturnType<typeof searchGlobalRecords>
  > | null>(null);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmedQuery = query.trim();
  const groups = useMemo(
    () => (response === null ? [] : buildGlobalSearchGroups(response)),
    [response]
  );
  const options = useMemo(() => flattenGlobalSearchOptions(groups), [groups]);
  const panelOpen = focused && trimmedQuery.length >= 2;

  useEffect(() => {
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    const onDocumentPointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
    };
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResponse(null);
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const timeout = window.setTimeout(() => {
      searchGlobalRecords(trimmedQuery, controller.signal)
        .then((result) => {
          setResponse(result);
          setActiveIndex(-1);
        })
        .catch((searchError: unknown) => {
          if (
            !(searchError instanceof DOMException) ||
            searchError.name !== "AbortError"
          ) {
            setResponse(null);
            setError(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedQuery]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
      return;
    }
    if (options.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const start = current < 0 ? (direction > 0 ? -1 : 0) : current;
        return (start + direction + options.length) % options.length;
      });
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      const selected = options[activeIndex];
      if (selected !== undefined) {
        event.preventDefault();
        setFocused(false);
        router.push(selected.href);
      }
    }
  };

  return (
    <div className="relative w-[min(360px,38vw)]" ref={rootRef}>
      <label className="flex h-7 w-full items-center gap-2 border border-white/25 bg-white/10 px-2 text-chrome-muted transition-colors focus-within:border-white/60">
        <span className="sr-only">Search bridge records</span>
        {loading ? (
          <LoaderCircle aria-hidden="true" className="shrink-0 animate-spin" size={14} />
        ) : (
          <Search aria-hidden="true" className="shrink-0" size={14} strokeWidth={1.8} />
        )}
        <input
          aria-activedescendant={
            activeIndex < 0 ? undefined : options[activeIndex]?.domId
          }
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-expanded={panelOpen}
          aria-label="Search bridges, findings, and recommendations"
          autoComplete="off"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] text-chrome-foreground outline-none placeholder:text-chrome-muted"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search objects"
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />
        <kbd className="pointer-events-none hidden h-4 shrink-0 items-center font-mono text-[10px] tracking-[0.08em] text-chrome-muted sm:inline-flex">
          ⌘K
        </kbd>
      </label>

      {panelOpen ? (
        <div
          aria-label="Global search results"
          className="absolute right-0 top-[calc(100%+4px)] z-30 max-h-[min(620px,72vh)] w-[min(520px,calc(100vw-32px))] overflow-y-auto border border-border bg-popover text-popover-foreground shadow-md"
          id="global-search-results"
          role="listbox"
        >
          <SearchResults
            activeIndex={activeIndex}
            error={error}
            groups={groups}
            loading={loading}
            onClose={() => setFocused(false)}
            onHover={setActiveIndex}
            options={options}
          />
        </div>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {loading
          ? "Searching"
          : response === null
            ? ""
            : `${String(options.length)} search results shown`}
      </span>
    </div>
  );
}

function SearchResults({
  activeIndex,
  error,
  groups,
  loading,
  onClose,
  onHover,
  options
}: {
  readonly activeIndex: number;
  readonly error: boolean;
  readonly groups: ReturnType<typeof buildGlobalSearchGroups>;
  readonly loading: boolean;
  readonly onClose: () => void;
  readonly onHover: (index: number) => void;
  readonly options: readonly GlobalSearchOption[];
}): React.ReactElement {
  if (error) {
    return <p className="p-4 text-center text-xs text-critical">Search is unavailable.</p>;
  }
  if (loading && options.length === 0) {
    return <p className="p-4 text-center text-xs text-muted-foreground">Searching records...</p>;
  }
  if (!loading && options.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">No matching bridge records.</p>
    );
  }

  let optionIndex = 0;
  return (
    <>
      {groups.map((group) => {
        if (group.options.length === 0) return null;
        return (
          <section className="[&+&]:border-t [&+&]:border-border-strong" key={group.key}>
            <header className="flex items-center justify-between bg-surface-subtle px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{group.label}</span>
              <span>{String(group.totalItems)}</span>
            </header>
            <div>
              {group.options.map((option) => {
                const currentIndex = optionIndex;
                optionIndex += 1;
                const isActive = currentIndex === activeIndex;
                return (
                  <Link
                    aria-selected={isActive}
                    className={cn(
                      "grid min-h-12 grid-cols-[20px_minmax(0,1fr)] items-start gap-2 border-t border-border px-2.5 py-1.5 first:border-t-0",
                      isActive ? "bg-secondary" : "hover:bg-secondary"
                    )}
                    href={option.href}
                    id={option.domId}
                    key={option.key}
                    onClick={onClose}
                    onMouseEnter={() => onHover(currentIndex)}
                    role="option"
                    tabIndex={-1}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-5 items-center justify-center border border-border",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <SearchResultIcon group={option.group} />
                    </span>
                    <span className="grid min-w-0 gap-0">
                      <strong className="truncate text-xs font-semibold leading-[17px] text-foreground">
                        {option.title}
                      </strong>
                      <span className="truncate text-[11px] leading-4 text-muted-foreground">
                        {option.detail}
                      </span>
                      <small className="truncate text-[10px] leading-[15px] text-text-subtle">
                        {option.context}
                      </small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

function SearchResultIcon({
  group
}: {
  readonly group: GlobalSearchGroupKey;
}): React.ReactElement {
  if (group === "bridges") return <Landmark size={15} strokeWidth={1.8} />;
  if (group === "findings") return <AlertTriangle size={15} strokeWidth={1.8} />;
  return <Wrench size={15} strokeWidth={1.8} />;
}
