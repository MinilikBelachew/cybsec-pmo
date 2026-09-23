package com.cybsec.mpxj.service;

import com.cybsec.mpxj.dto.MspdiExportAssignmentDto;
import com.cybsec.mpxj.dto.MspdiExportDependencyDto;
import com.cybsec.mpxj.dto.MspdiExportHolidayDto;
import com.cybsec.mpxj.dto.MspdiExportProjectPropertiesDto;
import com.cybsec.mpxj.dto.MspdiExportRequest;
import com.cybsec.mpxj.dto.MspdiExportResourceDto;
import com.cybsec.mpxj.dto.MspdiExportTaskDto;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
      if (props.getDurationDays() != null && props.getDurationDays() > 0) {
        projectSummary.setDuration(
            Duration.getInstance(props.getDurationDays(), TimeUnit.DAYS));
      }
      if (props.getBaselineDurationDays() != null && props.getBaselineDurationDays() > 0) {
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
        applyTask(task, dto);
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

  private void applyTask(Task task, MspdiExportTaskDto dto) {
    task.setName(dto.getName() == null ? "Task" : dto.getName().trim());
    if (dto.getOutlineLevel() != null) {
      task.setOutlineLevel(dto.getOutlineLevel());
    }
    task.setSummary(dto.isSummary());

    if (dto.isMilestone()) {
      task.setMilestone(true);
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
    LocalDateTime baselineFinish = parseDateTime(dto.getBaselineFinish(), true);
    if (baselineStart != null) {
      task.setBaselineStart(baselineStart);
    }
    if (baselineFinish != null) {
      task.setBaselineFinish(baselineFinish);
    }

    if (dto.isMilestone()) {
      task.setDuration(Duration.getInstance(0, TimeUnit.DAYS));
    } else if (dto.getDurationDays() != null && dto.getDurationDays() > 0) {
      task.setDuration(Duration.getInstance(dto.getDurationDays(), TimeUnit.DAYS));
    }

    if (dto.getBaselineDurationDays() != null && dto.getBaselineDurationDays() > 0) {
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
  }

  private LocalDateTime parseDateTime(String value, boolean endOfDay) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String day = value.trim();
    if (day.length() >= 10) {
      day = day.substring(0, 10);
    }
    try {
      LocalDate date = LocalDate.parse(day);
      return LocalDateTime.of(date, endOfDay ? LocalTime.of(17, 0) : LocalTime.of(8, 0));
    } catch (Exception ignored) {
      return null;
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
