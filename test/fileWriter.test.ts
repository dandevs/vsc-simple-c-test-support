import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import { writeBreakpointsFile } from "../src/fileWriter";
import { BreakpointEntry } from "../src/types";

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bp-test-"));
  await fs.writeFile(path.join(dir, "db.json"), "{}", "utf-8");
  return dir;
}

test("writeBreakpointsFile writes JSON when db.json exists", async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, "breakpoints.json");

  try {
    const entries: BreakpointEntry[] = [
      { filepath: "src/main.c", line_number: 10 },
      { filepath: "src/util.c", line_number: 5 },
    ];

    const result = await writeBreakpointsFile(entries, filePath);
    assert.equal(result, true);

    const content = await fs.readFile(filePath, "utf-8");
    assert.deepEqual(JSON.parse(content), entries);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("writeBreakpointsFile writes into subdirectory when db.json exists", async () => {
  const dir = await makeTempDir();
  const subDir = path.join(dir, "nested");
  await fs.mkdir(subDir);
  await fs.writeFile(path.join(subDir, "db.json"), "{}", "utf-8");
  const filePath = path.join(subDir, "breakpoints.json");

  try {
    const result = await writeBreakpointsFile([], filePath);
    assert.equal(result, true);

    const content = await fs.readFile(filePath, "utf-8");
    assert.deepEqual(JSON.parse(content), []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("writeBreakpointsFile overwrites existing file", async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, "breakpoints.json");

  try {
    await writeBreakpointsFile(
      [{ filepath: "old.c", line_number: 1 }],
      filePath
    );
    await writeBreakpointsFile(
      [{ filepath: "new.c", line_number: 2 }],
      filePath
    );

    const content = await fs.readFile(filePath, "utf-8");
    assert.deepEqual(JSON.parse(content), [
      { filepath: "new.c", line_number: 2 },
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("writeBreakpointsFile output is pretty-printed", async () => {
  const dir = await makeTempDir();
  const filePath = path.join(dir, "breakpoints.json");

  try {
    const entries: BreakpointEntry[] = [
      { filepath: "a.c", line_number: 1 },
    ];
    await writeBreakpointsFile(entries, filePath);

    const content = await fs.readFile(filePath, "utf-8");
    assert.equal(content, JSON.stringify(entries, null, 2));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("writeBreakpointsFile skips write when directory does not exist", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bp-test-"));
  const filePath = path.join(dir, "nonexistent", "breakpoints.json");

  try {
    const result = await writeBreakpointsFile(
      [{ filepath: "a.c", line_number: 1 }],
      filePath
    );
    assert.equal(result, false);

    await assert.rejects(() => fs.access(filePath));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("writeBreakpointsFile skips write when db.json is missing", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bp-test-"));
  const filePath = path.join(dir, "breakpoints.json");

  try {
    const result = await writeBreakpointsFile(
      [{ filepath: "a.c", line_number: 1 }],
      filePath
    );
    assert.equal(result, false);

    await assert.rejects(() => fs.access(filePath));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
