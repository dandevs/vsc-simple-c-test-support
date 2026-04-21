import * as vscode from "vscode";
import * as path from "path";

import { toBreakpointEntries } from "./breakpointMapper";
import { resolveOutputFolder, BREAKPOINTS_FILENAME } from "./config";
import { writeBreakpointsFile } from "./fileWriter";
import { AnnotationProvider } from "./annotationProvider";
import { InlineDecorator } from "./inlineDecorator";
import { log, setLogDirectory, setLoggingEnabled } from "./logger";
import { BreakpointEntry } from "./types";

interface WriteResult {
  written: boolean;
  absolutePath?: string;
}

let writeQueue: Promise<void> = Promise.resolve();
let lastConfigWarning: string | undefined;
let autoNoWorkspaceWarningShown = false;
let annotationProvider: AnnotationProvider | undefined;
let inlineDecorator: InlineDecorator | undefined;
let textChangeDebounceTimer: NodeJS.Timeout | undefined;

function getBreakpoints(): BreakpointEntry[] {
  const sourceBreakpoints = vscode.debug.breakpoints
    .filter(
      (bp): bp is vscode.SourceBreakpoint =>
        bp instanceof vscode.SourceBreakpoint
    )
    .map((bp) => ({
      fsPath: bp.location.uri.fsPath,
      uri: bp.location.uri.toString(),
      zeroBasedLine: bp.location.range.start.line,
    }));

  return toBreakpointEntries(sourceBreakpoints);
}

function getAbsoluteOutputPath(outputPath: string): string | undefined {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return undefined;
  }
  return path.resolve(workspaceRoot, outputPath);
}

function getOutputFolderAbsolutePath(): string | undefined {
  const resolution = resolveOutputFolder(
    vscode.workspace
      .getConfiguration("breakpointServer")
      .get<string>("outputFolderPath")
  );

  showConfigWarningIfNeeded(resolution.warning);
  return getAbsoluteOutputPath(resolution.folderPath);
}

function createAnnotationsInfrastructure(): void {
  annotationProvider?.dispose();
  inlineDecorator?.dispose();

  const folderAbs = getOutputFolderAbsolutePath();
  const loggingEnabled = vscode.workspace
    .getConfiguration("breakpointServer")
    .get<boolean>("enableLogging", false);

  setLoggingEnabled(loggingEnabled);
  if (folderAbs) {
    setLogDirectory(folderAbs);
  }

  log(`[Extension] Creating annotation infrastructure for folder: ${folderAbs}`);
  if (!folderAbs) {
    annotationProvider = undefined;
    inlineDecorator = undefined;
    return;
  }

  annotationProvider = new AnnotationProvider(folderAbs);
  inlineDecorator = new InlineDecorator();

  annotationProvider
    .load()
    .then(() => {
      log("[Extension] Initial load complete, updating decorators");
      inlineDecorator?.update(annotationProvider!);
    })
    .catch((err) => {
      log(`[Extension] Initial load failed: ${err}`);
    });

  annotationProvider.watch(() => {
    log("[Extension] db.json changed, updating decorators");
    inlineDecorator?.update(annotationProvider!);
  });
}

function scheduleAnnotationUpdate(): void {
  if (textChangeDebounceTimer) {
    clearTimeout(textChangeDebounceTimer);
  }
  textChangeDebounceTimer = setTimeout(() => {
    textChangeDebounceTimer = undefined;
    if (annotationProvider && inlineDecorator) {
      log("[Extension] Document changed, updating decorators");
      inlineDecorator.update(annotationProvider);
    }
  }, 500);
}

function showConfigWarningIfNeeded(warning?: string): void {
  if (!warning) {
    lastConfigWarning = undefined;
    return;
  }

  if (warning === lastConfigWarning) {
    return;
  }

  lastConfigWarning = warning;
  vscode.window.showWarningMessage(warning);
}

async function writeBreakpoints(
  showNoWorkspaceWarning: boolean
): Promise<WriteResult> {
  const resolution = resolveOutputFolder(
    vscode.workspace
      .getConfiguration("breakpointServer")
      .get<string>("outputFolderPath")
  );

  showConfigWarningIfNeeded(resolution.warning);

  const folderAbs = getAbsoluteOutputPath(resolution.folderPath);
  if (!folderAbs) {
    if (showNoWorkspaceWarning || !autoNoWorkspaceWarningShown) {
      vscode.window.showWarningMessage(
        "No workspace folder is open. Breakpoints file was not written."
      );
      autoNoWorkspaceWarningShown = true;
    }

    return { written: false };
  }

  autoNoWorkspaceWarningShown = false;

  const absolutePath = path.join(folderAbs, BREAKPOINTS_FILENAME);

  const entries = getBreakpoints();
  const written = await writeBreakpointsFile(entries, absolutePath);

  return {
    written,
    absolutePath: written ? absolutePath : undefined,
  };
}

function queueWrite(showNoWorkspaceWarning: boolean): Promise<WriteResult> {
  const operation = writeQueue.then(() =>
    writeBreakpoints(showNoWorkspaceWarning)
  );
  writeQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

export function activate(context: vscode.ExtensionContext) {
  queueWrite(false).catch((err: Error) => {
    vscode.window.showErrorMessage(
      `Failed to write breakpoints: ${err.message}`
    );
  });

  createAnnotationsInfrastructure();

  context.subscriptions.push(
    vscode.debug.onDidChangeBreakpoints(() => {
      queueWrite(false).catch((err: Error) => {
        vscode.window.showErrorMessage(
          `Failed to write breakpoints: ${err.message}`
        );
      });
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => {
      if (annotationProvider && inlineDecorator) {
        inlineDecorator.update(annotationProvider);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      scheduleAnnotationUpdate();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("breakpointServer.showOutput", async () => {
      const json = JSON.stringify(getBreakpoints(), null, 2);
      const doc = await vscode.workspace.openTextDocument({
        language: "json",
        content: json,
      });
      vscode.window.showTextDocument(doc);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "breakpointServer.writeBreakpoints",
      async () => {
        try {
          const result = await queueWrite(true);
          if (!result.written) {
            return;
          }
          vscode.window.showInformationMessage(
            `Breakpoints written to ${result.absolutePath}`
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(
            `Failed to write breakpoints: ${message}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      const loggingChanged = event.affectsConfiguration(
        "breakpointServer.enableLogging"
      );
      const outputChanged = event.affectsConfiguration(
        "breakpointServer.outputFolderPath"
      );

      if (loggingChanged) {
        const newValue = vscode.workspace
          .getConfiguration("breakpointServer")
          .get<boolean>("enableLogging", false);
        setLoggingEnabled(newValue);
      }

      if (!outputChanged) {
        return;
      }

      queueWrite(false).catch((err: Error) => {
        vscode.window.showErrorMessage(
          `Failed to write breakpoints: ${err.message}`
        );
      });

      createAnnotationsInfrastructure();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      queueWrite(false).catch((err: Error) => {
        vscode.window.showErrorMessage(
          `Failed to write breakpoints: ${err.message}`
        );
      });

      createAnnotationsInfrastructure();
    })
  );

  context.subscriptions.push(
    { dispose: () => {
      annotationProvider?.dispose();
      inlineDecorator?.dispose();
      if (textChangeDebounceTimer) {
        clearTimeout(textChangeDebounceTimer);
      }
    }}
  );
}

export function deactivate() {
  annotationProvider?.dispose();
  inlineDecorator?.dispose();
  if (textChangeDebounceTimer) {
    clearTimeout(textChangeDebounceTimer);
  }
  return writeQueue;
}
