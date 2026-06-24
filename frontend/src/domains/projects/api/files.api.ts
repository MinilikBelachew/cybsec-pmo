import { api } from "@/core/api/api";
import type { FileUploadResponse } from "../types/files.types";

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
  }),
});

export const { useUploadFileMutation } = filesApi;
