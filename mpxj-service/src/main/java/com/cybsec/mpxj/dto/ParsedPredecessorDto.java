package com.cybsec.mpxj.dto;

public class ParsedPredecessorDto {
  private Integer predecessorUid;
  private String type;
  private Integer lagDays;

  public Integer getPredecessorUid() {
    return predecessorUid;
  }

  public void setPredecessorUid(Integer predecessorUid) {
    this.predecessorUid = predecessorUid;
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
