export interface UploadedFile {
  id: string;
  path: string;
}

export interface FileUploadResponse {
  file: UploadedFile;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}
