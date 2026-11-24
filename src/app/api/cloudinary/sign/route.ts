import { getAdminUser, isPreviewUser } from "@/core/auth/guard";
import { isUnderRoot } from "@/core/cloudinary/paths";
import { isCloudinaryServerConfigured, signUploadParams } from "@/core/cloudinary/server";

/**
 * Signs upload params for next-cloudinary's `CldUploadWidget` (`signatureEndpoint`).
 * Body: `{ paramsToSign }`. Admin only. Params are signed exactly as received —
 * altering them would break the signature — so they are validated instead:
 * `folder` / `asset_folder` / `public_id` must sit under the creator's root folder.
 */

const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Relative public_id (combined with `folder` by Cloudinary): no traversal, no absolute paths. */
const isSafeRelativeId = (v: string) =>
  v !== "" && v.length <= 255 && !v.startsWith("/") && !v.includes("\\") && !v.split("/").some((s) => s === ".." || s === "." || s === "");

/** The only params the upload widget sends; anything else (eager, notification_url, overwrite, type, …) is refused. */
const ALLOWED_PARAMS = new Set([
  "timestamp",
  "folder",
  "asset_folder",
  "public_id",
  "source",
  "use_filename",
  "unique_filename",
  "filename_override",
  "tags",
  "context",
  "upload_preset",
]);

function validateParams(params: Record<string, unknown>): string | null {
  const unexpected = Object.keys(params).filter((k) => !ALLOWED_PARAMS.has(k));
  if (unexpected.length) return `Unsupported upload params: ${unexpected.slice(0, 5).join(", ")}`;
  if (typeof params.timestamp !== "number" && typeof params.timestamp !== "string") return "timestamp is required";

  const { folder, asset_folder: assetFolder, public_id: publicId } = params;

  for (const [name, value] of [
    ["folder", folder],
    ["asset_folder", assetFolder],
    ["public_id", publicId],
  ] as const) {
    if (value !== undefined && typeof value !== "string") return `${name} must be a string`;
  }

  if (typeof folder === "string" && !isUnderRoot(folder)) return "folder must be inside the site's root folder";
  if (typeof assetFolder === "string" && !isUnderRoot(assetFolder)) {
    return "asset_folder must be inside the site's root folder";
  }

  if (typeof folder === "string") {
    // public_id (if any) is relative to the folder.
    if (typeof publicId === "string" && !isSafeRelativeId(publicId)) return "public_id is not allowed";
    return null;
  }
  if (typeof publicId === "string") {
    return isUnderRoot(publicId) ? null : "public_id must be inside the site's root folder";
  }
  return "folder or public_id is required";
}

export async function POST(request: Request) {
  // Valid admin session cookie required; the read-only preview user may not upload.
  const user = await getAdminUser();
  if (!user || isPreviewUser(user)) return json({ error: "Unauthorized" }, 401);

  if (!isCloudinaryServerConfigured()) return json({ error: "Cloudinary is not configured" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!isPlainObject(body) || !isPlainObject(body.paramsToSign)) {
    return json({ error: "paramsToSign is required" }, 400);
  }

  const params = body.paramsToSign;
  if (Object.keys(params).length > 50) return json({ error: "Too many params" }, 400);
  const problem = validateParams(params);
  if (problem) return json({ error: problem }, 400);

  try {
    return json({ signature: signUploadParams(params) });
  } catch (err) {
    console.error("[api/cloudinary/sign] signing failed:", err);
    return json({ error: "Could not sign the upload" }, 500);
  }
}
