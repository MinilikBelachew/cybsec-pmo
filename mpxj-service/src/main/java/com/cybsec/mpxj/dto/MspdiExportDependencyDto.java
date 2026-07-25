package com.cybsec.mpxj.dto;

public class MspdiExportDependencyDto {
  private String predecessorId;
  private String successorId;
  private String type;
  private Integer lagDays;

  public String getPredecessorId() {
    return predecessorId;
  }

  public void setPredecessorId(String predecessorId) {
    this.predecessorId = predecessorId;
  }

  public String getSuccessorId() {
    return successorId;
  }

  public void setSuccessorId(String successorId) {
    this.successorId = successorId;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public Integer getLagDays() {
    return lagDays;
  }

  public void setLagDays(Integer lagDays) {
    this.lagDays = lagDays;
  }
}
