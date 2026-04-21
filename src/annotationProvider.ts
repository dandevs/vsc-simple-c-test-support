import * as fs from "fs/promises";
import * as path from "path";
import { FSWatcher, watch } from "fs";
import { log } from "./logger";
import { DbJson, DbJsonEntry } from "./types";

export class AnnotationProvider {
  private dbPath: string;
  private watcher?: FSWatcher;
  private annotations: Map<string, Map<number, string>> = new Map();
  private debounceTimer?: NodeJS.Timeout;
  private disposed = false;

  constructor(outputFolderPath: string) {
    this.dbPath = path.join(outputFolderPath, "db.json");
  }

  async load(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      const content = await fs.readFile(this.dbPath, "utf-8");
      const db = JSON.parse(content) as DbJson;
      log(`[Annotations] Loaded db.json from ${this.dbPath}`);
      this.parseAnnotations(db);
      log(`[Annotations] Parsed ${this.annotations.size} files with annotations`);
      for (const [fp, lines] of this.annotations) {
        log(`[Annotations]   ${fp}: ${Array.from(lines.keys()).join(", ")}`);
      }
    } catch (err) {
      log(`[Annotations] Failed to load db.json: ${err}`);
      this.annotations.clear();
    }
  }

  watch(onChange: () => void): void {
    if (this.disposed || this.watcher) {
      return;
    }

    try {
      this.watcher = watch(this.dbPath, (eventType) => {
        if (eventType !== "change") {
          return;
        }

        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          this.load().then(onChange, onChange);
        }, 100);
      });
    } catch {
      // File doesn't exist yet; ignore
    }
  }

  getAnnotations(filePath: string): Map<number, string> | undefined {
    const normalized = path.resolve(filePath);
    return this.annotations.get(normalized);
  }

  private parseAnnotations(db: DbJson): void {
    const newAnnotations = new Map<string, Map<number, string>>();

    for (const [testFilePath, entry] of Object.entries(db.tests ?? {})) {
      const fileAnnotations = this.extractFileAnnotations(entry);

      for (const [sourcePath, lines] of fileAnnotations) {
        const normalizedSourcePath = path.resolve(sourcePath);
        let fileMap = newAnnotations.get(normalizedSourcePath);
        if (!fileMap) {
          fileMap = new Map();
          newAnnotations.set(normalizedSourcePath, fileMap);
        }

        for (const [lineNumber, snapshots] of lines) {
          const existing = fileMap.get(lineNumber);
          if (existing) {
            fileMap.set(lineNumber, this.mergeSnapshots(existing, snapshots));
          } else {
            fileMap.set(lineNumber, this.formatSnapshots(snapshots));
          }
        }
      }
    }

    this.annotations = newAnnotations;
  }

  private mergeSnapshots(
    existing: string,
    newSnapshots: string[]
  ): string {
    // Parse existing and new, then recombine
    const existingParsed = this.parseSnapshotTokens(existing);
    const newParsed = this.parseSnapshotTokens(newSnapshots.join(" "));

    const combined = new Map<string, string[]>();
    for (const [key, values] of existingParsed) {
      combined.set(key, [...values]);
    }
    for (const [key, values] of newParsed) {
      const current = combined.get(key);
      if (current) {
        current.push(...values);
      } else {
        combined.set(key, [...values]);
      }
    }

    return this.formatKeyValues(combined);
  }

  private formatSnapshots(snapshots: string[]): string {
    const keyValues = this.parseSnapshotTokens(snapshots.join(" "));
    return this.formatKeyValues(keyValues);
  }

  private parseSnapshotTokens(snapshotString: string): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    const tokens = snapshotString.match(/\[[^\]]+\]/g) || [];

    for (const token of tokens) {
      const inner = token.slice(1, -1);
      const eqIdx = inner.indexOf("=");
      if (eqIdx === -1) {
        groups.set(inner, []);
        continue;
      }
      const key = inner.slice(0, eqIdx);
      const value = inner.slice(eqIdx + 1);
      const list = groups.get(key);
      if (list) {
        list.push(value);
      } else {
        groups.set(key, [value]);
      }
    }

    return groups;
  }

  private formatKeyValues(keyValues: Map<string, string[]>): string {
    const parts: string[] = [];

    for (const [key, values] of keyValues) {
      if (values.length === 0) {
        parts.push(`[${key}]`);
        continue;
      }

      // Take last 3 values
      const last3 = values.slice(-3);

      // If all last 3 are the same, show single value
      const allSame = last3.every((v) => v === last3[0]);
      if (allSame) {
        parts.push(`[${key}=${last3[0]}]`);
      } else {
        parts.push(`[${key}=${last3.join(",")}]`);
      }
    }

    return parts.join(" ");
  }

  private extractFileAnnotations(
    entry: DbJsonEntry
  ): Map<string, [number, string[]][]> {
    const result = new Map<string, [number, string[]][]>();

    for (const [filePath, annotations] of Object.entries(
      entry.story_annotations ?? {}
    )) {
      const parsed = annotations.map(
        ([lineNumber, snapshots]): [number, string[]] => [
          lineNumber,
          snapshots,
        ]
      );
      result.set(filePath, parsed);
    }

    return result;
  }

  dispose(): void {
    this.disposed = true;
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }
}
