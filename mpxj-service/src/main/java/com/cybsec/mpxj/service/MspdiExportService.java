package com.cybsec.mpxj.service;

import com.cybsec.mpxj.dto.MspdiExportAssignmentDto;
import com.cybsec.mpxj.dto.MspdiExportDependencyDto;
import com.cybsec.mpxj.dto.MspdiExportHolidayDto;
import com.cybsec.mpxj.dto.MspdiExportProjectPropertiesDto;
import com.cybsec.mpxj.dto.MspdiExportRequest;
import com.cybsec.mpxj.dto.MspdiExportResourceDto;
import com.cybsec.mpxj.dto.MspdiExportTaskDto;
import com.cybsec.mpxj.dto.ParsedCustomFieldDefDto;
import com.cybsec.mpxj.dto.ParsedCustomFieldValueDto;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.mpxj.ConstraintType;
import org.mpxj.CustomField;
import org.mpxj.Duration;
import org.mpxj.Priority;
import org.mpxj.ProjectCalendar;
import org.mpxj.ProjectFile;
import org.mpxj.ProjectProperties;
import org.mpxj.Relation;
import org.mpxj.RelationType;
import org.mpxj.Resource;
import org.mpxj.ResourceAssignment;
import org.mpxj.Task;
import org.mpxj.TaskField;
import org.mpxj.TaskMode;
import org.mpxj.TaskType;
import org.mpxj.TimeUnit;
import org.mpxj.mspdi.MSPDIWriter;
import org.springframework.stereotype.Service;

/**
 * Builds an MSPDI (Microsoft Project XML) file from a Nest schedule payload.
 *
 * <p>MPXJ cannot write proprietary binary {@code .mpp} files; MSPDI is the
 * supported write format and opens natively in Microsoft Project.
 */
@Service
public class MspdiExportService {
  private static final Pattern CUSTOM_SLOT =
      Pattern.compile(
          "^(Text|Number|Flag|Date|Cost|Duration|Start|Finish)(\\d+)$",
          Pattern.CASE_INSENSITIVE);

  public byte[] exportMspdi(MspdiExportRequest request) throws Exception {
    if (request == null || request.getTasks() == null || request.getTasks().isEmpty()) {
      throw new IllegalArgumentException("Export requires at least one task");
    }

    ProjectFile project = new ProjectFile();
    ProjectCalendar calendar = project.addDefaultBaseCalendar();
    project.setDefaultCalendar(calendar);

    if (request.getHolidays() != null) {
      for (MspdiExportHolidayDto holiday : request.getHolidays()) {
        if (holiday == null || holiday.getDate() == null || holiday.getDate().isBlank()) {
          continue;
        }
        LocalDateTime day = parseDateTime(holiday.getDate(), false);
        if (day == null) {
          continue;
        }
        calendar.addCalendarException(day.toLocalDate());
      }
    }

    MspdiExportProjectPropertiesDto props = request.getProject();
    ProjectProperties projectProperties = project.getProjectProperties();
    String name =
        props != null && props.getName() != null && !props.getName().isBlank()
            ? props.getName().trim()
            : "Exported Schedule";
    projectProperties.setProjectTitle(name);
    projectProperties.setName(name);
    projectProperties.setNewTasksAreManual(true);

    List<ParsedCustomFieldDefDto> customFieldDefs =
        request.getCustomFieldDefs() != null
            ? request.getCustomFieldDefs()
            : List.of();
    applyCustomFieldDefs(project, customFieldDefs);

    LocalDateTime projectStart = parseDateTime(props != null ? props.getStartDate() : null, false);
    LocalDateTime projectFinish = parseDateTime(props != null ? props.getFinishDate() : null, true);
    if (projectStart != null) {
      projectProperties.setStartDate(projectStart);
    }
    if (projectFinish != null) {
      projectProperties.setFinishDate(projectFinish);
    }

    // Also emit outline-0 project summary with full schedule (baseline / % / duration).
    Task projectSummary = project.addTask();
    projectSummary.setName(name);
    projectSummary.setOutlineLevel(0);
    projectSummary.setSummary(true);
    if (projectStart != null) {
      projectSummary.setStart(projectStart);
    }
    if (projectFinish != null) {
      projectSummary.setFinish(projectFinish);
    }
    if (props != null) {
      LocalDateTime baselineStart = parseDateTime(props.getBaselineStart(), false);
      LocalDateTime baselineFinish = parseDateTime(props.getBaselineFinish(), true);
      if (baselineStart != null) {
        projectSummary.setBaselineStart(baselineStart);
      }
      if (baselineFinish != null) {
        projectSummary.setBaselineFinish(baselineFinish);
      }
      if (props.getDurationDays() != null && props.getDurationDays() >= 0) {
        projectSummary.setDuration(
            Duration.getInstance(props.getDurationDays(), TimeUnit.DAYS));
      }
      if (props.getBaselineDurationDays() != null && props.getBaselineDurationDays() >= 0) {
        projectSummary.setBaselineDuration(
            Duration.getInstance(props.getBaselineDurationDays(), TimeUnit.DAYS));
      }
      if (props.getPercentComplete() != null) {
        projectSummary.setPercentageComplete(
            Math.max(0, Math.min(100, props.getPercentComplete())));
      }
      if (props.getDurationVarianceDays() != null) {
        projectSummary.setDurationVariance(
            Duration.getInstance(props.getDurationVarianceDays(), TimeUnit.DAYS));
      }
    }

    Map<String, Task> byId = new HashMap<>();
    Set<String> created = new HashSet<>();
    List<MspdiExportTaskDto> tasks = new ArrayList<>(request.getTasks());

    // Create in order; parents must exist before children when parentId is set.
    // Attach top-level (no parentId) tasks under the project summary.
    int guard = 0;
    while (created.size() < tasks.size() && guard < tasks.size() + 2) {
      guard += 1;
      boolean progress = false;
      for (MspdiExportTaskDto dto : tasks) {
        if (dto.getId() == null || dto.getId().isBlank() || created.contains(dto.getId())) {
          continue;
        }
        if (dto.getParentId() != null
            && !dto.getParentId().isBlank()
            && !byId.containsKey(dto.getParentId())) {
          continue;
        }

        Task parent =
            dto.getParentId() != null && !dto.getParentId().isBlank()
                ? byId.get(dto.getParentId())
                : projectSummary;
        Task task = parent != null ? parent.addTask() : project.addTask();
        applyTask(task, dto, customFieldDefs);
        byId.put(dto.getId(), task);
        created.add(dto.getId());
        progress = true;
      }
      if (!progress) {
        throw new IllegalArgumentException("Unable to resolve task hierarchy for export");
      }
    }

    for (MspdiExportDependencyDto dep : request.getDependencies()) {
      if (dep == null || dep.getPredecessorId() == null || dep.getSuccessorId() == null) {
        continue;
      }
      Task predecessor = byId.get(dep.getPredecessorId());
      Task successor = byId.get(dep.getSuccessorId());
      if (predecessor == null || successor == null) {
        continue;
      }

      int lagDays = dep.getLagDays() == null ? 0 : dep.getLagDays();
      successor.addPredecessor(
          new Relation.Builder()
              .predecessorTask(predecessor)
              .successorTask(successor)
              .type(mapRelationType(dep.getType()))
              .lag(Duration.getInstance(lagDays, TimeUnit.DAYS)));
    }

    Map<String, Resource> resourcesById = new HashMap<>();
    if (request.getResources() != null) {
      for (MspdiExportResourceDto resourceDto : request.getResources()) {
        if (resourceDto == null
            || resourceDto.getId() == null
            || resourceDto.getId().isBlank()
            || resourceDto.getName() == null
            || resourceDto.getName().isBlank()) {
          continue;
        }
        Resource resource = project.addResource();
        resource.setName(resourceDto.getName().trim());
        if (resourceDto.getEmail() != null && !resourceDto.getEmail().isBlank()) {
          resource.setEmailAddress(resourceDto.getEmail().trim());
        }
        // Full derived calendar (not bare BaseCalendarUID) so Project Save As .mpp
        // keeps working hours readable by MPXJ.
        ProjectCalendar resourceCalendar = project.addDefaultDerivedCalendar();
        resourceCalendar.setName(resourceDto.getName().trim());
        resourceCalendar.setParent(calendar);
        resource.setCalendar(resourceCalendar);
        resourcesById.put(resourceDto.getId(), resource);
      }
    }

    if (request.getAssignments() != null) {
      for (MspdiExportAssignmentDto assignmentDto : request.getAssignments()) {
        if (assignmentDto == null
            || assignmentDto.getTaskId() == null
            || assignmentDto.getResourceId() == null) {
          continue;
        }
        Task task = byId.get(assignmentDto.getTaskId());
        Resource resource = resourcesById.get(assignmentDto.getResourceId());
        if (task == null || resource == null) {
          continue;
        }
        ResourceAssignment assignment = task.addResourceAssignment(resource);
        double units =
            assignmentDto.getUnits() == null || assignmentDto.getUnits() <= 0
                ? 1.0
                : assignmentDto.getUnits();
        assignment.setUnits(units);
      }
    }

    ByteArrayOutputStream output = new ByteArrayOutputStream();
    MSPDIWriter writer = new MSPDIWriter();
    writer.write(project, output);
    return output.toByteArray();
  }

  private void applyTask(
      Task task, MspdiExportTaskDto dto, List<ParsedCustomFieldDefDto> customFieldDefs) {
    task.setName(dto.getName() == null ? "Task" : dto.getName().trim());
    if (dto.getOutlineLevel() != null) {
      task.setOutlineLevel(dto.getOutlineLevel());
    }
    task.setSummary(dto.isSummary());
    task.setTaskMode(resolveTaskMode(dto.getTaskMode()));
    task.setType(TaskType.FIXED_DURATION);

    if (dto.isMilestone()) {
      task.setMilestone(true);
    }

    ConstraintType constraintType = resolveConstraintType(dto.getConstraintType());
    if (constraintType != null) {
      task.setConstraintType(constraintType);
    }
    if (needsConstraintDate(dto.getConstraintType())) {
      LocalDateTime constraintDate = parseDateTime(dto.getConstraintDate(), false);
      if (constraintDate != null) {
        task.setConstraintDate(constraintDate);
      }
    }

    LocalDateTime start = parseDateTime(dto.getStartDate(), false);
    LocalDateTime finish = parseDateTime(dto.getFinishDate(), true);
    if (start != null) {
      task.setStart(start);
    }
    if (finish != null) {
      task.setFinish(finish);
    }

    LocalDateTime baselineStart = parseDateTime(dto.getBaselineStart(), false);
    LocalDateTime baselineFinish = parseDateTime(
        dto.isMilestone()
            ? (dto.getBaselineStart() != null ? dto.getBaselineStart() : dto.getBaselineFinish())
            : dto.getBaselineFinish(),
        !dto.isMilestone());
    if (baselineStart != null) {
      task.setBaselineStart(baselineStart);
    }
    if (baselineFinish != null) {
      task.setBaselineFinish(baselineFinish);
    }

    if (dto.isMilestone()) {
      task.setDuration(Duration.getInstance(0, TimeUnit.DAYS));
      task.setWork(Duration.getInstance(0, TimeUnit.HOURS));
      task.setBaselineDuration(Duration.getInstance(0, TimeUnit.DAYS));
    } else if (dto.getDurationDays() != null && dto.getDurationDays() >= 0) {
      task.setDuration(Duration.getInstance(dto.getDurationDays(), TimeUnit.DAYS));
    }

    if (dto.getWorkHours() != null && dto.getWorkHours() > 0) {
      task.setWork(Duration.getInstance(dto.getWorkHours(), TimeUnit.HOURS));
    }

    if (!dto.isMilestone() && dto.getBaselineDurationDays() != null && dto.getBaselineDurationDays() >= 0) {
      task.setBaselineDuration(
          Duration.getInstance(dto.getBaselineDurationDays(), TimeUnit.DAYS));
    }

    if (dto.getStartVarianceDays() != null) {
      task.setStartVariance(Duration.getInstance(dto.getStartVarianceDays(), TimeUnit.DAYS));
    }

    if (dto.getFinishVarianceDays() != null) {
      task.setFinishVariance(Duration.getInstance(dto.getFinishVarianceDays(), TimeUnit.DAYS));
    }

    if (dto.getPercentComplete() != null) {
      task.setPercentageComplete(Math.max(0, Math.min(100, dto.getPercentComplete())));
    }

    if (dto.getPriority() != null) {
      task.setPriority(Priority.getInstance(dto.getPriority()));
    }

    if (dto.getNotes() != null && !dto.getNotes().isBlank()) {
      task.setNotes(dto.getNotes());
    }

    applyCustomFieldValues(task, dto.getCustomFields(), customFieldDefs);
  }

  private void applyCustomFieldDefs(ProjectFile project, List<ParsedCustomFieldDefDto> defs) {
    if (defs == null || defs.isEmpty()) {
      return;
    }
    for (ParsedCustomFieldDefDto def : defs) {
      if (def == null || def.getFieldName() == null) {
        continue;
      }
      TaskField field = resolveTaskField(def.getFieldName());
      if (field == null) {
        continue;
      }
      try {
        CustomField custom = project.getCustomFields().getOrCreate(field);
        if (def.getAlias() != null && !def.getAlias().isBlank()) {
          custom.setAlias(def.getAlias().trim());
        }
      } catch (Exception ignored) {
        // Best-effort — values can still export without alias metadata.
      }
    }
  }

  private String resolveCustomSlotName(
      String rawName, List<ParsedCustomFieldDefDto> defs) {
    if (rawName == null || rawName.isBlank()) {
      return null;
    }
    String trimmed = rawName.trim();
    if (CUSTOM_SLOT.matcher(trimmed).matches()) {
      return trimmed;
    }
    if (defs == null) {
      return null;
    }
    String key = trimmed.toLowerCase(Locale.ROOT);
    for (ParsedCustomFieldDefDto def : defs) {
      if (def == null || def.getFieldName() == null) {
        continue;
      }
      if (def.getFieldName().trim().equalsIgnoreCase(trimmed)) {
        return def.getFieldName().trim();
      }
      if (def.getAlias() != null && def.getAlias().trim().equalsIgnoreCase(key)) {
        return def.getFieldName().trim();
      }
    }
    return null;
  }

  private void applyCustomFieldValues(
      Task task,
      List<ParsedCustomFieldValueDto> values,
      List<ParsedCustomFieldDefDto> defs) {
    if (values == null || values.isEmpty()) {
      return;
    }
    for (ParsedCustomFieldValueDto entry : values) {
      if (entry == null
          || entry.getFieldName() == null
          || entry.getValue() == null
          || entry.getValue().isBlank()) {
        continue;
      }
      String slotName = resolveCustomSlotName(entry.getFieldName(), defs);
      if (slotName == null) {
        continue;
      }
      Matcher matcher = CUSTOM_SLOT.matcher(slotName);
      if (!matcher.matches()) {
        continue;
      }
      String family = matcher.group(1).toUpperCase(Locale.ROOT);
      int index = Integer.parseInt(matcher.group(2));
      String raw = entry.getValue().trim();
      try {
        switch (family) {
          case "TEXT" -> task.setText(index, raw);
          case "NUMBER" -> task.setNumber(index, Double.parseDouble(raw));
          case "FLAG" ->
              task.setFlag(
                  index,
                  "true".equalsIgnoreCase(raw)
                      || "1".equals(raw)
                      || "yes".equalsIgnoreCase(raw));
          case "DATE" -> {
            LocalDateTime date = parseDateTime(raw, false);
            if (date != null) {
              task.setDate(index, date);
            }
          }
          case "COST" -> task.setCost(index, Double.parseDouble(raw));
          case "DURATION" ->
              task.setDuration(index, Duration.getInstance(Double.parseDouble(raw), TimeUnit.DAYS));
          case "START" -> {
            LocalDateTime start = parseDateTime(raw, false);
            if (start != null) {
              task.setStart(index, start);
            }
          }
          case "FINISH" -> {
            LocalDateTime finish = parseDateTime(raw, true);
            if (finish != null) {
              task.setFinish(index, finish);
            }
          }
          default -> {
            // ignore unsupported
          }
        }
      } catch (Exception ignored) {
        // Skip malformed custom values rather than failing the whole export.
      }
    }
  }

  private TaskMode resolveTaskMode(String mode) {
    if (mode != null && mode.trim().equalsIgnoreCase("Auto")) {
      return TaskMode.AUTO_SCHEDULED;
    }
    return TaskMode.MANUALLY_SCHEDULED;
  }

  private ConstraintType resolveConstraintType(String code) {
    if (code == null || code.isBlank()) {
      return ConstraintType.AS_SOON_AS_POSSIBLE;
    }
    return switch (code.trim().toUpperCase(Locale.ROOT)) {
      case "ALAP" -> ConstraintType.AS_LATE_AS_POSSIBLE;
      case "MSO" -> ConstraintType.MUST_START_ON;
      case "MFO" -> ConstraintType.MUST_FINISH_ON;
      case "SNET" -> ConstraintType.START_NO_EARLIER_THAN;
      case "SNLT" -> ConstraintType.START_NO_LATER_THAN;
      case "FNET" -> ConstraintType.FINISH_NO_EARLIER_THAN;
      case "FNLT" -> ConstraintType.FINISH_NO_LATER_THAN;
      case "ASAP" -> ConstraintType.AS_SOON_AS_POSSIBLE;
      default -> ConstraintType.AS_SOON_AS_POSSIBLE;
    };
  }

  private boolean needsConstraintDate(String code) {
    if (code == null || code.isBlank()) {
      return false;
    }
    return switch (code.trim().toUpperCase(Locale.ROOT)) {
      case "ASAP", "ALAP" -> false;
      default -> true;
    };
  }

  private TaskField resolveTaskField(String fieldName) {
    Matcher matcher = CUSTOM_SLOT.matcher(fieldName.trim());
    if (!matcher.matches()) {
      return null;
    }
    String family = matcher.group(1).toUpperCase(Locale.ROOT);
    int index = Integer.parseInt(matcher.group(2));
    String enumName = family + index;
    try {
      return TaskField.valueOf(enumName);
    } catch (Exception ignored) {
      return null;
    }
  }

  private LocalDateTime parseDateTime(String value, boolean endOfDay) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String trimmed = value.trim();
    try {
      if (trimmed.length() == 10) {
        LocalDate date = LocalDate.parse(trimmed);
        return LocalDateTime.of(date, endOfDay ? LocalTime.of(17, 0) : LocalTime.of(8, 0));
      }
      if (trimmed.endsWith("Z") || trimmed.matches(".*[+-]\\d{2}:\\d{2}$")) {
        return OffsetDateTime.parse(trimmed).toLocalDateTime();
      }
      try {
        return LocalDateTime.parse(trimmed, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
      } catch (Exception ignored) {
        // fall through to shorter patterns
      }
      try {
        return LocalDateTime.parse(trimmed, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
      } catch (Exception ignored) {
        // fall through
      }
      try {
        return LocalDateTime.parse(trimmed, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
      } catch (Exception ignored) {
        return LocalDateTime.parse(trimmed, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
      }
    } catch (Exception ignored) {
      try {
        LocalDate date = LocalDate.parse(trimmed.substring(0, Math.min(10, trimmed.length())));
        return LocalDateTime.of(date, endOfDay ? LocalTime.of(17, 0) : LocalTime.of(8, 0));
      } catch (Exception ignoredAgain) {
        return null;
      }
    }
  }

  private RelationType mapRelationType(String type) {
    if (type == null) {
      return RelationType.FINISH_START;
    }
    return switch (type.trim().toUpperCase()) {
      case "SS" -> RelationType.START_START;
      case "FF" -> RelationType.FINISH_FINISH;
      case "SF" -> RelationType.START_FINISH;
      default -> RelationType.FINISH_START;
    };
  }
}
