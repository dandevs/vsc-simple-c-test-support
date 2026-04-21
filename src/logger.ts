import * as fs from "fs/promises";
import * as path from "path";

const LOG_FILENAME = "session.log";

let logDir: string | undefined;
let enabled = false;

export function setLogDirectory(dir: string): void {
  logDir = dir;
}

export function setLoggingEnabled(value: boolean): void {
  enabled = value;
}

export async function log(message: string): Promise<void> {
  if (!enabled || !logDir) {
    return;
  }

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  try {
    const logPath = path.join(logDir, LOG_FILENAME);
    await fs.appendFile(logPath, line, "utf-8");
  } catch {
    // Silently ignore log write failures
  }
}
