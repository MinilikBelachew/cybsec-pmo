package com.cybsec.mpxj.service;

import com.cybsec.mpxj.dto.ParsedAssignmentDto;
import com.cybsec.mpxj.dto.ParsedPredecessorDto;
import com.cybsec.mpxj.dto.ParsedProjectDto;
import com.cybsec.mpxj.dto.ParsedProjectPropertiesDto;
import com.cybsec.mpxj.dto.ParsedResourceDto;
import com.cybsec.mpxj.dto.ParsedTaskDto;
import java.io.InputStream;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.mpxj.Duration;
import org.mpxj.ProjectCalendar;
import org.mpxj.ProjectCalendarException;
import org.mpxj.ProjectFile;
import org.mpxj.ProjectProperties;
import org.mpxj.Relation;
import org.mpxj.RelationType;
import org.mpxj.Resource;
import org.mpxj.ResourceAssignment;
import org.mpxj.Task;
import org.mpxj.TimeUnit;
import org.mpxj.mpp.MPPReader;
import org.mpxj.mspdi.MSPDIReader;
import org.mpxj.reader.UniversalProjectReader;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MppParseService {
  private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

  public ParsedProjectDto parse(MultipartFile file) throws Exception {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("File is required");
    }

    String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
    if (!filename.endsWith(".mpp") && !filename.endsWith(".mpx") && !filename.endsWith(".xml")) {
      throw new IllegalArgumentException("Unsupported file type. Use .mpp, .mpx, or MSPDI .xml");
    }

    ProjectFile project;
    try (InputStream inputStream = file.getInputStream()) {
      if (filename.endsWith(".mpp")) {
        MPPReader reader = new MPPReader();
        reader.setReadPresentationData(false);
        project = reader.read(inputStream);
      } else if (filename.endsWith(".xml")) {
        // UniversalProjectReader returns null for MSPDI streams (no path sniffing).
        project = new MSPDIReader().read(inputStream);
      } else {
        project = new UniversalProjectReader().read(inputStream);
      }
    } catch (Exception error) {
      String detail = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
      throw new IllegalArgumentException(
          "Unable to parse project file ("
              + detail
              + "). If this is a .mpp from a recent Microsoft Project build, "
              + "use File > Save As > XML (MSPDI) and import the .xml instead.",
          error);
    }

    if (project == null) {
      throw new IllegalArgumentException("Unable to parse project file: " + filename);
    }

    return toDto(project);
  }

  private ParsedProjectDto toDto(ProjectFile project) {
    ParsedProjectDto dto = new ParsedProjectDto();
    ProjectProperties projectProperties = project.getProjectProperties();

    ParsedProjectPropertiesDto properties = new ParsedProjectPropertiesDto();
    properties.setName(project.getProjectProperties().getProjectTitle());
    properties.setStartDate(formatDate(project.getProjectProperties().getStartDate()));
    properties.setFinishDate(formatDate(project.getProjectProperties().getFinishDate()));
    dto.setProject(properties);

    for (Task task : project.getTasks()) {
      if (task == null) {
        continue;
      }

      String name = task.getName();
      if (name == null || name.isBlank()) {
        continue;
      }

      Integer uid = task.getUniqueID();
      if (uid == null) {
        dto.getWarnings().add("Skipped task without unique ID: " + name);
        continue;
      }

      ParsedTaskDto parsedTask = new ParsedTaskDto();
      parsedTask.setUid(uid);
      parsedTask.setId(task.getID());
      parsedTask.setName(name.trim());
      parsedTask.setWbs(task.getWBS());
      parsedTask.setOutlineLevel(task.getOutlineLevel());
      parsedTask.setSummary(task.getSummary());
      parsedTask.setStartDate(formatDate(task.getStart()));
      parsedTask.setFinishDate(formatDate(task.getFinish()));
      // Primary baseline is getBaseline*(); indexed overloads are Baseline1–10 only (1..10).
      // getBaseline*(0) throws: "0 is not a valid field index".
      parsedTask.setBaselineStartDate(formatDate(task.getBaselineStart()));
      parsedTask.setBaselineFinishDate(formatDate(task.getBaselineFinish()));
      parsedTask.setDurationDays(toDurationDays(task.getDuration(), projectProperties));
      parsedTask.setBaselineDurationDays(
          toDurationDays(task.getBaselineDuration(), projectProperties));
      parsedTask.setActualStartDate(formatDate(task.getActualStart()));
      parsedTask.setActualFinishDate(formatDate(task.getActualFinish()));
      parsedTask.setPercentComplete(toPercent(task.getPercentageComplete()));

      Task parent = task.getParentTask();
      if (parent != null && parent.getUniqueID() != null) {
        parsedTask.setParentUid(parent.getUniqueID());
      }

      for (Relation relation : task.getPredecessors()) {
        if (relation == null || relation.getPredecessorTask() == null) {
          continue;
        }

        Integer predecessorUid = relation.getPredecessorTask().getUniqueID();
        if (predecessorUid == null) {
          continue;
        }

        ParsedPredecessorDto predecessor = new ParsedPredecessorDto();
        predecessor.setPredecessorUid(predecessorUid);
        predecessor.setType(mapRelationType(relation.getType()));
        predecessor.setLagDays(toLagDays(relation.getLag(), projectProperties));
        parsedTask.getPredecessors().add(predecessor);
      }

      dto.getTasks().add(parsedTask);
    }

    // Prefer outline-0 project summary for schedule/baseline at project level.
    ParsedTaskDto projectSummary = null;
    for (ParsedTaskDto task : dto.getTasks()) {
      if (task.isSummary() && task.getOutlineLevel() != null && task.getOutlineLevel() == 0) {
        projectSummary = task;
        break;
      }
    }
    if (projectSummary != null) {
      if (projectSummary.getStartDate() != null) {
        properties.setStartDate(projectSummary.getStartDate());
      }
      if (projectSummary.getFinishDate() != null) {
        properties.setFinishDate(projectSummary.getFinishDate());
      }
      properties.setBaselineStartDate(projectSummary.getBaselineStartDate());
      properties.setBaselineFinishDate(projectSummary.getBaselineFinishDate());
      properties.setDurationDays(projectSummary.getDurationDays());
      properties.setBaselineDurationDays(projectSummary.getBaselineDurationDays());
    }

    for (Resource resource : project.getResources()) {
      if (resource == null) {
        continue;
      }

      String name = resource.getName();
      if (name == null || name.isBlank()) {
        continue;
      }

      Integer uid = resource.getUniqueID();
      if (uid == null) {
        continue;
      }

      ParsedResourceDto parsedResource = new ParsedResourceDto();
      parsedResource.setUid(uid);
      parsedResource.setName(name.trim());
      parsedResource.setEmail(resource.getEmailAddress());
      dto.getResources().add(parsedResource);
    }

    for (ResourceAssignment assignment : project.getResourceAssignments()) {
      if (assignment == null || assignment.getTask() == null || assignment.getResource() == null) {
        continue;
      }

      Integer taskUid = assignment.getTask().getUniqueID();
      Integer resourceUid = assignment.getResource().getUniqueID();
      if (taskUid == null || resourceUid == null) {
        continue;
      }

      ParsedAssignmentDto parsedAssignment = new ParsedAssignmentDto();
      parsedAssignment.setTaskUid(taskUid);
      parsedAssignment.setResourceUid(resourceUid);
      parsedAssignment.setUnits(toUnitsPercent(assignment.getUnits()));
      dto.getAssignments().add(parsedAssignment);
    }

    int exceptionDays = 0;
    for (org.mpxj.ProjectCalendar calendar : project.getCalendars()) {
      if (calendar == null || calendar.getCalendarExceptions() == null) {
        continue;
      }
      exceptionDays += calendar.getCalendarExceptions().size();
    }
    if (exceptionDays > 0) {
      dto.getWarnings()
          .add(
              "File contains "
                  + exceptionDays
                  + " calendar exception day(s). Project holidays are managed via Keka HR calendars in Cybsec (not overwritten from MPP).");
    }

    return dto;
  }

  private String formatDate(java.time.LocalDateTime value) {
    if (value == null) {
      return null;
    }
    return value.toLocalDate().format(ISO_DATE);
  }

  private Double toDurationDays(Duration duration, ProjectProperties properties) {
    if (duration == null) {
      return null;
    }

    double days = Duration.convertUnits(
            duration.getDuration(), duration.getUnits(), TimeUnit.DAYS, properties)
        .getDuration();
    if (days <= 0) {
      return null;
    }
    // One decimal place matches MSP display (e.g. 66.1 / 115.1).
    return Math.round(days * 10.0) / 10.0;
  }

  private Integer toPercent(Number value) {
    if (value == null) {
      return 0;
    }
    return (int) Math.round(value.doubleValue());
  }

  private Integer toLagDays(Duration lag, ProjectProperties properties) {
    if (lag == null) {
      return 0;
    }
    return (int) Math.round(
        Duration.convertUnits(lag.getDuration(), lag.getUnits(), TimeUnit.DAYS, properties)
            .getDuration());
  }

  private Integer toUnitsPercent(Number units) {
    if (units == null) {
      return 100;
    }
    return (int) Math.round(units.doubleValue() * 100);
  }

  private String mapRelationType(RelationType type) {
    if (type == null) {
      return "FS";
    }
    return switch (type) {
      case START_START -> "SS";
      case FINISH_FINISH -> "FF";
      case FINISH_START -> "FS";
      case START_FINISH -> "SF";
      default -> "FS";
    };
  }
}
