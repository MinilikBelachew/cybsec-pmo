import { PrismaService } from '../database/prisma.service';

const PARENT_WRITE_CHUNK = 100;

export type ExcelParentLinkRow = {
  title: string;
  /** Undefined = column missing (leave DB parent unchanged). Empty = top-level. */
  parentTaskTitle?: string;
};

export type TaskTitleIndex = {
  byTitle: Map<string, string[]>;
  byRowKey: Map<string, string[]>;
};

export function createTaskTitleIndex(): TaskTitleIndex {
  return { byTitle: new Map(), byRowKey: new Map() };
}

export function taskRowKey(
  title: string,
  parentTitle?: string | null,
): string {
  return `${title.trim().toLowerCase()}||${(parentTitle ?? '').trim().toLowerCase()}`;
}

function pushUnique(list: string[], id: string): string[] {
  if (!list.includes(id)) list.push(id);
  return list;
}

/** Index a task already on the project (parent lookup only — not an import row). */
export function indexExistingTask(
  index: TaskTitleIndex,
  title: string,
  id: string,
): void {
  const t = title.trim().toLowerCase();
  if (!t || !id) return;
  index.byTitle.set(t, pushUnique(index.byTitle.get(t) ?? [], id));
}

/** Index a task created or updated from this Excel file (preserves duplicate titles). */
export function indexTaskId(
  index: TaskTitleIndex,
  title: string,
  id: string,
  parentTitle?: string | null,
): void {
  const t = title.trim().toLowerCase();
  if (!t || !id) return;
  index.byTitle.set(t, pushUnique(index.byTitle.get(t) ?? [], id));
  const key = taskRowKey(title, parentTitle);
  index.byRowKey.set(key, pushUnique(index.byRowKey.get(key) ?? [], id));
}

/** Rebuild row-key ids in file order so duplicate titles map 1:1 to import rows. */
export function reindexImportRowKeys(
  index: TaskTitleIndex,
  rows: Array<{ title: string; id?: string; parentTaskTitle?: string }>,
): void {
  index.byRowKey = new Map();
  for (const row of rows) {
    if (!row.id) continue;
    const key = taskRowKey(row.title, row.parentTaskTitle);
    index.byRowKey.set(key, pushUnique(index.byRowKey.get(key) ?? [], row.id));
  }
}

export function idForImportRow(
  index: TaskTitleIndex,
  title: string,
  parentTitle?: string | null,
): string | undefined {
  const list = index.byRowKey.get(taskRowKey(title, parentTitle)) ?? [];
  return list[0] ?? uniqueTitleId(index, title);
}

/** Walk import rows in order so duplicate titles each get their own id. */
export function createImportRowIdCursor(index: TaskTitleIndex) {
  const used = new Map<string, number>();
  return (title: string, parentTitle?: string | null): string | undefined => {
    const key = taskRowKey(title, parentTitle);
    const list = index.byRowKey.get(key) ?? [];
    const i = used.get(key) ?? 0;
    used.set(key, i + 1);
    return list[i] ?? uniqueTitleId(index, title);
  };
}

export function idForTitle(
  index: TaskTitleIndex,
  title: string,
): { id?: string; ambiguous: boolean } {
  const ids = index.byTitle.get(title.trim().toLowerCase()) ?? [];
  if (ids.length === 1) return { id: ids[0], ambiguous: false };
  if (ids.length > 1) return { id: ids[0], ambiguous: true };
  return { id: undefined, ambiguous: false };
}

export function allIndexedIds(index: TaskTitleIndex): string[] {
  const ids = new Set<string>();
  for (const list of index.byTitle.values()) {
    for (const id of list) ids.add(id);
  }
  for (const list of index.byRowKey.values()) {
    for (const id of list) ids.add(id);
  }
  return [...ids];
}

function uniqueTitleId(
  index: TaskTitleIndex,
  title: string,
): string | undefined {
  const ids = index.byTitle.get(title.trim().toLowerCase()) ?? [];
  return ids.length === 1 ? ids[0] : undefined;
}

function resolvedParentId(
  id: string,
  proposed: Map<string, string | null>,
  current: Map<string, string | null>,
): string | null {
  if (proposed.has(id)) return proposed.get(id) ?? null;
  return current.get(id) ?? null;
}

function walkWouldCycle(
  childId: string,
  parentId: string,
  proposed: Map<string, string | null>,
  current: Map<string, string | null>,
): boolean {
  let cur: string | null = parentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === childId) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = resolvedParentId(cur, proposed, current);
  }
  return false;
}

/**
 * Second pass after create/update: nest tasks using Excel "Parent Task" titles.
 * Does not set parentTaskId on create (the parent row may not exist yet).
 */
export async function applyExcelTaskParentLinks(
  prisma: PrismaService,
  rows: ExcelParentLinkRow[],
  titleIndex: TaskTitleIndex,
  warnings: string[],
): Promise<number> {
  const ids = allIndexedIds(titleIndex);
  if (ids.length === 0) return 0;

  const existing = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true, parentTaskId: true, title: true },
  });
  const current = new Map<string, string | null>(
    existing.map((t) => [t.id, t.parentTaskId]),
  );

  const titleById = new Map<string, string>();
  for (const task of existing) {
    titleById.set(task.id, task.title);
  }

  const nextImportId = createImportRowIdCursor(titleIndex);
  const proposed = new Map<string, string | null>();
  for (const row of rows) {
    const childId = nextImportId(row.title, row.parentTaskTitle);
    if (childId) titleById.set(childId, row.title);
    if (!childId) continue;
    if (row.parentTaskTitle === undefined) continue;

    const parentName = row.parentTaskTitle.trim();
    if (!parentName) {
      proposed.set(childId, null);
      continue;
    }
    const { id: parentId, ambiguous } = idForTitle(titleIndex, parentName);
    if (!parentId) {
      warnings.push(
        `Parent task "${parentName}" not found for "${row.title}". Left as top-level.`,
      );
      proposed.set(childId, null);
      continue;
    }
    if (parentId === childId) {
      warnings.push(
        `Task "${row.title}": Parent Task cannot be the same row. Left as top-level.`,
      );
      proposed.set(childId, null);
      continue;
    }
    if (ambiguous) {
      warnings.push(
        `Parent task "${parentName}" matches more than one task; nested "${row.title}" under the first match.`,
      );
    }
    proposed.set(childId, parentId);
  }

  if (proposed.size === 0) return 0;

  const updates: Array<{ id: string; parentTaskId: string | null }> = [];
  for (const [childId, parentId] of proposed) {
    if (parentId && walkWouldCycle(childId, parentId, proposed, current)) {
      warnings.push(
        `Task "${titleById.get(childId) ?? childId}": skipped parent link that would create a cycle.`,
      );
      continue;
    }
    const prev = current.get(childId) ?? null;
    if (prev === parentId) continue;
    updates.push({ id: childId, parentTaskId: parentId });
  }

  let linked = 0;
  for (let i = 0; i < updates.length; i += PARENT_WRITE_CHUNK) {
    const chunk = updates.slice(i, i + PARENT_WRITE_CHUNK);
    try {
      await prisma.$transaction(
        chunk.map((u) =>
          prisma.task.update({
            where: { id: u.id },
            data: { parentTaskId: u.parentTaskId },
          }),
        ),
      );
      linked += chunk.length;
    } catch {
      for (const u of chunk) {
        try {
          await prisma.task.update({
            where: { id: u.id },
            data: { parentTaskId: u.parentTaskId },
          });
          linked += 1;
        } catch (rowError) {
          warnings.push(
            `Parent link failed for "${titleById.get(u.id) ?? u.id}": ${
              rowError instanceof Error ? rowError.message : String(rowError)
            }`,
          );
        }
      }
    }
  }

  return linked;
}
