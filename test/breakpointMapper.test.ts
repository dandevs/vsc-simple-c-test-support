import test from "node:test";
import assert from "node:assert/strict";

import { toBreakpointEntries } from "../src/breakpointMapper";

test("toBreakpointEntries maps line numbers to 1-based", () => {
  const result = toBreakpointEntries([
    {
      fsPath: "C:/repo/src/a.ts",
      uri: "file:///C:/repo/src/a.ts",
      zeroBasedLine: 0,
    },
    {
      fsPath: "",
      uri: "vscode-remote://ssh-remote+box/work/b.ts",
      zeroBasedLine: 41,
    },
  ]);

  assert.deepEqual(result, [
    { filepath: "C:/repo/src/a.ts", line_number: 1 },
    {
      filepath: "vscode-remote://ssh-remote+box/work/b.ts",
      line_number: 42,
    },
  ]);
});

test("toBreakpointEntries normalizes backslashes to forward slashes", () => {
  const result = toBreakpointEntries([
    {
      fsPath: "C:\\Users\\Dan\\projects\\app\\src\\main.c",
      uri: "",
      zeroBasedLine: 9,
    },
  ]);

  assert.equal(result[0].filepath, "C:/Users/Dan/projects/app/src/main.c");
});
