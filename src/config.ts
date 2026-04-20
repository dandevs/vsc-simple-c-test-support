import * as path from "path";

export const DEFAULT_OUTPUT_PATH = "test_build/breakpoints.json";

export interface PathResolution {
  outputPath: string;
  warning?: string;
}

function fallbackWithWarning(warning: string): PathResolution {
  return {
    outputPath: DEFAULT_OUTPUT_PATH,
    warning,
  };
}

export function resolveOutputPath(rawPath: unknown): PathResolution {
  if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
    return fallbackWithWarning(
      `Invalid breakpointServer.outputPath setting. Falling back to default: ${DEFAULT_OUTPUT_PATH}`
    );
  }

  const trimmed = rawPath.trim().replace(/\\/g, "/");

  if (
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) &&
    !/^[a-zA-Z]:/.test(trimmed)
  ) {
    return fallbackWithWarning(
      `breakpointServer.outputPath must be a plain relative file path. Falling back to default: ${DEFAULT_OUTPUT_PATH}`
    );
  }

  const normalized = path.normalize(trimmed);
  const normalizedForward = normalized.replace(/\\/g, "/");

  if (/[\\/]$/.test(trimmed)) {
    return fallbackWithWarning(
      `breakpointServer.outputPath must include a file name. Falling back to default: ${DEFAULT_OUTPUT_PATH}`
    );
  }

  if (normalizedForward === "." || normalizedForward === "..") {
    return fallbackWithWarning(
      `breakpointServer.outputPath must point to a file path. Falling back to default: ${DEFAULT_OUTPUT_PATH}`
    );
  }

  if (path.isAbsolute(normalized)) {
    return fallbackWithWarning(
      `breakpointServer.outputPath must be a relative path. Falling back to default: ${DEFAULT_OUTPUT_PATH}`
    );
  }

  if (/^[a-zA-Z]:/.test(normalizedForward)) {
    return fallbackWithWarning(
      `breakpointServer.outputPath must be relative to the workspace folder. Falling back to default: ${DEFAULT_OUTPUT_PATH}`
    );
  }

  if (normalizedForward.split("/").includes("..")) {
    return fallbackWithWarning(
      `breakpointServer.outputPath cannot escape the workspace folder. Falling back to default: ${DEFAULT_OUTPUT_PATH}`
    );
  }

  return { outputPath: normalizedForward };
}
