/** The subset of a Cloudinary upload response the engine stores. */
export interface CloudinaryUploadResult {
  public_id: string;
  resource_type: "image" | "video" | "raw";
  format: string | null;
  width: number | null;
  height: number | null;
  /** seconds, videos only */
  duration?: number | null;
  bytes: number | null;
}
