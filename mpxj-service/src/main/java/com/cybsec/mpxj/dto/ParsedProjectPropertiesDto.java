package com.cybsec.mpxj.dto;

public class ParsedProjectPropertiesDto {
  private String name;
  private String startDate;
  private String finishDate;
  private String baselineStartDate;
  private String baselineFinishDate;
  private Double durationDays;
  private Double baselineDurationDays;
  /** Project-level Cost (outline-0 summary). 0/missing is omitted so Cybsec can fall back to 1. */
  private Double cost;

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

  public Double getBaselineDurationDays() {
    return baselineDurationDays;
  }

  public void setBaselineDurationDays(Double baselineDurationDays) {
    this.baselineDurationDays = baselineDurationDays;
  }

  public Double getCost() {
    return cost;
  }

  public void setCost(Double cost) {
    this.cost = cost;
  }
}
