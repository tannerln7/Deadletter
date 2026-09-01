import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  children: string;
  compact?: boolean;
};

export default function MarkdownContent({
  children,
  compact = false,
}: MarkdownContentProps) {
  return (
    <div className={`archive-markdown ${compact ? "archive-markdown-compact" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={defaultUrlTransform}
        components={{
          a({ children: linkChildren, href }) {
            return (
              <a href={href} rel="noreferrer noopener" target="_blank">
                {linkChildren}
              </a>
            );
          },
          img({ alt }) {
            return (
              <span className="archive-markdown-image-note">
                Inline image omitted{alt ? `: ${alt}` : "."}
              </span>
            );
          },
          table({ children: tableChildren }) {
            return (
              <div className="archive-markdown-table-wrap">
                <table>{tableChildren}</table>
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
