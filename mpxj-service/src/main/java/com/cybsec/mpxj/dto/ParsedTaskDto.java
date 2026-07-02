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
  private Integer parentUid;
  private String startDate;
  private String finishDate;
  private Integer durationDays;
  private Integer percentComplete;
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

  public Integer getDurationDays() {
    return durationDays;
  }

  public void setDurationDays(Integer durationDays) {
    this.durationDays = durationDays;
  }

  public Integer getPercentComplete() {
    return percentComplete;
  }

  public void setPercentComplete(Integer percentComplete) {
    this.percentComplete = percentComplete;
  }

  public List<ParsedPredecessorDto> getPredecessors() {
    return predecessors;
  }

  public void setPredecessors(List<ParsedPredecessorDto> predecessors) {
    this.predecessors = predecessors;
  }
}
