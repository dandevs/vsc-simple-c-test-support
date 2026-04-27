import * as fs from "fs/promises";
import * as path from "path";
import { FSWatcher, watch } from "fs";
import { log } from "./logger";
import { AnnotationEntry, DbJson, DbJsonEntry, DebugLine } from "./types";

interface StoredAnnotation {
  annotation: string;
}

export class AnnotationProvider {
  private dbPath: string;
  private outputFolderPath: string;
  private watcher?: FSWatcher;
  private annotations: Map<string, Map<number, StoredAnnotation>> = new Map();
  private debugLine?: DebugLine;
  private debounceTimer?: NodeJS.Timeout;
  private disposed = false;
  private active = true;

  constructor(outputFolderPath: string) {
    this.outputFolderPath = outputFolderPath;
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

      if (db.active === false) {
        this.active = false;
        this.annotations.clear();
        this.debugLine = undefined;
        log("[Annotations] active=false, annotations disabled");
        return;
      }

      this.active = true;
      this.parseAnnotations(db);
      this.parseDebugLine(db);
      log(`[Annotations] Parsed ${this.annotations.size} files with annotations`);
      for (const [fp] of this.annotations) {
        log(`[Annotations]   ${fp}`);
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        log("[Annotations] db.json not found, waiting for file...");
      } else {
        log(`[Annotations] Failed to load db.json: ${err}`);
      }
      this.annotations.clear();
      this.debugLine = undefined;
    }
  }

  watch(onChange: () => void): void {
    if (this.disposed || this.watcher) {
      return;
    }

    try {
      this.watcher = watch(this.outputFolderPath, (eventType, filename) => {
        if (filename !== "db.json") {
          return;
        }

        if (eventType !== "change" && eventType !== "rename") {
          return;
        }

        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          this.load().then(onChange, onChange);
        }, 100);
      });
      log(`[Annotations] Watching directory: ${this.outputFolderPath}`);
    } catch {
      // Directory doesn't exist yet; ignore
    }
  }

  getAnnotations(filePath: string): AnnotationEntry[] {
    if (!this.active) {
      return [];
    }

    const normalized = path.resolve(filePath);
    const fileMap = this.annotations.get(normalized);
    if (!fileMap) {
      return [];
    }

    const entries: AnnotationEntry[] = [];
    for (const [lineNumber, stored] of fileMap) {
      entries.push({
        lineNumber,
        lineText: "",
        annotation: stored.annotation,
      });
    }
    return entries;
  }

  private parseAnnotations(db: DbJson): void {
    const newAnnotations = new Map<string, Map<number, StoredAnnotation>>();

    for (const [, entry] of Object.entries(db.tests ?? {})) {
      const fileAnnotations = this.extractFileAnnotations(entry);

      for (const [sourcePath, lines] of fileAnnotations) {
        const normalizedSourcePath = path.resolve(sourcePath);
        let fileMap = newAnnotations.get(normalizedSourcePath);
        if (!fileMap) {
          fileMap = new Map();
          newAnnotations.set(normalizedSourcePath, fileMap);
        }

        for (const [lineText, lineNumber, snapshots] of lines) {
          const existing = fileMap.get(lineNumber);
          if (existing) {
            fileMap.set(lineNumber, {
              annotation: this.mergeSnapshots(existing.annotation, snapshots),
            });
          } else {
            fileMap.set(lineNumber, {
              annotation: this.formatSnapshots(snapshots),
            });
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

      const last3 = values.slice(-3);
      const allSame = last3.every((v) => v === last3[0]);
      if (allSame) {
        parts.push(`[${key}=${last3[0]}]`);
      } else {
        parts.push(`[${key}=${last3.join(",")}]`);
      }
    }

    return parts.join(" ");
  }

  getDebugLine(): DebugLine | undefined {
    if (!this.active) {
      return undefined;
    }
    return this.debugLine;
  }

  private parseDebugLine(db: DbJson): void {
    if (db.debugLine) {
      this.debugLine = {
        filePath: path.resolve(db.debugLine.filePath),
        lineNumber: db.debugLine.lineNumber,
      };
      log(`[Annotations] Debug line set: ${this.debugLine.filePath}:${this.debugLine.lineNumber}`);
    } else {
      this.debugLine = undefined;
      log("[Annotations] Debug line cleared");
    }
  }

  private extractFileAnnotations(
    entry: DbJsonEntry
  ): Map<string, [string, number, string[]][]> {
    const result = new Map<string, [string, number, string[]][]>();

    for (const [filePath, annotations] of Object.entries(
      entry.story_annotations ?? {}
    )) {
      const parsed = annotations.map(
        ([lineText, lineNumber, snapshots]): [string, number, string[]] => [
          lineText,
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
