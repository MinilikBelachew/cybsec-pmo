import type {
  TaskDependency,
  TaskDependencyType,
} from "../types/tasks.types";
import { comparePlanOrderAsc } from "./task-export-fields";

export type ParsedGridPredecessor = {
  /** 1-based plan ID when the token starts with a number (MS Project style). */
  planId?: number;
  /** Fallback title match (Excel-style paste). */
  title?: string;
  depType: TaskDependencyType;
  lagDays: number;
};

export type DesiredPredecessorLink = {
  predecessorId: string;
  depType: TaskDependencyType;
  lagDays: number;
};

/** Links where the current task is the predecessor (outgoing / successors). */
export type DesiredSuccessorLink = {
  successorId: string;
  depType: TaskDependencyType;
  lagDays: number;
};

/** Flatten nested task rows and assign stable 1-based plan IDs (MPP Order). */
export function buildPlanIdMaps(
  tasks: { id: string; createdAt?: string; startDate?: string | null; title?: string; name?: string; children?: any[] }[],
): {
  idToPlanId: Map<string, number>;
  planIdToId: Map<number, string>;
  orderedIds: string[];
} {
  const flat: any[] = [];
  const walk = (t: any) => {
    flat.push(t);
    for (const c of t.children ?? []) walk(c);
  };
  for (const t of tasks) walk(t);

  flat.sort(comparePlanOrderAsc);

  const idToPlanId = new Map<string, number>();
  const planIdToId = new Map<number, string>();
  const orderedIds: string[] = [];
  let n = 1;
  for (const t of flat) {
    if (idToPlanId.has(t.id)) continue;
    idToPlanId.set(t.id, n);
    planIdToId.set(n, t.id);
    orderedIds.push(t.id);
    n += 1;
  }
  return { idToPlanId, planIdToId, orderedIds };
}

/** Display like MS Project: `3` | `3SS` | `14FS+3d` | `3,5FS+2d` */
export function formatPredecessorsGrid(
  taskId: string,
  dependencies: TaskDependency[],
  idToPlanId: Map<string, number>,
): string {
  const links = dependencies.filter((d) => d.successorId === taskId);
  if (links.length === 0) return "";

  return links
    .map((dep) => {
      const planId = idToPlanId.get(dep.predecessorId);
      const type = (dep.depType || "FS").toUpperCase() as TaskDependencyType;
      const lag = Number(dep.lagDays) || 0;
      const idPart =
        planId != null
          ? String(planId)
          : (dep.predecessor?.title || dep.predecessorId.slice(0, 8)).replace(
              /,/g,
              " ",
            );

      // MS Project: bare ID = FS + 0 lag; otherwise append type and/or +Nd
      if (type === "FS" && lag === 0) return idPart;
      if (lag === 0) return `${idPart}${type}`;
      const lagStr = lag > 0 ? `+${lag}d` : `${lag}d`;
      // Always show type when lag is present (e.g. 14FS+3d)
      return `${idPart}${type}${lagStr}`;
    })
    .join(",");
}

/**
 * Parse MS Project Predecessors field.
 * Examples: `3`, `3FS`, `14FS+3d`, `14FS+3 days`, `1,2SS`, `1+5d`, `3FS-2d`
 * List separator: comma or semicolon (locale list-separator).
 */
export function parsePredecessorsGrid(raw?: string | null): ParsedGridPredecessor[] {
  if (!raw || !String(raw).trim()) return [];

  const parts = String(raw)
    .split(/[;,\n|]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const results: ParsedGridPredecessor[] = [];
  for (const part of parts) {
    // `14FS+3d` / `14FS+3 days` / `14FS-2d` / `14FS` / `14` / `14+3d` (FS implied)
    const idForm = part.match(
      /^(\d+)\s*(?:(FS|SS|FF|SF))?\s*(?:([+-]\s*\d+)\s*(?:d|days?|day)?\s*)?$/i,
    );
    if (idForm) {
      const planId = Number.parseInt(idForm[1], 10);
      const depType = (idForm[2]?.toUpperCase() || "FS") as TaskDependencyType;
      const lag = idForm[3]
        ? Number.parseInt(idForm[3].replace(/\s/g, ""), 10)
        : 0;
      if (Number.isFinite(planId) && planId > 0) {
        results.push({
          planId,
          depType,
          lagDays: Number.isFinite(lag) ? lag : 0,
        });
      }
      continue;
    }

    // Excel title form: `Title (FS+2d)` / `Title (FS)` / bare title
    const withLag = part.match(
      /^(.*?)\s*\(\s*(FS|SS|FF|SF)\s*([+-]\s*\d+)\s*d?\s*\)\s*$/i,
    );
    if (withLag) {
      const lag = Number.parseInt(withLag[3].replace(/\s/g, ""), 10);
      results.push({
        title: withLag[1].trim(),
        depType: withLag[2].toUpperCase() as TaskDependencyType,
        lagDays: Number.isFinite(lag) ? lag : 0,
      });
      continue;
    }
    const withType = part.match(/^(.*?)\s*\(\s*(FS|SS|FF|SF)\s*\)\s*$/i);
    if (withType) {
      results.push({
        title: withType[1].trim(),
        depType: withType[2].toUpperCase() as TaskDependencyType,
        lagDays: 0,
      });
      continue;
    }
    const bare = part.replace(/\s*\([^)]*\)\s*$/, "").trim() || part;
    if (bare) {
      results.push({ title: bare, depType: "FS", lagDays: 0 });
    }
  }
  return results;
}

export function resolveParsedPredecessors(
  parsed: ParsedGridPredecessor[],
  successorId: string,
  planIdToId: Map<number, string>,
  titleToId: Map<string, string>,
): { links: DesiredPredecessorLink[]; errors: string[] } {
  const links: DesiredPredecessorLink[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const p of parsed) {
    let predecessorId: string | undefined;
    if (p.planId != null) {
      predecessorId = planIdToId.get(p.planId);
      if (!predecessorId) {
        errors.push(`Unknown task ID ${p.planId}`);
        continue;
      }
    } else if (p.title) {
      predecessorId = titleToId.get(p.title.trim().toLowerCase());
      if (!predecessorId) {
        errors.push(`Unknown task "${p.title}"`);
        continue;
      }
    }
    if (!predecessorId) continue;
    if (predecessorId === successorId) {
      errors.push("A task cannot depend on itself");
      continue;
    }
    if (seen.has(predecessorId)) continue;
    seen.add(predecessorId);
    links.push({
      predecessorId,
      depType: p.depType,
      lagDays: p.lagDays,
    });
  }
  return { links, errors };
}

export function diffPredecessorLinks(
  existing: TaskDependency[],
  successorId: string,
  desired: DesiredPredecessorLink[],
): {
  toCreate: DesiredPredecessorLink[];
  toUpdate: { id: string; depType: TaskDependencyType; lagDays: number }[];
  toDelete: string[];
} {
  const current = existing.filter((d) => d.successorId === successorId);
  const desiredByPred = new Map(desired.map((d) => [d.predecessorId, d]));
  const toDelete: string[] = [];
  const toUpdate: { id: string; depType: TaskDependencyType; lagDays: number }[] =
    [];
  const matched = new Set<string>();

  for (const dep of current) {
    const want = desiredByPred.get(dep.predecessorId);
    if (!want) {
      toDelete.push(dep.id);
      continue;
    }
    matched.add(dep.predecessorId);
    if (dep.depType !== want.depType || (dep.lagDays || 0) !== want.lagDays) {
      toUpdate.push({
        id: dep.id,
        depType: want.depType,
        lagDays: want.lagDays,
      });
    }
  }

  const toCreate = desired.filter((d) => !matched.has(d.predecessorId));
  return { toCreate, toUpdate, toDelete };
}

export function diffSuccessorLinks(
  existing: TaskDependency[],
  predecessorId: string,
  desired: DesiredSuccessorLink[],
): {
  toCreate: DesiredSuccessorLink[];
  toUpdate: { id: string; depType: TaskDependencyType; lagDays: number }[];
  toDelete: string[];
} {
  const current = existing.filter((d) => d.predecessorId === predecessorId);
  const desiredBySucc = new Map(desired.map((d) => [d.successorId, d]));
  const toDelete: string[] = [];
  const toUpdate: { id: string; depType: TaskDependencyType; lagDays: number }[] =
    [];
  const matched = new Set<string>();

  for (const dep of current) {
    const want = desiredBySucc.get(dep.successorId);
    if (!want) {
      toDelete.push(dep.id);
      continue;
    }
    matched.add(dep.successorId);
    if (dep.depType !== want.depType || (dep.lagDays || 0) !== want.lagDays) {
      toUpdate.push({
        id: dep.id,
        depType: want.depType,
        lagDays: want.lagDays,
      });
    }
  }

  const toCreate = desired.filter((d) => !matched.has(d.successorId));
  return { toCreate, toUpdate, toDelete };
}
