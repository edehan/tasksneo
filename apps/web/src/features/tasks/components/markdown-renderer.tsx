"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-7 font-serif text-[22px] font-bold text-foreground first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-6 font-serif text-lg font-bold text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 font-serif text-[15px] font-bold text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-4 text-sm font-semibold text-foreground first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-2 text-sm leading-[1.8] text-foreground">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2.5 list-disc pl-6 text-sm leading-[1.8] text-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal pl-6 text-sm leading-[1.8] text-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3.5 border-l-[3px] pl-4 text-[13.5px] italic leading-[1.7] text-muted-foreground" style={{ borderColor: "var(--class-accent)" }}>
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="text-[12.5px] leading-[1.7] font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.88em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-[10px] border border-border bg-muted p-4 text-[12.5px] leading-[1.7] font-mono text-foreground/85">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="border-b-2 border-border px-3.5 py-2 text-left text-xs font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-3.5 py-1.5 text-[13px] text-muted-foreground">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="underline"
              style={{ color: "var(--class-accent)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-5 border-t border-border" />,
          strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
