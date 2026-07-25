package com.cybsec.mpxj.dto;

/** Work resource written to MSPDI Resources (Resource Names column). */
public class MspdiExportResourceDto {
  /** Stable id from Nest (user UUID) used to resolve assignments. */
  private String id;
  /** MSP display name, typically "Name (Organization)". */
  private String name;
  private String email;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }
}
