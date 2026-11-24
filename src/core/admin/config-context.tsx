"use client";

import { createContext, use, type ReactNode } from "react";

export interface AdminConfig {
  /** Supabase is not configured: everything is read-only */
  preview: boolean;
  /** Cloudinary credentials present: uploads are possible */
  cloudinaryReady: boolean;
  /** Cloudinary root folder, e.g. "creator-name" */
  cloudinaryFolder: string;
  /** public site URL for "View site" */
  siteUrl: string;
  /** creator name shown in the admin chrome */
  siteName: string;
}

const AdminConfigContext = createContext<AdminConfig>({
  preview: true,
  cloudinaryReady: false,
  cloudinaryFolder: "",
  siteUrl: "/",
  siteName: "",
});

export function AdminConfigProvider({ value, children }: { value: AdminConfig; children: ReactNode }) {
  return <AdminConfigContext value={value}>{children}</AdminConfigContext>;
}

export function useAdminConfig() {
  return use(AdminConfigContext);
}
