import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_OUTPUT_PATH, resolveOutputPath } from "../src/config";

test("resolveOutputPath uses configured valid relative path", () => {
  const result = resolveOutputPath("output/bps.json");
  assert.equal(result.outputPath, "output/bps.json");
  assert.equal(result.warning, undefined);
});

test("resolveOutputPath falls back for non-string", () => {
  const result = resolveOutputPath(123);
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});

test("resolveOutputPath falls back for empty string", () => {
  const result = resolveOutputPath("");
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});

test("resolveOutputPath falls back for whitespace-only string", () => {
  const result = resolveOutputPath("   ");
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});

test("resolveOutputPath trims whitespace from valid path", () => {
  const result = resolveOutputPath("  build/bps.json  ");
  assert.equal(result.outputPath, "build/bps.json");
  assert.equal(result.warning, undefined);
});

test("resolveOutputPath rejects absolute paths", () => {
  const result = resolveOutputPath("/tmp/bps.json");
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});

test("resolveOutputPath rejects drive-letter absolute paths", () => {
  const result = resolveOutputPath("C:/temp/bps.json");
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});

test("resolveOutputPath rejects workspace-escape paths", () => {
  const result = resolveOutputPath("../outside/bps.json");
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});

test("resolveOutputPath rejects bare directory references", () => {
  const currentDir = resolveOutputPath(".");
  const parentDir = resolveOutputPath("..");
  assert.equal(currentDir.outputPath, DEFAULT_OUTPUT_PATH);
  assert.equal(parentDir.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(currentDir.warning);
  assert.ok(parentDir.warning);
});

test("resolveOutputPath rejects URI-like values", () => {
  const result = resolveOutputPath("file:///tmp/bps.json");
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});

test("resolveOutputPath normalizes backslashes", () => {
  const result = resolveOutputPath("test_build\\nested\\breakpoints.json");
  assert.equal(result.outputPath, "test_build/nested/breakpoints.json");
  assert.equal(result.warning, undefined);
});

test("resolveOutputPath rejects trailing separators", () => {
  const result = resolveOutputPath("test_build/output/");
  assert.equal(result.outputPath, DEFAULT_OUTPUT_PATH);
  assert.ok(result.warning);
});
