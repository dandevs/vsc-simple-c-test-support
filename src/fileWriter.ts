import * as fs from "fs/promises";
import * as path from "path";

import { BreakpointEntry } from "./types";

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeBreakpointsFile(
  entries: readonly BreakpointEntry[],
  absolutePath: string
): Promise<boolean> {
  const dir = path.dirname(absolutePath);
  const dbPath = path.join(dir, "db.json");

  if (!(await exists(dir)) || !(await exists(dbPath))) {
    return false;
  }

  const json = JSON.stringify(entries, null, 2);
  await fs.writeFile(absolutePath, json, "utf-8");
  return true;
}
