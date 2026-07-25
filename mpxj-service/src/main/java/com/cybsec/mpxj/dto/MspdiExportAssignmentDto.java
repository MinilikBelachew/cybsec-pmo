package com.cybsec.mpxj.dto;

/** Task ↔ resource assignment for MSPDI (drives Resource Names on tasks). */
public class MspdiExportAssignmentDto {
  private String taskId;
  private String resourceId;
  /** Assignment units as a fraction (1.0 = 100%). */
  private Double units;

  public String getTaskId() {
    return taskId;
  }

  public void setTaskId(String taskId) {
    this.taskId = taskId;
  }

  public String getResourceId() {
    return resourceId;
  }

  public void setResourceId(String resourceId) {
    this.resourceId = resourceId;
  }

  public Double getUnits() {
    return units;
  }

  public void setUnits(Double units) {
    this.units = units;
  }
}
