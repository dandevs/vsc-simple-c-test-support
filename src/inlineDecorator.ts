import * as vscode from "vscode";
import { AnnotationProvider } from "./annotationProvider";

export class InlineDecorator {
  private decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor("editor.inlineValuesForeground"),
        fontStyle: "italic",
        margin: "0 0 0 1em",
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
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
    const annotations = provider.getAnnotations(editor.document.uri.fsPath);
    if (!annotations || annotations.size === 0) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const [lineNumber, annotation] of annotations) {
      const zeroBasedLine = lineNumber - 1;
      if (zeroBasedLine < 0 || zeroBasedLine >= editor.document.lineCount) {
        continue;
      }

      const line = editor.document.lineAt(zeroBasedLine);
      const range = new vscode.Range(
        zeroBasedLine,
        line.text.length,
        zeroBasedLine,
        line.text.length
      );

      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: annotation,
          },
        },
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
