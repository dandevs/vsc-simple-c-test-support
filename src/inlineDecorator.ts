import * as vscode from "vscode";
import { log } from "./logger";
import { AnnotationProvider } from "./annotationProvider";
import { AnnotationEntry } from "./types";

export class InlineDecorator {
  private decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      after: {
        color: new vscode.ThemeColor("textLink.foreground"),
        fontStyle: "italic",
        margin: "0 0 0 20px",
      },
    });
  }

  update(provider: AnnotationProvider): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateEditor(editor, provider);
    }
  }

  private updateEditor(
    editor: vscode.TextEditor,
    provider: AnnotationProvider
  ): void {
    if (editor.document.uri.scheme !== "file") {
      return;
    }

    const docPath = editor.document.uri.fsPath;
    const entries = provider.getAnnotations(docPath);
    log(`[Decorator] Updating ${docPath}, found ${entries.length} entries`);

    if (entries.length === 0) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const entry of entries) {
      const resolvedLine = this.resolveLineNumber(editor, entry);
      if (resolvedLine === undefined) {
        log(`[Decorator] Could not find line text: "${entry.lineText}"`);
        continue;
      }

      const line = editor.document.lineAt(resolvedLine);
      const range = new vscode.Range(
        resolvedLine,
        line.text.length,
        resolvedLine,
        line.text.length
      );

      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: `  ${entry.annotation}`,
          },
        },
      });
      log(
        `[Decorator] Adding decoration at line ${resolvedLine + 1}: ${entry.annotation}`
      );
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  private resolveLineNumber(
    editor: vscode.TextEditor,
    entry: AnnotationEntry
  ): number | undefined {
    const doc = editor.document;
    const zeroBased = entry.lineNumber - 1;

    // Fast path: check if the line still matches at the expected number
    if (
      zeroBased >= 0 &&
      zeroBased < doc.lineCount &&
      doc.lineAt(zeroBased).text.trim() === entry.lineText
    ) {
      return zeroBased;
    }

    // Fallback: search entire document for the line text
    for (let i = 0; i < doc.lineCount; i++) {
      if (doc.lineAt(i).text.trim() === entry.lineText) {
        return i;
      }
    }

    return undefined;
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
