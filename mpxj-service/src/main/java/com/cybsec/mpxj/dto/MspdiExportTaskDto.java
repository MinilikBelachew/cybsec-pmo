package com.cybsec.mpxj.dto;

public class MspdiExportTaskDto {
  /** Stable id from Nest (UUID) used to resolve dependency endpoints. */
  private String id;
  private String name;
  private String parentId;
  private boolean summary;
  private Integer outlineLevel;
  private String startDate;
  private String finishDate;
  private String baselineStart;
  private String baselineFinish;
  private Double durationDays;
  private Double baselineDurationDays;
  private Integer startVarianceDays;
  private Integer finishVarianceDays;
  private Integer percentComplete;
  private Integer priority;
  private String notes;

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
}
