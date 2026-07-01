import { api } from "@/core/api/api";
import type { FileAccessResponse, FileUploadResponse } from "../types/files.types";

export const filesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    uploadFile: builder.mutation<FileUploadResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return {
          url: "/files/upload",
          method: "POST",
          body: formData,
        };
      },
    }),
    getFileAccessUrl: builder.query<
      FileAccessResponse,
      { storageKey: string; filename?: string }
    >({
      query: ({ storageKey, filename }) => {
        const params = new URLSearchParams({ storageKey });
        if (filename) params.set("filename", filename);
        return `/files/access?${params.toString()}`;
      },
    }),
  }),
});

export const { useUploadFileMutation, useLazyGetFileAccessUrlQuery } = filesApi;
