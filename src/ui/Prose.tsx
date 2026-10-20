import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Calm zone: lessons, keys and readings render plainly, never decorated (BUILD_PLAN 19.1).
export function Prose({ markdown, fontSize, className = '' }: { markdown: string; fontSize?: number; className?: string }) {
  return (
    <div className={`prose-calm calm ${className}`} style={fontSize ? { fontSize } : undefined}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
