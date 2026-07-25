package com.cybsec.mpxj.web;

import com.cybsec.mpxj.dto.MspdiExportRequest;
import com.cybsec.mpxj.dto.ParsedProjectDto;
import com.cybsec.mpxj.service.MspdiExportService;
import com.cybsec.mpxj.service.MppParseService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class ParseController {
  private final MppParseService parseService;
  private final MspdiExportService exportService;

  public ParseController(MppParseService parseService, MspdiExportService exportService) {
    this.parseService = parseService;
    this.exportService = exportService;
  }

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "ok");
  }

  @PostMapping(value = "/parse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ParsedProjectDto parse(@RequestParam("file") MultipartFile file) throws Exception {
    return parseService.parse(file);
  }

  /**
   * Builds Microsoft Project XML (MSPDI). Binary {@code .mpp} cannot be written by MPXJ;
   * MSPDI is the supported export format and opens in MS Project.
   */
  @PostMapping(value = "/export/mspdi", consumes = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<byte[]> export(@RequestBody MspdiExportRequest request) throws Exception {
    byte[] body = exportService.exportMspdi(request);
    String filename = "schedule.xml";
    if (request.getProject() != null
        && request.getProject().getName() != null
        && !request.getProject().getName().isBlank()) {
      filename =
          request.getProject().getName().trim().replaceAll("[\\\\/:*?\"<>|]+", "_") + ".xml";
    }

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(MediaType.APPLICATION_XML)
        .body(body);
  }

  @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException error) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("error", error.getMessage()));
  }

  @org.springframework.web.bind.annotation.ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handleError(Exception error) {
    String message = error.getMessage() == null ? "Failed to process project file" : error.getMessage();
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
        .body(Map.of("error", message));
  }
}
