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
      const zeroBased = entry.lineNumber - 1;
      if (zeroBased < 0 || zeroBased >= editor.document.lineCount) {
        log(`[Decorator] Line ${entry.lineNumber} out of range`);
        continue;
      }

      const line = editor.document.lineAt(zeroBased);
      const range = new vscode.Range(
        zeroBased,
        line.text.length,
        zeroBased,
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
        `[Decorator] Adding decoration at line ${entry.lineNumber}: ${entry.annotation}`
      );
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
