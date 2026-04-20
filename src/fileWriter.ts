import * as fs from "fs/promises";
import * as path from "path";

import { BreakpointEntry } from "./types";

export async function writeBreakpointsFile(
  entries: readonly BreakpointEntry[],
  absolutePath: string
): Promise<void> {
  const dir = path.dirname(absolutePath);
  await fs.mkdir(dir, { recursive: true });
  const json = JSON.stringify(entries, null, 2);
  await fs.writeFile(absolutePath, json, "utf-8");
}
