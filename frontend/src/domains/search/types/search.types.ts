export const SEARCH_CATEGORIES = [
  "all",
  "tasks",
  "projects",
  "people",
  "audit",
  "apps",
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export type SearchResultType = "project" | "task" | "user" | "audit" | "app";

export type GlobalSearchItem = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  href: string;
  updatedAt?: string;
  category: string;
};

export type GlobalSearchResponse = {
  items: GlobalSearchItem[];
  availableCategories: SearchCategory[];
  facets: Partial<Record<Exclude<SearchCategory, "all">, number>>;
};

export type GlobalSearchParams = {
  q?: string;
  category?: SearchCategory;
  limit?: number;
};
