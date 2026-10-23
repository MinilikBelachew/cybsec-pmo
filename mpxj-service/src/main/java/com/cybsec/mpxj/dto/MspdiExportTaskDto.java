package com.cybsec.mpxj.dto;

import java.util.ArrayList;
import java.util.List;

public class MspdiExportTaskDto {
  /** Stable id from Nest (UUID) used to resolve dependency endpoints. */
  private String id;
  private String name;
  private String parentId;
  private boolean summary;
  private boolean milestone;
  private Integer outlineLevel;
  private String startDate;
  private String finishDate;
  private String baselineStart;
  private String baselineFinish;
  private Double durationDays;
  private Double workHours;
  private Double baselineDurationDays;
  private Integer startVarianceDays;
  private Integer finishVarianceDays;
  private Integer percentComplete;
  private Integer priority;
  private String notes;
  /** Manual or Auto. */
  private String taskMode;
  /** ASAP, ALAP, SNET, FNET, SNLT, FNLT, MSO, MFO. */
  private String constraintType;
  private String constraintDate;
  private List<ParsedCustomFieldValueDto> customFields = new ArrayList<>();

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getParentId() {
    return parentId;
  }

  public void setParentId(String parentId) {
    this.parentId = parentId;
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

  public Integer getOutlineLevel() {
    return outlineLevel;
  }

  public void setOutlineLevel(Integer outlineLevel) {
    this.outlineLevel = outlineLevel;
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

  public String getBaselineStart() {
    return baselineStart;
  }

  public void setBaselineStart(String baselineStart) {
    this.baselineStart = baselineStart;
  }

  public String getBaselineFinish() {
    return baselineFinish;
  }

  public void setBaselineFinish(String baselineFinish) {
    this.baselineFinish = baselineFinish;
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

  public Integer getStartVarianceDays() {
    return startVarianceDays;
  }

  public void setStartVarianceDays(Integer startVarianceDays) {
    this.startVarianceDays = startVarianceDays;
  }

  public Integer getFinishVarianceDays() {
    return finishVarianceDays;
  }

  public void setFinishVarianceDays(Integer finishVarianceDays) {
    this.finishVarianceDays = finishVarianceDays;
  }

  public Integer getPercentComplete() {
    return percentComplete;
  }

  public void setPercentComplete(Integer percentComplete) {
    this.percentComplete = percentComplete;
  }

  public Integer getPriority() {
    return priority;
  }

  public void setPriority(Integer priority) {
    this.priority = priority;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
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
}
