package com.cybsec.mpxj.dto;

/** One non-empty MSP custom field value on a task. */
public class ParsedCustomFieldValueDto {
  private String fieldName;
  private String value;

  public ParsedCustomFieldValueDto() {}

  public ParsedCustomFieldValueDto(String fieldName, String value) {
    this.fieldName = fieldName;
    this.value = value;
  }

  public String getFieldName() {
    return fieldName;
  }

  public void setFieldName(String fieldName) {
    this.fieldName = fieldName;
  }

  public String getValue() {
    return value;
  }

  public void setValue(String value) {
    this.value = value;
  }
}
