package com.cybsec.mpxj.dto;

/** Project-level MSP local custom field definition (alias / slot). */
public class ParsedCustomFieldDefDto {
  /** Slot name, e.g. Text1, Number2, Flag1. */
  private String fieldName;
  /** 1-based index within the type family. */
  private Integer index;
  /** TEXT, NUMBER, FLAG, DATE, COST, DURATION, START, FINISH. */
  private String type;
  /** User-visible alias, e.g. "Pending Action". */
  private String alias;
  /** MSP FieldID / PID when known. */
  private String fieldId;

  public String getFieldName() {
    return fieldName;
  }

  public void setFieldName(String fieldName) {
    this.fieldName = fieldName;
  }

  public Integer getIndex() {
    return index;
  }

  public void setIndex(Integer index) {
    this.index = index;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public String getAlias() {
    return alias;
  }

  public void setAlias(String alias) {
    this.alias = alias;
  }

  public String getFieldId() {
    return fieldId;
  }

  public void setFieldId(String fieldId) {
    this.fieldId = fieldId;
  }
}
