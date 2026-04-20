import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_OUTPUT_FOLDER,
  resolveOutputFolder,
} from "../src/config";

test("resolveOutputFolder uses configured valid relative folder", () => {
  const result = resolveOutputFolder("build/debug");
  assert.equal(result.folderPath, "build/debug");
  assert.equal(result.warning, undefined);
});

test("resolveOutputFolder falls back for non-string", () => {
  const result = resolveOutputFolder(123);
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder falls back for empty string", () => {
  const result = resolveOutputFolder("");
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder falls back for whitespace-only string", () => {
  const result = resolveOutputFolder("   ");
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder trims whitespace", () => {
  const result = resolveOutputFolder("  build/out  ");
  assert.equal(result.folderPath, "build/out");
  assert.equal(result.warning, undefined);
});

test("resolveOutputFolder strips trailing slashes", () => {
  const result = resolveOutputFolder("build/out/");
  assert.equal(result.folderPath, "build/out");
  assert.equal(result.warning, undefined);
});

test("resolveOutputFolder allows workspace root", () => {
  const result = resolveOutputFolder(".");
  assert.equal(result.folderPath, ".");
  assert.equal(result.warning, undefined);
});

test("resolveOutputFolder rejects absolute paths", () => {
  const result = resolveOutputFolder("/tmp/out");
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder rejects drive-letter absolute paths", () => {
  const result = resolveOutputFolder("C:/temp/out");
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder rejects workspace-escape paths", () => {
  const result = resolveOutputFolder("../outside");
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder rejects parent directory reference", () => {
  const result = resolveOutputFolder("..");
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder rejects URI-like values", () => {
  const result = resolveOutputFolder("file:///tmp/out");
  assert.equal(result.folderPath, DEFAULT_OUTPUT_FOLDER);
  assert.ok(result.warning);
});

test("resolveOutputFolder normalizes backslashes", () => {
  const result = resolveOutputFolder("test_build\\nested\\deep");
  assert.equal(result.folderPath, "test_build/nested/deep");
  assert.equal(result.warning, undefined);
});
