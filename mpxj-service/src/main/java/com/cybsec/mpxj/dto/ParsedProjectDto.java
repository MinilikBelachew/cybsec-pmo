package com.cybsec.mpxj.dto;

import java.util.ArrayList;
import java.util.List;

public class ParsedProjectDto {
  private ParsedProjectPropertiesDto project = new ParsedProjectPropertiesDto();
  private List<ParsedTaskDto> tasks = new ArrayList<>();
  private List<ParsedResourceDto> resources = new ArrayList<>();
  private List<ParsedAssignmentDto> assignments = new ArrayList<>();
  private List<String> warnings = new ArrayList<>();

  public ParsedProjectPropertiesDto getProject() {
    return project;
  }

  public void setProject(ParsedProjectPropertiesDto project) {
    this.project = project;
  }

  public List<ParsedTaskDto> getTasks() {
    return tasks;
  }

  public void setTasks(List<ParsedTaskDto> tasks) {
    this.tasks = tasks;
  }

  public List<ParsedResourceDto> getResources() {
    return resources;
  }

  public void setResources(List<ParsedResourceDto> resources) {
    this.resources = resources;
  }

  public List<ParsedAssignmentDto> getAssignments() {
    return assignments;
  }

  public void setAssignments(List<ParsedAssignmentDto> assignments) {
    this.assignments = assignments;
  }

  public List<String> getWarnings() {
    return warnings;
  }

  public void setWarnings(List<String> warnings) {
    this.warnings = warnings;
  }
}
