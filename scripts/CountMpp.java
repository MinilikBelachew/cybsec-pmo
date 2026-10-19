import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.mpxj.ProjectFile;
import org.mpxj.Relation;
import org.mpxj.Task;
import org.mpxj.mpp.MPPReader;

/** Counts aligned with Cybsec mpp-import.mapper phase/task/milestone rules. */
public class CountMpp {
  static class Row {
    int uid;
    Integer parentUid;
    int outlineLevel;
    boolean summary;
    boolean milestone;
    String name;
    Double durationDays;
  }

  public static void main(String[] args) throws Exception {
    if (args.length < 1) {
      System.err.println("Usage: CountMpp <file.mpp>");
      System.exit(1);
    }
    MPPReader reader = new MPPReader();
    reader.setReadPresentationData(false);
    ProjectFile project;
    try (FileInputStream in = new FileInputStream(args[0])) {
      project = reader.read(in);
    }

    Map<Integer, Row> byUid = new HashMap<>();
    List<Row> all = new ArrayList<>();
    for (Task t : project.getTasks()) {
      if (t == null || t.getUniqueID() == null) continue;
      Row r = new Row();
      r.uid = t.getUniqueID().intValue();
      r.name = t.getName() == null ? "" : t.getName().trim();
      r.summary = Boolean.TRUE.equals(t.getSummary());
      r.milestone = Boolean.TRUE.equals(t.getMilestone());
      r.outlineLevel = t.getOutlineLevel() == null ? -1 : t.getOutlineLevel();
      Task parent = t.getParentTask();
      r.parentUid = parent == null || parent.getUniqueID() == null
          ? null
          : parent.getUniqueID().intValue();
      if (t.getDuration() != null) {
        r.durationDays = t.getDuration().getDuration();
      }
      byUid.put(r.uid, r);
      all.add(r);
    }

    Row wrapper = findWrapper(all, byUid);
    List<Row> phases = new ArrayList<>();
    for (Row r : all) {
      if (isTopLevelPhase(r, wrapper, byUid)) phases.add(r);
    }

    List<Row> importable = new ArrayList<>();
    for (Row r : all) {
      if (isImportable(r, wrapper, byUid)) importable.add(r);
    }

    List<Row> milestones = new ArrayList<>();
    for (Row r : all) {
      if (isMppMilestone(r)) milestones.add(r);
    }

    int taskDeps = 0;
    int skippedPhasePreds = 0;
    Set<Integer> importableUids = new HashSet<>();
    for (Row r : importable) importableUids.add(r.uid);

    for (Task t : project.getTasks()) {
      if (t == null || t.getUniqueID() == null) continue;
      int uid = t.getUniqueID().intValue();
      if (!importableUids.contains(uid)) continue;
      if (t.getPredecessors() == null) continue;
      for (Relation rel : t.getPredecessors()) {
        Task pred = rel.getPredecessorTask();
        if (pred == null || pred.getUniqueID() == null) continue;
        int puid = pred.getUniqueID().intValue();
        if (importableUids.contains(puid)) {
          taskDeps++;
        } else {
          skippedPhasePreds++;
        }
      }
    }

    System.out.println("File: " + args[0]);
    System.out.println("MS Project Title (properties): " + project.getProjectProperties().getProjectTitle());
    System.out.println("Cybsec project name (wrapper): " + (wrapper == null ? "(none)" : wrapper.name));
    System.out.println();
    System.out.println("=== After Cybsec MPP import (expected) ===");
    System.out.println("Phases: " + phases.size());
    for (Row p : phases) {
      System.out.println("  - " + p.name);
    }
    System.out.println("Milestones (Milestones tab): " + milestones.size());
    for (Row m : milestones) {
      System.out.println("  - " + m.name);
    }
    System.out.println("Tasks (incl. nested summaries as parent tasks): " + importable.size());
    System.out.println("  of which nested summaries (parent tasks): " + count(importable, true));
    System.out.println("  of which leaf rows: " + count(importable, false));
    System.out.println("Task↔task dependencies imported: " + taskDeps);
    System.out.println("Deps skipped (pred not an importable task, e.g. phase): " + skippedPhasePreds);
    System.out.println();
    System.out.println("Raw MPP rows: " + all.size());
  }

  static int count(List<Row> rows, boolean summary) {
    int n = 0;
    for (Row r : rows) if (r.summary == summary) n++;
    return n;
  }

  /** Prefer outline-level-1 named summary under root (plan name row). */
  static Row findWrapper(List<Row> all, Map<Integer, Row> byUid) {
    Row outline0 = null;
    for (Row r : all) {
      if (r.summary && r.outlineLevel == 0 && !r.name.isEmpty()) outline0 = r;
    }
    // Children of outline0 that are summaries at OL=1 → pick the plan wrapper
    if (outline0 != null) {
      for (Row r : all) {
        if (r.summary
            && !r.name.isEmpty()
            && r.outlineLevel == 1
            && r.parentUid != null
            && r.parentUid == outline0.uid) {
          return r;
        }
      }
      for (Row r : all) {
        if (r.summary && !r.name.isEmpty() && r.outlineLevel == 1) return r;
      }
    }
    for (Row r : all) {
      if (r.summary && !r.name.isEmpty() && r.outlineLevel == 1) return r;
    }
    return outline0;
  }

  static boolean isTopLevelPhase(Row task, Row wrapper, Map<Integer, Row> byUid) {
    if (!task.summary || task.name.isEmpty()) return false;
    if (task.outlineLevel == 0) return false;
    if (wrapper != null && wrapper.uid == task.uid) return false;
    if (wrapper != null) {
      if (task.parentUid != null && task.parentUid == wrapper.uid) return true;
      if (task.parentUid == null && task.outlineLevel == wrapper.outlineLevel + 1) return true;
      return false;
    }
    return task.outlineLevel == 1;
  }

  static boolean isImportable(Row task, Row wrapper, Map<Integer, Row> byUid) {
    if (task.name.isEmpty()) return false;
    if (task.outlineLevel == 0) return false;
    if (wrapper != null && wrapper.uid == task.uid) return false;
    if (isTopLevelPhase(task, wrapper, byUid)) return false;
    return true;
  }

  static boolean isMppMilestone(Row task) {
    if (task.name.isEmpty() || task.summary || task.outlineLevel == 0) return false;
    if (task.milestone) return true;
    if (task.durationDays != null && task.durationDays > 0) return false;
    return true;
  }
}
