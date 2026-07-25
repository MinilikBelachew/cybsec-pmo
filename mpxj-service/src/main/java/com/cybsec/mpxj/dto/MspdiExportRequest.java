package com.cybsec.mpxj.dto;

import java.util.ArrayList;
import java.util.List;

/** Schedule payload posted by Nest for Microsoft Project MSPDI export. */
public class MspdiExportRequest {
  private MspdiExportProjectPropertiesDto project;
  private List<MspdiExportTaskDto> tasks = new ArrayList<>();
  private List<MspdiExportDependencyDto> dependencies = new ArrayList<>();
  private List<MspdiExportHolidayDto> holidays = new ArrayList<>();
  private List<MspdiExportResourceDto> resources = new ArrayList<>();
  private List<MspdiExportAssignmentDto> assignments = new ArrayList<>();

  public MspdiExportProjectPropertiesDto getProject() {
    return project;
  }

  public void setProject(MspdiExportProjectPropertiesDto project) {
    this.project = project;
  }

  public List<MspdiExportTaskDto> getTasks() {
    return tasks;
  }

  public void setTasks(List<MspdiExportTaskDto> tasks) {
    this.tasks = tasks;
  }

  public List<MspdiExportDependencyDto> getDependencies() {
    return dependencies;
  }

  public void setDependencies(List<MspdiExportDependencyDto> dependencies) {
    this.dependencies = dependencies;
  }

  public List<MspdiExportHolidayDto> getHolidays() {
    return holidays;
  }

  public void setHolidays(List<MspdiExportHolidayDto> holidays) {
    this.holidays = holidays;
  }

  public List<MspdiExportResourceDto> getResources() {
    return resources;
  }

  public void setResources(List<MspdiExportResourceDto> resources) {
    this.resources = resources;
  }

  public List<MspdiExportAssignmentDto> getAssignments() {
    return assignments;
  }

  public void setAssignments(List<MspdiExportAssignmentDto> assignments) {
    this.assignments = assignments;
  }
}
