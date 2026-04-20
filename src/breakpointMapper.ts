import { BreakpointEntry } from "./types";

export interface SourceBreakpointLocation {
  fsPath: string;
  uri: string;
  zeroBasedLine: number;
}

export function toBreakpointEntries(
  breakpoints: readonly SourceBreakpointLocation[]
): BreakpointEntry[] {
  return breakpoints
    .map((bp) => ({
      filepath: (bp.fsPath || bp.uri).replace(/\\/g, "/"),
      line_number: bp.zeroBasedLine + 1,
    }))
    .sort((a, b) => {
      if (a.filepath === b.filepath) {
        return a.line_number - b.line_number;
      }

      return a.filepath.localeCompare(b.filepath);
    });
}
