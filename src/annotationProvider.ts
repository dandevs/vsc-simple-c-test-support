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
      const normalizedTestPath = path.resolve(testFilePath);
      const fileAnnotations = this.extractFileAnnotations(entry);

      for (const [sourcePath, lines] of fileAnnotations) {
        const normalizedSourcePath = path.resolve(sourcePath);
        let fileMap = newAnnotations.get(normalizedSourcePath);
        if (!fileMap) {
          fileMap = new Map();
          newAnnotations.set(normalizedSourcePath, fileMap);
        }

        for (const [lineNumber, annotation] of lines) {
          // Aggregate annotations for same line
          const existing = fileMap.get(lineNumber);
          if (existing) {
            fileMap.set(lineNumber, `${existing} ${annotation}`);
          } else {
            fileMap.set(lineNumber, annotation);
          }
        }
      }
    }

    this.annotations = newAnnotations;
  }

  private extractFileAnnotations(
    entry: DbJsonEntry
  ): Map<string, [number, string][]> {
    const result = new Map<string, [number, string][]>();

    for (const [filePath, annotations] of Object.entries(
      entry.story_annotations
    )) {
      const parsed = annotations.map(
        ([lineNumber, annotation]): [number, string] => [lineNumber, annotation]
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
