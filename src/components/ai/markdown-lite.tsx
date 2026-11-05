import type { ReactNode } from "react";

/**
 * Extremely small, allocation-cheap markdown-ish renderer for assistant output.
 * Supports paragraphs, bullet lists, bold, italics and links. It never uses
 * dangerouslySetInnerHTML, so model output cannot inject markup or scripts.
 */
const LINK_RE = /\[([^\]]{1,120})\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  const linkPattern = new RegExp(LINK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(...renderEmphasis(text.slice(lastIndex, match.index), `${keyPrefix}-t${index}`));
    nodes.push(
      <a key={`${keyPrefix}-l${index}`} href={match[2]} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-500">
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
    index += 1;
  }
  if (lastIndex < text.length) nodes.push(...renderEmphasis(text.slice(lastIndex), `${keyPrefix}-t${index}`));
  return nodes;
}

function renderEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]{1,200}\*\*|\*[^*]{1,200}\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={`${keyPrefix}-i${i}`}>{part.slice(1, -1)}</em>;
    }
    return <span key={`${keyPrefix}-s${i}`}>{part}</span>;
  });
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim());
  if (!blocks.length) return null;
  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => /^\s*[-*•]\s+/.test(line));
        if (isList) {
          return (
            <ul key={blockIndex} className="ml-4 list-disc space-y-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line.replace(/^\s*[-*•]\s+/, ""), `b${blockIndex}l${lineIndex}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="whitespace-pre-line">
            {renderInline(block.trim(), `b${blockIndex}`)}
          </p>
        );
      })}
    </div>
  );
}
