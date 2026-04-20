import * as path from "path";

export const DEFAULT_OUTPUT_FOLDER = "test_build";
export const BREAKPOINTS_FILENAME = "breakpoints.json";

export interface FolderResolution {
  folderPath: string;
  warning?: string;
}

function fallbackWithWarning(warning: string): FolderResolution {
  return {
    folderPath: DEFAULT_OUTPUT_FOLDER,
    warning,
  };
}

export function resolveOutputFolder(rawPath: unknown): FolderResolution {
  if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
    return fallbackWithWarning(
      `Invalid breakpointServer.outputFolderPath setting. Falling back to default: ${DEFAULT_OUTPUT_FOLDER}`
    );
  }

  const trimmed = rawPath.trim().replace(/\\/g, "/").replace(/\/+$/, "");

  if (
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) &&
    !/^[a-zA-Z]:/.test(trimmed)
  ) {
    return fallbackWithWarning(
      `breakpointServer.outputFolderPath must be a plain relative path. Falling back to default: ${DEFAULT_OUTPUT_FOLDER}`
    );
  }

  if (trimmed === "") {
    return { folderPath: "." };
  }

  const normalized = path.normalize(trimmed).replace(/\\/g, "/");

  if (path.isAbsolute(normalized)) {
    return fallbackWithWarning(
      `breakpointServer.outputFolderPath must be a relative path. Falling back to default: ${DEFAULT_OUTPUT_FOLDER}`
    );
  }

  if (/^[a-zA-Z]:/.test(normalized)) {
    return fallbackWithWarning(
      `breakpointServer.outputFolderPath must be relative to the workspace folder. Falling back to default: ${DEFAULT_OUTPUT_FOLDER}`
    );
  }

  if (normalized !== "." && normalized.split("/").includes("..")) {
    return fallbackWithWarning(
      `breakpointServer.outputFolderPath cannot escape the workspace folder. Falling back to default: ${DEFAULT_OUTPUT_FOLDER}`
    );
  }

  return { folderPath: normalized };
}
