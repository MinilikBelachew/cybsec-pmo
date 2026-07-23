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
      parsedTask.setDurationDays(toDurationDays(task.getDuration(), projectProperties));
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

    return dto;
  }

  private String formatDate(java.time.LocalDateTime value) {
    if (value == null) {
      return null;
    }
    return value.toLocalDate().format(ISO_DATE);
  }

  private Integer toDurationDays(Duration duration, ProjectProperties properties) {
    if (duration == null) {
      return null;
    }

    double days = Duration.convertUnits(
            duration.getDuration(), duration.getUnits(), TimeUnit.DAYS, properties)
        .getDuration();
    if (days <= 0) {
      return null;
    }
    return (int) Math.round(days);
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
