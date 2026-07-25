package com.cybsec.mpxj.dto;

public class MspdiExportProjectPropertiesDto {
  private String name;
  private String startDate;
  private String finishDate;
  private String baselineStart;
  private String baselineFinish;
  private Double durationDays;
  private Double baselineDurationDays;
  private Integer percentComplete;
  private Double durationVarianceDays;

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
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

  public Integer getPercentComplete() {
    return percentComplete;
  }

  public void setPercentComplete(Integer percentComplete) {
    this.percentComplete = percentComplete;
  }

  public Double getDurationVarianceDays() {
    return durationVarianceDays;
  }

  public void setDurationVarianceDays(Double durationVarianceDays) {
    this.durationVarianceDays = durationVarianceDays;
  }
}
