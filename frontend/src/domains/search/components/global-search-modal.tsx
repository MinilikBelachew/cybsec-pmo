"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useRouter } from "@/i18n/routing";
import {
  Search,
  X,
  Blocks,
  CheckSquare,
  FolderKanban,
  Users,
  ClipboardList,
  LayoutGrid,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  Link2,
  Loader2,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useGetGlobalSearchQuery } from "../api/search.api";
import type { GlobalSearchItem, SearchCategory } from "../types/search.types";

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_PILLS: {
  id: SearchCategory;
  label: string;
  icon: typeof Search;
}[] = [
  { id: "all", label: "All", icon: Search },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "people", label: "People", icon: Users },
  { id: "audit", label: "Audit", icon: ClipboardList },
  { id: "apps", label: "Apps", icon: LayoutGrid },
];

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getItemIcon(type: GlobalSearchItem["type"]) {
  switch (type) {
    case "project":
      return FolderKanban;
    case "task":
      return CheckSquare;
    case "user":
      return Users;
    case "audit":
      return ClipboardList;
    case "app":
      return LayoutGrid;
    default:
      return Search;
  }
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setCategory("all");
      setActiveIndex(0);
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data, isFetching, isLoading } = useGetGlobalSearchQuery(
    { q: debouncedQuery, category, limit: 10 },
    { skip: !open },
  );

  const visiblePills = useMemo(() => {
    const available = new Set(data?.availableCategories ?? ["all"]);
    return CATEGORY_PILLS.filter((pill) => available.has(pill.id));
  }, [data?.availableCategories]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, GlobalSearchItem[]>();
    for (const item of data?.items ?? []) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries());
  }, [data?.items]);

  const flatItems = useMemo(
    () => groupedItems.flatMap(([, items]) => items),
    [groupedItems],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, category, data?.items]);

  useEffect(() => {
    if (!groupedItems.length) return;
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const [groupName] of groupedItems) {
        if (next[groupName] === undefined) {
          next[groupName] = true;
        }
      }
      return next;
    });
  }, [groupedItems]);

  const navigateTo = (item: GlobalSearchItem, newTab = false) => {
    onClose();
    if (newTab) {
      window.open(item.href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(item.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(flatItems.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && flatItems[activeIndex]) {
      event.preventDefault();
      navigateTo(flatItems[activeIndex]);
    }
  };

  const activeItem = flatItems[activeIndex];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-[8vh] z-50 w-[min(720px,calc(100vw-2rem))] -translate-x-1/2",
            "rounded-2xl border border-border/80 bg-background shadow-2xl overflow-hidden",
            "transition duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95",
          )}
          onKeyDown={handleKeyDown}
        >
          <div className="border-b border-border/70">
            <div className="flex items-center gap-2 px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects, tasks, people, or type / for commands..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  disabled
                >
                  <Blocks className="size-3" />
                  Ask AI
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close search"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-none">
              {visiblePills.map((pill) => {
                const Icon = pill.icon;
                const selected = category === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setCategory(pill.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {pill.id !== "all" && <Icon className="size-3" />}
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[min(52vh,480px)] overflow-y-auto">
            <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {debouncedQuery ? "Results" : "Suggested"}
            </div>

            {(isLoading || isFetching) && !data ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching...
              </div>
            ) : groupedItems.length === 0 ? (
              <div className="px-4 pb-8 pt-2 text-sm text-muted-foreground">
                No results found for your role and permissions.
              </div>
            ) : (
              groupedItems.map(([groupName, items]) => {
                const expanded = expandedGroups[groupName] ?? true;
                const GroupIcon = getItemIcon(items[0]?.type ?? "app");

                return (
                  <div key={groupName} className="px-2 pb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [groupName]: !expanded,
                        }))
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/50"
                    >
                      <GroupIcon className="size-4 text-muted-foreground" />
                      <span className="flex-1 text-sm font-medium">{groupName}</span>
                      <ChevronRight
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          expanded && "rotate-90",
                        )}
                      />
                    </button>

                    {expanded &&
                      items.map((item) => {
                        const flatIndex = flatItems.findIndex(
                          (entry) => entry.id === item.id && entry.type === item.type,
                        );
                        const isActive = flatIndex === activeIndex;
                        const ItemIcon = getItemIcon(item.type);

                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            className={cn(
                              "group ml-6 mr-1 flex items-center gap-2 rounded-lg px-2 py-2",
                              isActive && "bg-primary/10 ring-1 ring-primary/20",
                            )}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                          >
                            <button
                              type="button"
                              onClick={() => navigateTo(item)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <ItemIcon className="size-3.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{item.title}</div>
                                {item.subtitle && (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {item.subtitle}
                                  </div>
                                )}
                              </div>
                              {item.updatedAt && (
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {formatRelativeTime(item.updatedAt)}
                                </span>
                              )}
                            </button>

                            {isActive && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(
                                      `${window.location.origin}${item.href}`,
                                    );
                                  }}
                                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                  aria-label="Copy link"
                                >
                                  <Link2 className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigateTo(item, true)}
                                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                  aria-label="Open in new tab"
                                >
                                  <ExternalLink className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigateTo(item)}
                                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"
                                >
                                  <CornerDownLeft className="size-3" />
                                  Enter
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>Type <kbd className="rounded border px-1">/</kbd> for commands</span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <kbd className="rounded border px-1">Tab</kbd> to select
              </span>
            </div>
            {activeItem && (
              <span className="truncate max-w-[40%] text-right">
                {activeItem.title}
              </span>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
