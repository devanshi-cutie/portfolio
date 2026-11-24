/**
 * Cloudinary access for the seed: existence checks and uploads with the
 * node SDK. Builds its own configured instance — it must not import
 * `src/core/cloudinary/server` (server-only).
 */
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import type { ResourceType } from "@/core/types/content";
import { readEnv } from "../lib/env";

/** 20 MB chunks for upload_large. */
const CHUNK_SIZE = 20_000_000;
/** per-request timeout; a 20 MB chunk on a slow uplink can take minutes */
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
/** above this, even images go through upload_large */
const LARGE_FILE_BYTES = 20 * 1024 * 1024;

export interface AssetMeta {
  publicId: string;
  resourceType: ResourceType;
  format: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  bytes: number | null;
}

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Credentials from env, or the list of missing variable names. */
export function readCloudinaryCredentials(): CloudinaryCredentials | { missing: string[] } {
  const cloudName = readEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  const apiKey = readEnv("CLOUDINARY_API_KEY") ?? readEnv("NEXT_PUBLIC_CLOUDINARY_API_KEY");
  const apiSecret = readEnv("CLOUDINARY_API_SECRET");
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  const missing: string[] = [];
  if (!cloudName) missing.push("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  if (!apiKey) missing.push("CLOUDINARY_API_KEY");
  if (!apiSecret) missing.push("CLOUDINARY_API_SECRET");
  return { missing };
}

export function configureCloudinary(credentials: CloudinaryCredentials): void {
  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    secure: true,
  });
}

/** The SDK rejects with `{ error: { message, http_code } }` or an Error; normalise both. */
export function cloudinaryError(error: unknown): { message: string; httpCode?: number } {
  if (error && typeof error === "object") {
    const inner = "error" in error && error.error && typeof error.error === "object" ? error.error : error;
    const message = "message" in inner && typeof inner.message === "string" ? inner.message : String(inner);
    const httpCode = "http_code" in inner && typeof inner.http_code === "number" ? inner.http_code : undefined;
    return { message, httpCode };
  }
  return { message: String(error) };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMeta(raw: Record<string, unknown>, fallbackType: ResourceType): AssetMeta {
  const type = raw.resource_type === "video" || raw.resource_type === "image" ? raw.resource_type : fallbackType;
  return {
    publicId: String(raw.public_id),
    resourceType: type,
    format: typeof raw.format === "string" ? raw.format : null,
    width: num(raw.width),
    height: num(raw.height),
    duration: num(raw.duration),
    bytes: num(raw.bytes),
  };
}

/** Confirms the credentials work before any upload starts. */
export async function pingCloudinary(): Promise<void> {
  try {
    await cloudinary.api.ping();
  } catch (error) {
    const { message, httpCode } = cloudinaryError(error);
    const hint =
      httpCode === 401 || /api_key|api_secret|cloud_name|Invalid Signature/i.test(message)
        ? " — check NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
        : "";
    throw new Error(`Cloudinary check failed: ${message}${hint}`);
  }
}

/** Metadata of an existing asset, or null if it does not exist. */
export async function findAsset(publicId: string, resourceType: ResourceType): Promise<AssetMeta | null> {
  try {
    const raw = (await cloudinary.api.resource(publicId, { resource_type: resourceType })) as Record<string, unknown>;
    return toMeta(raw, resourceType);
  } catch (error) {
    const { message, httpCode } = cloudinaryError(error);
    if (httpCode === 404) return null;
    throw new Error(`Cloudinary lookup failed for ${publicId}: ${message}`);
  }
}

export interface UploadParams {
  filePath: string;
  bytes: number;
  publicId: string;
  assetFolder: string;
  resourceType: ResourceType;
  /** replace an existing asset (only with --force) */
  overwrite: boolean;
}

export async function uploadAsset(params: UploadParams): Promise<AssetMeta> {
  const options: UploadApiOptions = {
    resource_type: params.resourceType,
    public_id: params.publicId,
    // dynamic-folder accounts place assets by asset_folder; fixed-folder ones use the public_id path
    asset_folder: params.assetFolder,
    overwrite: params.overwrite,
    invalidate: params.overwrite,
    unique_filename: false,
    use_filename: false,
    timeout: REQUEST_TIMEOUT_MS,
  };

  const useLarge = params.resourceType === "video" || params.bytes > LARGE_FILE_BYTES;
  try {
    const response = useLarge
      ? await new Promise<UploadApiResponse>((resolve, reject) => {
          // upload_large returns a stream, not a promise; the callback carries the result
          cloudinary.uploader.upload_large(params.filePath, { ...options, chunk_size: CHUNK_SIZE }, (error, result) => {
            if (error) reject(error);
            else if (!result) reject(new Error("empty response from Cloudinary"));
            else resolve(result);
          });
        })
      : await cloudinary.uploader.upload(params.filePath, options);
    return toMeta(response as unknown as Record<string, unknown>, params.resourceType);
  } catch (error) {
    throw new Error(`upload failed: ${cloudinaryError(error).message}`);
  }
}
