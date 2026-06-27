import { VERSION_CONFIG } from "./version";

export const APP_CONFIG = {
  name: "BAM League",
  displayName: "BAM Team Generator",
  description:
    "Basketball league management, draft, stats and dashboard system",
  environment: process.env.NODE_ENV || "development",
  debug: process.env.NODE_ENV !== "production",
  version: VERSION_CONFIG.version,
  phase: VERSION_CONFIG.phase,
};
