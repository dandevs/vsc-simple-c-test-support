import * as vscode from "vscode";
import * as path from "path";
import { log } from "./logger";
import { AnnotationProvider } from "./annotationProvider";
import { DebugLine } from "./types";

export class DebugLineHighlighter {
  private decorationType: vscode.TextEditorDecorationType;
  private lastDebugLine?: DebugLine;
  private currentEditor?: vscode.TextEditor;
  private currentLine?: number;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor("editor.findMatchBackground"),
    });
  }

  update(provider: AnnotationProvider, moveCursor = true): void {
    const debugLine = provider.getDebugLine();

    if (!debugLine) {
      this.clearHighlight();
      return;
    }

    const debugLineChanged =
      !this.lastDebugLine ||
      this.lastDebugLine.filePath !== debugLine.filePath ||
      this.lastDebugLine.lineNumber !== debugLine.lineNumber;

    this.lastDebugLine = debugLine;

    if (debugLineChanged) {
      this.openAndHighlight(debugLine, moveCursor);
    } else {
      this.updateHighlightPosition();
    }
  }

  onDocumentChanged(provider: AnnotationProvider): void {
    if (!this.lastDebugLine || !this.currentEditor) {
      return;
    }

    this.updateHighlightPosition();
  }

  private async openAndHighlight(debugLine: DebugLine, moveCursor: boolean): Promise<void> {
    this.clearHighlight();

    const uri = vscode.Uri.file(debugLine.filePath);
    log(`[DebugLine] Opening ${debugLine.filePath}:${debugLine.lineNumber}`);

    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      const zeroBased = debugLine.lineNumber - 1;
      const resolvedLine = this.resolveLineNumber(editor, debugLine);

      if (resolvedLine === undefined) {
        log(`[DebugLine] Could not resolve line ${debugLine.lineNumber}`);
        return;
      }

      this.currentEditor = editor;
      this.currentLine = resolvedLine;

      if (moveCursor) {
        const position = new vscode.Position(resolvedLine, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(resolvedLine, 0, resolvedLine, 0),
          vscode.TextEditorRevealType.InCenter
        );
      }

      const line = editor.document.lineAt(resolvedLine);
      const range = new vscode.Range(resolvedLine, 0, resolvedLine, line.text.length);
      editor.setDecorations(this.decorationType, [
        { range, renderOptions: { after: { contentText: "  [debug]" } } },
      ]);

      log(`[DebugLine] Highlighted line ${resolvedLine + 1}`);
    } catch (err) {
      log(`[DebugLine] Failed to open file: ${err}`);
    }
  }

  private updateHighlightPosition(): void {
    if (!this.currentEditor || !this.lastDebugLine) {
      return;
    }

    const resolvedLine = this.resolveLineNumber(this.currentEditor, this.lastDebugLine);

    if (resolvedLine === undefined) {
      this.clearHighlight();
      return;
    }

    this.currentLine = resolvedLine;

    const line = this.currentEditor.document.lineAt(resolvedLine);
    const range = new vscode.Range(resolvedLine, 0, resolvedLine, line.text.length);
    this.currentEditor.setDecorations(this.decorationType, [
      { range, renderOptions: { after: { contentText: "  [debug]" } } },
    ]);
  }

  private resolveLineNumber(
    editor: vscode.TextEditor,
    debugLine: DebugLine
  ): number | undefined {
    const doc = editor.document;
    const zeroBased = debugLine.lineNumber - 1;

    if (
      zeroBased >= 0 &&
      zeroBased < doc.lineCount &&
      doc.lineAt(zeroBased).text.trim() !== ""
    ) {
      return zeroBased;
    }

    return undefined;
  }

  private clearHighlight(): void {
    if (this.currentEditor) {
      this.currentEditor.setDecorations(this.decorationType, []);
    }
    this.currentEditor = undefined;
    this.currentLine = undefined;
  }

  dispose(): void {
    this.clearHighlight();
    this.decorationType.dispose();
  }
}
