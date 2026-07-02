package com.cybsec.mpxj.web;

import com.cybsec.mpxj.dto.ParsedProjectDto;
import com.cybsec.mpxj.service.MppParseService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class ParseController {
  private final MppParseService parseService;

  public ParseController(MppParseService parseService) {
    this.parseService = parseService;
  }

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "ok");
  }

  @PostMapping(value = "/parse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ParsedProjectDto parse(@RequestParam("file") MultipartFile file) throws Exception {
    return parseService.parse(file);
  }

  @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException error) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("error", error.getMessage()));
  }

  @org.springframework.web.bind.annotation.ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handleError(Exception error) {
    String message = error.getMessage() == null ? "Failed to parse project file" : error.getMessage();
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
        .body(Map.of("error", message));
  }
}
