import * as vscode from "vscode";
import * as path from "path";

import { toBreakpointEntries } from "./breakpointMapper";
import { resolveOutputPath } from "./config";
import { writeBreakpointsFile } from "./fileWriter";
import { BreakpointEntry } from "./types";

interface WriteResult {
  written: boolean;
  absolutePath?: string;
}

let writeQueue: Promise<void> = Promise.resolve();
let lastConfigWarning: string | undefined;
let autoNoWorkspaceWarningShown = false;

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
  const resolution = resolveOutputPath(
    vscode.workspace
      .getConfiguration("breakpointServer")
      .get<string>("outputPath")
  );

  showConfigWarningIfNeeded(resolution.warning);

  const absolutePath = getAbsoluteOutputPath(resolution.outputPath);
  if (!absolutePath) {
    if (showNoWorkspaceWarning || !autoNoWorkspaceWarningShown) {
      vscode.window.showWarningMessage(
        "No workspace folder is open. Breakpoints file was not written."
      );
      autoNoWorkspaceWarningShown = true;
    }

    return { written: false };
  }

  autoNoWorkspaceWarningShown = false;

  const entries = getBreakpoints();
  await writeBreakpointsFile(entries, absolutePath);

  return {
    written: true,
    absolutePath,
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
      if (!event.affectsConfiguration("breakpointServer.outputPath")) {
        return;
      }

      queueWrite(false).catch((err: Error) => {
        vscode.window.showErrorMessage(
          `Failed to write breakpoints: ${err.message}`
        );
      });
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      queueWrite(false).catch((err: Error) => {
        vscode.window.showErrorMessage(
          `Failed to write breakpoints: ${err.message}`
        );
      });
    })
  );
}

export function deactivate() {
  return writeQueue;
}
