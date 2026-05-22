import { z } from "zod";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
} from "./constants";

type ValidationKey =
  | "titleRequired"
  | "titleTooLong"
  | "authorRequired"
  | "authorTooLong"
  | "voiceRequired"
  | "pdfRequired"
  | "pdfSize"
  | "pdfType"
  | "imageSize"
  | "imageType";

export const createUploadSchema = (t: (key: ValidationKey) => string) =>
  z.object({
    title: z.string().min(1, t("titleRequired")).max(100, t("titleTooLong")),
    author: z.string().min(1, t("authorRequired")).max(100, t("authorTooLong")),
    persona: z.string().min(1, t("voiceRequired")),
    pdfFile: z
      .instanceof(File, { message: t("pdfRequired") })
      .refine((file) => file.size <= MAX_FILE_SIZE, t("pdfSize"))
      .refine((file) => ACCEPTED_PDF_TYPES.includes(file.type), t("pdfType")),
    coverImage: z
      .instanceof(File)
      .optional()
      .refine((file) => !file || file.size <= MAX_IMAGE_SIZE, t("imageSize"))
      .refine(
        (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
        t("imageType"),
      ),
  });

export type BookUploadFormValues = z.infer<ReturnType<typeof createUploadSchema>>;
