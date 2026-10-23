package com.cybsec.mpxj.service;

import com.cybsec.mpxj.dto.ParsedAssignmentDto;
import com.cybsec.mpxj.dto.ParsedCustomFieldDefDto;
import com.cybsec.mpxj.dto.ParsedCustomFieldValueDto;
import com.cybsec.mpxj.dto.ParsedPredecessorDto;
import com.cybsec.mpxj.dto.ParsedProjectDto;
import com.cybsec.mpxj.dto.ParsedProjectPropertiesDto;
import com.cybsec.mpxj.dto.ParsedResourceDto;
import com.cybsec.mpxj.dto.ParsedTaskDto;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.mpxj.ConstraintType;
import org.mpxj.CustomField;
import org.mpxj.CustomFieldContainer;
import org.mpxj.Duration;
import org.mpxj.FieldType;
import org.mpxj.FieldTypeClass;
import org.mpxj.Priority;
import org.mpxj.ProjectCalendar;
import org.mpxj.ProjectFile;
import org.mpxj.ProjectProperties;
import org.mpxj.Relation;
import org.mpxj.RelationType;
import org.mpxj.Resource;
import org.mpxj.ResourceAssignment;
import org.mpxj.Task;
import org.mpxj.TaskMode;
import org.mpxj.TimeUnit;
import org.mpxj.mpp.MPPReader;
import org.mpxj.mspdi.MSPDIReader;
import org.mpxj.reader.UniversalProjectReader;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MppParseService {
  private static final DateTimeFormatter ISO_DATE_TIME =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
  private static final Pattern CUSTOM_SLOT =
      Pattern.compile(
          "^(TEXT|NUMBER|FLAG|DATE|COST|DURATION|START|FINISH)(\\d+)$",
          Pattern.CASE_INSENSITIVE);

  public ParsedProjectDto parse(MultipartFile file) throws Exception {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("File is required");
    }

    String filename =
        file.getOriginalFilename() == null
            ? ""
            : file.getOriginalFilename().toLowerCase(Locale.ROOT);
    if (!filename.endsWith(".mpp")
        && !filename.endsWith(".mpx")
        && !filename.endsWith(".xml")) {
      throw new IllegalArgumentException(
          "Unsupported file type. Use .mpp, .mpx, or MSPDI .xml");
    }

    byte[] bytes;
    try (InputStream inputStream = file.getInputStream()) {
      bytes = inputStream.readAllBytes();
    }

    ProjectFile project;
    try {
      if (filename.endsWith(".mpp")) {
        project = readMppResilient(bytes);
      } else if (filename.endsWith(".xml")) {
        // UniversalProjectReader returns null for MSPDI streams (no path sniffing).
        project = new MSPDIReader().read(new ByteArrayInputStream(bytes));
      } else {
        project = new UniversalProjectReader().read(new ByteArrayInputStream(bytes));
      }
    } catch (Exception error) {
      String detail =
          error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
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

    ensureUsableDefaultCalendar(project);
    return toDto(project);
  }

  /**
   * Prefer a lean MPPReader (no presentation data). On calendar NPEs common with
   * newer Project binaries, fall back to UniversalProjectReader.
   */
  private ProjectFile readMppResilient(byte[] bytes) throws Exception {
    List<Exception> failures = new ArrayList<>();

    try {
      MPPReader reader = new MPPReader();
      reader.setReadPresentationData(false);
      return reader.read(new ByteArrayInputStream(bytes));
    } catch (Exception first) {
      failures.add(first);
    }

    try {
      MPPReader reader = new MPPReader();
      reader.setReadPresentationData(true);
      return reader.read(new ByteArrayInputStream(bytes));
    } catch (Exception second) {
      failures.add(second);
    }

    try {
      return new UniversalProjectReader().read(new ByteArrayInputStream(bytes));
    } catch (Exception third) {
      failures.add(third);
    }

    Exception primary = failures.get(0);
    for (int i = 1; i < failures.size(); i++) {
      primary.addSuppressed(failures.get(i));
    }
    throw primary;
  }

  /** Avoid null default calendars that break duration/work conversion later. */
  private void ensureUsableDefaultCalendar(ProjectFile project) {
    try {
      if (project.getDefaultCalendar() != null) {
        return;
      }
      if (project.getCalendars() != null) {
        for (ProjectCalendar calendar : project.getCalendars()) {
          if (calendar != null) {
            project.setDefaultCalendar(calendar);
            return;
          }
        }
      }
      project.addDefaultBaseCalendar();
    } catch (Exception ignored) {
      // Best-effort — schedule rows may still import without calendar math.
    }
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

      Double rowCost = toPositiveCost(task.getCost());
      if (Boolean.TRUE.equals(task.getSummary())
          && task.getOutlineLevel() != null
          && task.getOutlineLevel() == 0
          && rowCost != null) {
        properties.setCost(rowCost);
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
      parsedTask.setMilestone(Boolean.TRUE.equals(task.getMilestone()));
      parsedTask.setStartDate(formatDate(task.getStart()));
      parsedTask.setFinishDate(formatDate(task.getFinish()));
      // Primary baseline is getBaseline*(); indexed overloads are Baseline1–10 only (1..10).
      // getBaseline*(0) throws: "0 is not a valid field index".
      parsedTask.setBaselineStartDate(formatDate(task.getBaselineStart()));
      parsedTask.setBaselineFinishDate(formatDate(task.getBaselineFinish()));
      parsedTask.setDurationDays(toDurationDays(task.getDuration(), projectProperties));
      parsedTask.setWorkHours(toWorkHours(task.getWork(), projectProperties));
      parsedTask.setBaselineDurationDays(
          toDurationDays(task.getBaselineDuration(), projectProperties));
      parsedTask.setActualStartDate(formatDate(task.getActualStart()));
      parsedTask.setActualFinishDate(formatDate(task.getActualFinish()));
      parsedTask.setPercentComplete(toPercent(task.getPercentageComplete()));
      parsedTask.setCost(rowCost);
      parsedTask.setPriority(toPriorityValue(task.getPriority()));
      parsedTask.setTaskMode(toTaskMode(task.getTaskMode()));
      parsedTask.setConstraintType(toConstraintTypeCode(task.getConstraintType()));
      // ASAP/ALAP typically have no meaningful constraint date (Project shows NA).
      if (needsConstraintDate(parsedTask.getConstraintType())) {
        parsedTask.setConstraintDate(formatDate(task.getConstraintDate()));
      }
      String notes = task.getNotes();
      if (notes != null && !notes.isBlank()) {
        parsedTask.setNotes(notes.trim());
      }
      parsedTask.setCustomFields(readTaskCustomValues(task, projectProperties));

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

    dto.setCustomFieldDefs(buildCustomFieldDefs(project, dto.getTasks()));

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
      if (projectSummary.getCost() != null) {
        properties.setCost(projectSummary.getCost());
      }
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
    try {
      if (project.getCalendars() != null) {
        for (ProjectCalendar calendar : project.getCalendars()) {
          if (calendar == null || calendar.getCalendarExceptions() == null) {
            continue;
          }
          exceptionDays += calendar.getCalendarExceptions().size();
        }
      }
    } catch (Exception ignored) {
      // Newer MPP calendars can NPE on hours/ranges; skip holiday warning only.
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

  private String formatDate(LocalDateTime value) {
    if (value == null) {
      return null;
    }
    return value.format(ISO_DATE_TIME);
  }

  /**
   * Catalog = aliased task custom fields ∪ any slot that has a non-empty value on at least one
   * task. Values themselves are only the non-empty ones (see {@link #readTaskCustomValues}).
   */
  private List<ParsedCustomFieldDefDto> buildCustomFieldDefs(
      ProjectFile project, List<ParsedTaskDto> tasks) {
    Map<String, ParsedCustomFieldDefDto> defs = new LinkedHashMap<>();

    CustomFieldContainer container = project.getCustomFields();
    if (container != null) {
      for (CustomField field : container) {
        if (field == null || field.getFieldType() == null) {
          continue;
        }
        FieldType type = field.getFieldType();
        if (type.getFieldTypeClass() != FieldTypeClass.TASK) {
          continue;
        }
        ParsedCustomFieldDefDto def = toCustomFieldDef(type, field.getAlias());
        if (def == null) {
          continue;
        }
        // Keep aliased fields even with no values yet.
        String alias = field.getAlias();
        if (alias != null && !alias.isBlank()) {
          def.setAlias(alias.trim());
          defs.put(def.getFieldName(), def);
        } else if (!defs.containsKey(def.getFieldName())) {
          defs.put(def.getFieldName(), def);
        }
      }
    }

    for (ParsedTaskDto task : tasks) {
      if (task.getCustomFields() == null) {
        continue;
      }
      for (ParsedCustomFieldValueDto value : task.getCustomFields()) {
        if (value == null || value.getFieldName() == null || value.getFieldName().isBlank()) {
          continue;
        }
        String name = value.getFieldName().trim();
        if (defs.containsKey(name)) {
          continue;
        }
        ParsedCustomFieldDefDto inferred = inferDefFromFieldName(name);
        if (inferred != null) {
          defs.put(name, inferred);
        }
      }
    }

    // Drop defs that have neither alias nor any task value.
    Map<String, Boolean> used = new LinkedHashMap<>();
    for (ParsedTaskDto task : tasks) {
      if (task.getCustomFields() == null) {
        continue;
      }
      for (ParsedCustomFieldValueDto value : task.getCustomFields()) {
        if (value != null && value.getFieldName() != null) {
          used.put(value.getFieldName().trim(), Boolean.TRUE);
        }
      }
    }

    List<ParsedCustomFieldDefDto> result = new ArrayList<>();
    for (ParsedCustomFieldDefDto def : defs.values()) {
      boolean hasAlias = def.getAlias() != null && !def.getAlias().isBlank();
      boolean hasValue = Boolean.TRUE.equals(used.get(def.getFieldName()));
      if (hasAlias || hasValue) {
        result.add(def);
      }
    }
    return result;
  }

  private ParsedCustomFieldDefDto toCustomFieldDef(FieldType type, String alias) {
    String raw = type.name();
    if (raw == null) {
      return null;
    }
    Matcher matcher = CUSTOM_SLOT.matcher(raw);
    if (!matcher.matches()) {
      return null;
    }
    String family = matcher.group(1).toUpperCase(Locale.ROOT);
    int index = Integer.parseInt(matcher.group(2));
    if (!isSupportedIndex(family, index)) {
      return null;
    }
    ParsedCustomFieldDefDto def = new ParsedCustomFieldDefDto();
    def.setType(family);
    def.setIndex(index);
    def.setFieldName(toFieldName(family, index));
    if (alias != null && !alias.isBlank()) {
      def.setAlias(alias.trim());
    }
    try {
      def.setFieldId(String.valueOf(type.getValue()));
    } catch (Exception ignored) {
      // optional
    }
    return def;
  }

  private ParsedCustomFieldDefDto inferDefFromFieldName(String fieldName) {
    Matcher m =
        Pattern.compile(
                "^(Text|Number|Flag|Date|Cost|Duration|Start|Finish)(\\d+)$",
                Pattern.CASE_INSENSITIVE)
            .matcher(fieldName);
    if (!m.matches()) {
      return null;
    }
    String family = m.group(1).toUpperCase(Locale.ROOT);
    int index = Integer.parseInt(m.group(2));
    if (!isSupportedIndex(family, index)) {
      return null;
    }
    ParsedCustomFieldDefDto def = new ParsedCustomFieldDefDto();
    def.setType(family);
    def.setIndex(index);
    def.setFieldName(toFieldName(family, index));
    def.setFieldId(String.valueOf(mspFieldId(family, index)));
    return def;
  }

  private boolean isSupportedIndex(String family, int index) {
    return switch (family) {
      case "TEXT" -> index >= 1 && index <= 30;
      case "NUMBER", "FLAG" -> index >= 1 && index <= 20;
      case "DATE", "COST", "DURATION", "START", "FINISH" -> index >= 1 && index <= 10;
      default -> false;
    };
  }

  private String toFieldName(String family, int index) {
    String label =
        switch (family) {
          case "TEXT" -> "Text";
          case "NUMBER" -> "Number";
          case "FLAG" -> "Flag";
          case "DATE" -> "Date";
          case "COST" -> "Cost";
          case "DURATION" -> "Duration";
          case "START" -> "Start";
          case "FINISH" -> "Finish";
          default -> family;
        };
    return label + index;
  }

  /** Local MSP custom field PIDs (pjCustomTask*). */
  private int mspFieldId(String family, int index) {
    int base =
        switch (family) {
          case "TEXT" -> 188743731;
          case "FLAG" -> 188743752;
          case "NUMBER" -> 188743767;
          case "DURATION" -> 188743783;
          case "COST" -> 188743786;
          case "DATE" -> 188743945;
          case "START" -> 188743971;
          case "FINISH" -> 188743973;
          default -> 188743731;
        };
    return base + (index - 1);
  }

  private List<ParsedCustomFieldValueDto> readTaskCustomValues(
      Task task, ProjectProperties properties) {
    List<ParsedCustomFieldValueDto> values = new ArrayList<>();

    for (int i = 1; i <= 30; i++) {
      String text = task.getText(i);
      if (text != null && !text.isBlank()) {
        values.add(new ParsedCustomFieldValueDto("Text" + i, text.trim()));
      }
    }
    for (int i = 1; i <= 20; i++) {
      Number number = task.getNumber(i);
      if (number != null && Double.isFinite(number.doubleValue())) {
        values.add(new ParsedCustomFieldValueDto("Number" + i, stripNumber(number)));
      }
    }
    for (int i = 1; i <= 20; i++) {
      // Flags default to false; only preserve true so empty slots stay empty.
      if (Boolean.TRUE.equals(task.getFlag(i))) {
        values.add(new ParsedCustomFieldValueDto("Flag" + i, "true"));
      }
    }
    for (int i = 1; i <= 10; i++) {
      LocalDateTime date = task.getDate(i);
      if (date != null) {
        values.add(new ParsedCustomFieldValueDto("Date" + i, formatDate(date)));
      }
    }
    for (int i = 1; i <= 10; i++) {
      Number cost = task.getCost(i);
      if (cost != null && Double.isFinite(cost.doubleValue())) {
        values.add(new ParsedCustomFieldValueDto("Cost" + i, stripNumber(cost)));
      }
    }
    for (int i = 1; i <= 10; i++) {
      Duration duration = task.getDuration(i);
      Double days = toDurationDays(duration, properties);
      if (days != null) {
        values.add(new ParsedCustomFieldValueDto("Duration" + i, stripNumber(days)));
      }
    }
    for (int i = 1; i <= 10; i++) {
      LocalDateTime start = task.getStart(i);
      if (start != null) {
        values.add(new ParsedCustomFieldValueDto("Start" + i, formatDate(start)));
      }
    }
    for (int i = 1; i <= 10; i++) {
      LocalDateTime finish = task.getFinish(i);
      if (finish != null) {
        values.add(new ParsedCustomFieldValueDto("Finish" + i, formatDate(finish)));
      }
    }

    return values;
  }

  private String stripNumber(Number value) {
    double d = value.doubleValue();
    if (Math.rint(d) == d) {
      return String.valueOf((long) d);
    }
    return String.valueOf(d);
  }

  private Double toDurationDays(Duration duration, ProjectProperties properties) {
    if (duration == null) {
      return null;
    }

    try {
      double days =
          Duration.convertUnits(
                  duration.getDuration(), duration.getUnits(), TimeUnit.DAYS, properties)
              .getDuration();
      // Keep 0 days (valid MSP value for milestones / some summaries); reject negatives only.
      if (days < 0 || !Double.isFinite(days)) {
        return null;
      }
      // One decimal place matches MSP display (e.g. 66.1 / 115.1).
      return Math.round(days * 10.0) / 10.0;
    } catch (Exception ignored) {
      return null;
    }
  }

  private Double toWorkHours(Duration work, ProjectProperties properties) {
    if (work == null) {
      return null;
    }

    try {
      double hours =
          Duration.convertUnits(work.getDuration(), work.getUnits(), TimeUnit.HOURS, properties)
              .getDuration();
      if (hours <= 0) {
        return null;
      }
      return Math.round(hours * 10.0) / 10.0;
    } catch (Exception ignored) {
      return null;
    }
  }

  private Double toPositiveCost(Number value) {
    if (value == null) {
      return null;
    }
    double amount = value.doubleValue();
    if (!Double.isFinite(amount) || amount <= 0) {
      return null;
    }
    return amount;
  }

  private Integer toPercent(Number value) {
    if (value == null) {
      return 0;
    }
    return (int) Math.round(value.doubleValue());
  }

  /** MSP Priority value 0–1000 (null → omit; Nest defaults to Medium). */
  private Integer toPriorityValue(Priority priority) {
    if (priority == null) {
      return null;
    }
    try {
      int value = priority.getValue();
      if (value < 0) {
        return 0;
      }
      if (value > 1000) {
        return 1000;
      }
      return value;
    } catch (Exception ignored) {
      return null;
    }
  }

  private String toTaskMode(TaskMode mode) {
    if (mode == null) {
      return "Manual";
    }
    return mode == TaskMode.AUTO_SCHEDULED ? "Auto" : "Manual";
  }

  private String toConstraintTypeCode(ConstraintType type) {
    if (type == null) {
      return "ASAP";
    }
    return switch (type) {
      case AS_SOON_AS_POSSIBLE -> "ASAP";
      case AS_LATE_AS_POSSIBLE -> "ALAP";
      case MUST_START_ON -> "MSO";
      case MUST_FINISH_ON -> "MFO";
      case START_NO_EARLIER_THAN -> "SNET";
      case START_NO_LATER_THAN -> "SNLT";
      case FINISH_NO_EARLIER_THAN -> "FNET";
      case FINISH_NO_LATER_THAN -> "FNLT";
      default -> "ASAP";
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

  private Integer toLagDays(Duration lag, ProjectProperties properties) {
    if (lag == null) {
      return 0;
    }
    try {
      return (int)
          Math.round(
              Duration.convertUnits(lag.getDuration(), lag.getUnits(), TimeUnit.DAYS, properties)
                  .getDuration());
    } catch (Exception ignored) {
      return 0;
    }
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
