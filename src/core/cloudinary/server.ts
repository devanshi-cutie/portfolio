import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { env } from "@/core/config/env";
import type { ResourceType } from "@/core/types/content";
import { isLocalPublicId } from "./paths";

const secrets = () => ({
  apiKey: (process.env.CLOUDINARY_API_KEY ?? "").trim(),
  apiSecret: (process.env.CLOUDINARY_API_SECRET ?? "").trim(),
});

/** Cloud name, API key and API secret are all set (needed to sign and destroy). */
export function isCloudinaryServerConfigured(): boolean {
  const { apiKey, apiSecret } = secrets();
  return env.cloudinaryCloudName !== "" && apiKey !== "" && apiSecret !== "";
}

let configured = false;
function client() {
  if (!isCloudinaryServerConfigured()) {
    throw new Error("Cloudinary is not configured");
  }
  if (!configured) {
    const { apiKey, apiSecret } = secrets();
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

/**
 * Signs upload params exactly as given (the widget sends `paramsToSign`; any
 * change here would break the signature). Callers validate the params first.
 */
export function signUploadParams(params: Record<string, unknown>): string {
  const { apiSecret } = secrets();
  if (!isCloudinaryServerConfigured()) {
    throw new Error("Cloudinary is not configured");
  }
  return cloudinary.utils.api_sign_request(params as Parameters<typeof cloudinary.utils.api_sign_request>[0], apiSecret);
}

/**
 * Deletes an asset and invalidates its CDN copies. No-op for `local:` ids.
 * "not found" counts as success so retries are safe.
 */
export async function destroyAsset(publicId: string, resourceType: ResourceType): Promise<void> {
  if (isLocalPublicId(publicId)) return;
  const result: { result?: string } = await client().uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
  if (result?.result !== "ok" && result?.result !== "not found") {
    throw new Error(`Cloudinary destroy failed for ${publicId}: ${result?.result ?? "unknown"}`);
  }
}
