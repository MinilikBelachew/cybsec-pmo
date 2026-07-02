package com.cybsec.mpxj.dto;

public class ParsedAssignmentDto {
  private Integer taskUid;
  private Integer resourceUid;
  private Integer units;

  public Integer getTaskUid() {
    return taskUid;
  }

  public void setTaskUid(Integer taskUid) {
    this.taskUid = taskUid;
  }

  public Integer getResourceUid() {
    return resourceUid;
  }

  public void setResourceUid(Integer resourceUid) {
    this.resourceUid = resourceUid;
  }

  public Integer getUnits() {
    return units;
  }

  public void setUnits(Integer units) {
    this.units = units;
  }
}
