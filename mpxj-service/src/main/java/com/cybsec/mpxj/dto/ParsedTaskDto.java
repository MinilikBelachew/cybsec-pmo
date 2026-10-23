package com.cybsec.mpxj.dto;

import java.util.ArrayList;
import java.util.List;

public class ParsedTaskDto {
  private Integer uid;
  private Integer id;
  private String name;
  private String wbs;
  private Integer outlineLevel;
  private boolean summary;
  /** MS Project milestone flag (0-day checkpoint). */
  private boolean milestone;
  private Integer parentUid;
  private String startDate;
  private String finishDate;
  private String baselineStartDate;
  private String baselineFinishDate;
  /** Working days; may be fractional (e.g. 66.1). */
  private Double durationDays;
  /** Planned effort hours from MSP Work. */
  private Double workHours;
  private Double baselineDurationDays;
  private String actualStartDate;
  private String actualFinishDate;
  private Integer percentComplete;
  /** MS Project Cost on this row. Used only for project/L1 budget; not persisted as task cost. */
  private Double cost;
  /** MS Project Notes → Cybsec task/phase description. */
  private String notes;
  /**
   * MSP Priority (0–1000). Cybsec maps: Critical≈1000, High≈700, Medium≈500, Low≈300.
   */
  private Integer priority;
  /** Manual or Auto. */
  private String taskMode;
  /** ASAP, ALAP, SNET, FNET, SNLT, FNLT, MSO, MFO. */
  private String constraintType;
  /** Constraint date (ISO); null when ASAP/ALAP. */
  private String constraintDate;
  /** Non-empty MSP local custom field values (Text1, Flag2, …). */
  private List<ParsedCustomFieldValueDto> customFields = new ArrayList<>();
  private List<ParsedPredecessorDto> predecessors = new ArrayList<>();

  public Integer getUid() {
    return uid;
  }

  public void setUid(Integer uid) {
    this.uid = uid;
  }

  public Integer getId() {
    return id;
  }

  public void setId(Integer id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getWbs() {
    return wbs;
  }

  public void setWbs(String wbs) {
    this.wbs = wbs;
  }

  public Integer getOutlineLevel() {
    return outlineLevel;
  }

  public void setOutlineLevel(Integer outlineLevel) {
    this.outlineLevel = outlineLevel;
  }

  public boolean isSummary() {
    return summary;
  }

  public void setSummary(boolean summary) {
    this.summary = summary;
  }

  public boolean isMilestone() {
    return milestone;
  }

  public void setMilestone(boolean milestone) {
    this.milestone = milestone;
  }

  public Integer getParentUid() {
    return parentUid;
  }

  public void setParentUid(Integer parentUid) {
    this.parentUid = parentUid;
  }

  public String getStartDate() {
    return startDate;
  }

  public void setStartDate(String startDate) {
    this.startDate = startDate;
  }

  public String getFinishDate() {
    return finishDate;
  }

  public void setFinishDate(String finishDate) {
    this.finishDate = finishDate;
  }

  public String getBaselineStartDate() {
    return baselineStartDate;
  }

  public void setBaselineStartDate(String baselineStartDate) {
    this.baselineStartDate = baselineStartDate;
  }

  public String getBaselineFinishDate() {
    return baselineFinishDate;
  }

  public void setBaselineFinishDate(String baselineFinishDate) {
    this.baselineFinishDate = baselineFinishDate;
  }

  public Double getDurationDays() {
    return durationDays;
  }

  public void setDurationDays(Double durationDays) {
    this.durationDays = durationDays;
  }

  public Double getWorkHours() {
    return workHours;
  }

  public void setWorkHours(Double workHours) {
    this.workHours = workHours;
  }

  public Double getBaselineDurationDays() {
    return baselineDurationDays;
  }

  public void setBaselineDurationDays(Double baselineDurationDays) {
    this.baselineDurationDays = baselineDurationDays;
  }

  public String getActualStartDate() {
    return actualStartDate;
  }

  public void setActualStartDate(String actualStartDate) {
    this.actualStartDate = actualStartDate;
  }

  public String getActualFinishDate() {
    return actualFinishDate;
  }

  public void setActualFinishDate(String actualFinishDate) {
    this.actualFinishDate = actualFinishDate;
  }

  public Integer getPercentComplete() {
    return percentComplete;
  }

  public void setPercentComplete(Integer percentComplete) {
    this.percentComplete = percentComplete;
  }

  public Double getCost() {
    return cost;
  }

  public void setCost(Double cost) {
    this.cost = cost;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }

  public Integer getPriority() {
    return priority;
  }

  public void setPriority(Integer priority) {
    this.priority = priority;
  }

  public String getTaskMode() {
    return taskMode;
  }

  public void setTaskMode(String taskMode) {
    this.taskMode = taskMode;
  }

  public String getConstraintType() {
    return constraintType;
  }

  public void setConstraintType(String constraintType) {
    this.constraintType = constraintType;
  }

  public String getConstraintDate() {
    return constraintDate;
  }

  public void setConstraintDate(String constraintDate) {
    this.constraintDate = constraintDate;
  }

  public List<ParsedCustomFieldValueDto> getCustomFields() {
    return customFields;
  }

  public void setCustomFields(List<ParsedCustomFieldValueDto> customFields) {
    this.customFields = customFields;
  }

  public List<ParsedPredecessorDto> getPredecessors() {
    return predecessors;
  }

  public void setPredecessors(List<ParsedPredecessorDto> predecessors) {
    this.predecessors = predecessors;
  }
}
