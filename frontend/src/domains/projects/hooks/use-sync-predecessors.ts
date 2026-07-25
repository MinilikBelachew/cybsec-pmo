"use client";

import { toast } from "react-hot-toast";
import type { TaskDependency } from "@/domains/projects/types/tasks.types";
import {
  useCreateTaskDependencyMutation,
  useDeleteTaskDependencyMutation,
  useUpdateTaskDependencyMutation,
} from "@/domains/projects/api/tasks.api";
import {
  diffPredecessorLinks,
  diffSuccessorLinks,
  type DesiredPredecessorLink,
  type DesiredSuccessorLink,
} from "@/domains/projects/utils/task-predecessors-grid";

/** Sync predecessor / successor dependency links for a task. */
export function useSyncPredecessors() {
  const [createDep] = useCreateTaskDependencyMutation();
  const [updateDep] = useUpdateTaskDependencyMutation();
  const [deleteDep] = useDeleteTaskDependencyMutation();

  const applyPredecessorLinks = async (
    successorId: string,
    links: DesiredPredecessorLink[],
    dependencies: TaskDependency[],
    opts?: { silent?: boolean },
  ): Promise<boolean> => {
    if (links.some((l) => l.predecessorId === successorId)) {
      if (!opts?.silent) toast.error("A task cannot depend on itself");
      return false;
    }

    const { toCreate, toUpdate, toDelete } = diffPredecessorLinks(
      dependencies,
      successorId,
      links,
    );

    try {
      for (const id of toDelete) {
        await deleteDep(id).unwrap();
      }
      for (const u of toUpdate) {
        await updateDep({
          id: u.id,
          body: { depType: u.depType, lagDays: u.lagDays },
        }).unwrap();
      }
      for (const c of toCreate) {
        await createDep({
          predecessorId: c.predecessorId,
          successorId,
          depType: c.depType,
          lagDays: c.lagDays,
        }).unwrap();
      }
      return true;
    } catch (err: any) {
      if (!opts?.silent) {
        const msg =
          err?.data?.errors?.dependency ||
          err?.data?.message ||
          err?.message ||
          "Failed to update predecessors";
        toast.error(String(msg));
      }
      return false;
    }
  };

  const applySuccessorLinks = async (
    predecessorId: string,
    links: DesiredSuccessorLink[],
    dependencies: TaskDependency[],
    opts?: { silent?: boolean },
  ): Promise<boolean> => {
    if (links.some((l) => l.successorId === predecessorId)) {
      if (!opts?.silent) toast.error("A task cannot depend on itself");
      return false;
    }

    const { toCreate, toUpdate, toDelete } = diffSuccessorLinks(
      dependencies,
      predecessorId,
      links,
    );

    try {
      for (const id of toDelete) {
        await deleteDep(id).unwrap();
      }
      for (const u of toUpdate) {
        await updateDep({
          id: u.id,
          body: { depType: u.depType, lagDays: u.lagDays },
        }).unwrap();
      }
      for (const c of toCreate) {
        await createDep({
          predecessorId,
          successorId: c.successorId,
          depType: c.depType,
          lagDays: c.lagDays,
        }).unwrap();
      }
      return true;
    } catch (err: any) {
      if (!opts?.silent) {
        const msg =
          err?.data?.errors?.dependency ||
          err?.data?.message ||
          err?.message ||
          "Failed to update successors";
        toast.error(String(msg));
      }
      return false;
    }
  };

  /** @deprecated Prefer applyPredecessorLinks */
  const applyLinksToTask = applyPredecessorLinks;

  return { applyPredecessorLinks, applySuccessorLinks, applyLinksToTask };
}
