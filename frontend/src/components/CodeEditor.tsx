import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
}

function CodeEditor({ value, onChange, language = "python", readOnly = false }: CodeEditorProps) {
  const handleEditorMount: OnMount = (editor) => {
    // Force Monaco to calculate its layout correctly
    requestAnimationFrame(() => {
      editor.layout();
      editor.setScrollTop(0);
      editor.setScrollLeft(0);
    });
  };

  return (
    <div className="code-editor">
      <Editor
        height="360px"
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(value) => onChange(value ?? "")}
        onMount={handleEditorMount}
        options={{
          minimap: {
            enabled: false,
          },

          fontSize: 14,
          lineHeight: 21,

          padding: {
            top: 12,
            bottom: 12,
          },

          automaticLayout: true,

          scrollBeyondLastLine: false,

          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
          },

          overviewRulerLanes: 0,

          hideCursorInOverviewRuler: true,

          renderLineHighlight: "line",

          tabSize: 4,

          wordWrap: "off",
          readOnly,
          domReadOnly: readOnly,
        }}
      />
    </div>
  );
}

export default CodeEditor;
