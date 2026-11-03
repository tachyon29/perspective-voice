import { Fragment, type ReactNode } from "react";

interface MessageBlock {
  type: "paragraph" | "unordered" | "ordered" | "code";
  content: string[];
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function parseBlocks(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let current: MessageBlock | null = null;
  let inCode = false;

  const flush = () => {
    if (current?.content.length) blocks.push(current);
    current = null;
  };

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trimStart().startsWith("```")) {
      if (inCode) flush();
      else {
        flush();
        current = { type: "code", content: [] };
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      current?.content.push(line);
      continue;
    }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const type = unordered ? "unordered" : "ordered";
      if (current?.type !== type) {
        flush();
        current = { type, content: [] };
      }
      current.content.push((unordered ?? ordered)![1]);
    } else if (!line.trim()) {
      flush();
    } else {
      if (current?.type !== "paragraph") {
        flush();
        current = { type: "paragraph", content: [] };
      }
      current.content.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export default function ChatMessageText({ text }: { text: string }) {
  return (
    <div className="chat-message-content">
      {parseBlocks(text).map((block, blockIndex) => {
        if (block.type === "code") return <pre key={blockIndex}><code>{block.content.join("\n")}</code></pre>;
        if (block.type === "unordered" || block.type === "ordered") {
          const List = block.type === "unordered" ? "ul" : "ol";
          return <List key={blockIndex}>{block.content.map((line, lineIndex) => <li key={lineIndex}>{renderInline(line)}</li>)}</List>;
        }
        return <p key={blockIndex}>{block.content.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && " "}{renderInline(line)}</Fragment>)}</p>;
      })}
    </div>
  );
}
