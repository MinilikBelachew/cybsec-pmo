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
  private Double baselineDurationDays;
  private String actualStartDate;
  private String actualFinishDate;
  private Integer percentComplete;
  /** MS Project Cost on this row. Used only for project/L1 budget; not persisted as task cost. */
  private Double cost;
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

  public List<ParsedPredecessorDto> getPredecessors() {
    return predecessors;
  }

  public void setPredecessors(List<ParsedPredecessorDto> predecessors) {
    this.predecessors = predecessors;
  }
}
