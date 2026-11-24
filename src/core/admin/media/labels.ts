import type { MediaItem, MediaKind } from "@/core/types/content";
import type { CloudinaryUploadResult } from "@/core/cloudinary/types";

export const KIND_LABELS: Record<MediaKind, string> = {
  reel: "Reel (vertical video)",
  video: "Video (horizontal)",
  photo: "Photo",
  bts: "Behind the scenes",
  logo: "Logo",
  portrait: "Portrait of you",
  other: "Other",
};

export const KIND_SHORT: Record<MediaKind, string> = {
  reel: "Reel",
  video: "Video",
  photo: "Photo",
  bts: "BTS",
  logo: "Logo",
  portrait: "Portrait",
  other: "Other",
};

export function mediaLabel(media: Pick<MediaItem, "title" | "publicId"> | null | undefined): string {
  if (!media) return "Untitled";
  if (media.title?.trim()) return media.title.trim();
  const tail = media.publicId.split("/").pop() ?? media.publicId;
  return tail.replace(/^local:/, "") || "Untitled";
}

/** Default kind for a fresh upload; a kind filter that fits the file wins. */
export function guessKind(upload: CloudinaryUploadResult, preferred?: MediaKind): MediaKind {
  const isVideo = upload.resource_type === "video";
  if (preferred) {
    const videoKinds: MediaKind[] = ["reel", "video", "bts", "other"];
    const imageKinds: MediaKind[] = ["photo", "bts", "logo", "portrait", "other"];
    if ((isVideo ? videoKinds : imageKinds).includes(preferred)) return preferred;
  }
  if (!isVideo) return "photo";
  const { width, height } = upload;
  return width && height && height > width ? "reel" : "video";
}

export function isVideo(media: Pick<MediaItem, "resourceType">) {
  return media.resourceType === "video";
}
