"use client";

import { useRef, useState, type ReactNode } from "react";
import { CldUploadWidget, type CloudinaryUploadWidgetInfo, type CloudinaryUploadWidgetResults } from "next-cloudinary";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { CloudinaryUploadResult } from "@/core/cloudinary/types";
import { useAdminConfig } from "../config-context";
import { Button, type ButtonProps } from "../ui/button";
import { Tooltip } from "../ui/tooltip";
import { setUploadWidgetOpen } from "./widget-state";

const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif", "gif", "heic", "heif"];
const VIDEO_FORMATS = ["mp4", "mov", "m4v", "webm"];
const MB = 1024 * 1024;

export function toUploadResult(info: CloudinaryUploadWidgetInfo): CloudinaryUploadResult {
  const raw = info as CloudinaryUploadWidgetInfo & { resource_type?: string; duration?: number };
  const resourceType = raw.resource_type === "video" ? "video" : raw.resource_type === "image" ? "image" : "raw";
  return {
    public_id: raw.public_id,
    resource_type: resourceType,
    format: raw.format ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    duration: typeof raw.duration === "number" ? raw.duration : null,
    bytes: raw.bytes ?? null,
  };
}

interface UploadButtonProps {
  /** sub-folder under the Cloudinary root */
  folder: "media" | "logos";
  multiple?: boolean;
  accept?: "media" | "image";
  /** persist one finished upload; throw or return false on failure */
  onUploaded: (upload: CloudinaryUploadResult) => Promise<boolean>;
  /** called once after the whole queue is saved */
  onDone?: (savedCount: number) => void;
  children?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

export function UploadButton({
  folder,
  multiple = false,
  accept = "media",
  onUploaded,
  onDone,
  children,
  variant = "primary",
  size = "md",
  className,
}: UploadButtonProps) {
  const { cloudinaryReady, cloudinaryFolder, preview } = useAdminConfig();
  const pending = useRef<Promise<boolean>[]>([]);
  const [saving, setSaving] = useState(0);

  const label = children ?? (
    <>
      <Upload aria-hidden /> Upload
    </>
  );

  if (!cloudinaryReady || preview) {
    const reason = !cloudinaryReady
      ? "Uploads are off until Cloudinary is connected (add the Cloudinary keys to the site's environment settings)."
      : "Uploads are off in preview mode. Connect Supabase so new files can be saved.";
    return (
      <Tooltip content={reason}>
        <span tabIndex={0} className="inline-flex rounded-md" aria-label={reason}>
          <Button variant={variant} size={size} className={className} disabled aria-disabled>
            {label}
          </Button>
        </span>
      </Tooltip>
    );
  }

  const formats = accept === "image" ? IMAGE_FORMATS : [...IMAGE_FORMATS, ...VIDEO_FORMATS];

  function handleSuccess(result: CloudinaryUploadWidgetResults) {
    if (!result.info || typeof result.info === "string") return;
    const upload = toUploadResult(result.info);
    setSaving((n) => n + 1);
    const job = onUploaded(upload)
      .catch(() => {
        toast.error(`Uploaded "${result.info && typeof result.info !== "string" ? result.info.original_filename : "file"}" but couldn't save it.`);
        return false;
      })
      .finally(() => setSaving((n) => n - 1));
    pending.current.push(job);
  }

  async function handleQueuesEnd() {
    const jobs = pending.current;
    pending.current = [];
    if (jobs.length === 0) return;
    const results = await Promise.all(jobs);
    onDone?.(results.filter(Boolean).length);
  }

  return (
    <CldUploadWidget
      signatureEndpoint="/api/cloudinary/sign"
      config={{
        cloud: {
          cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
        },
      }}
      options={{
        folder: `${cloudinaryFolder}/${folder}`,
        sources: ["local", "url", "camera"],
        multiple,
        maxFiles: multiple ? 30 : 1,
        resourceType: accept === "image" ? "image" : "auto",
        clientAllowedFormats: formats,
        maxFileSize: 100 * MB,
        maxImageFileSize: 20 * MB,
        maxVideoFileSize: 100 * MB,
        singleUploadAutoClose: !multiple,
        showAdvancedOptions: false,
        showPoweredBy: false,
      }}
      onOpen={() => setUploadWidgetOpen(true)}
      onClose={() => setUploadWidgetOpen(false)}
      onSuccess={handleSuccess}
      onQueuesEnd={handleQueuesEnd}
      onError={(error) => {
        const message = typeof error === "string" ? error : error?.statusText;
        toast.error(message ? `Upload failed: ${message}` : "Upload failed. Try again.");
      }}
    >
      {({ open, isLoading }) => (
        <Button
          variant={variant}
          size={size}
          className={className}
          pending={saving > 0}
          disabled={isLoading}
          onClick={() => open()}
        >
          {saving > 0 ? `Saving ${saving}…` : label}
        </Button>
      )}
    </CldUploadWidget>
  );
}
