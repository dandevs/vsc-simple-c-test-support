export interface BreakpointEntry {
  filepath: string;
  line_number: number;
}

export interface DbJsonAnnotation {
  line_number: number;
  annotation: string;
}

export interface DbJsonEntry {
  collected_dependencies: string[];
  story_annotations: Record<string, [number, string][]>;
}

export interface DbJson {
  preferences?: Record<string, unknown>;
  tests: Record<string, DbJsonEntry>;
}
