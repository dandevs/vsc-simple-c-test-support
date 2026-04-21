import * as vscode from "vscode";
import { log } from "./logger";
import { AnnotationProvider } from "./annotationProvider";

export class InlineDecorator {
  private decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        fontStyle: "italic",
        margin: "0 0 0 20px",
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
    const docPath = editor.document.uri.fsPath;
    const annotations = provider.getAnnotations(docPath);
    log(`[Decorator] Updating ${docPath}, found ${annotations?.size ?? 0} annotations`);

    if (!annotations || annotations.size === 0) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const [lineNumber, annotation] of annotations) {
      const zeroBasedLine = lineNumber - 1;
      if (zeroBasedLine < 0 || zeroBasedLine >= editor.document.lineCount) {
        log(`[Decorator] Skipping out-of-range line ${lineNumber} (doc has ${editor.document.lineCount} lines)`);
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
            contentText: `  ${annotation}`,
          },
        },
      });
      log(`[Decorator] Adding decoration at line ${lineNumber}: ${annotation}`);
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
