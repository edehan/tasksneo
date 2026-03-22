import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  accentColor?: string;
}

export function MarkdownPreview({
  content,
  className,
  accentColor,
}: MarkdownPreviewProps) {
  const accent = accentColor ?? "var(--class-accent)";

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="mb-4 mt-6 font-serif text-2xl font-bold text-foreground first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-3 mt-5 font-serif text-xl font-bold text-foreground first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-4 font-serif text-lg font-semibold text-foreground first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-2 mt-3 font-serif text-base font-semibold text-foreground first:mt-0">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="mb-1 mt-3 font-serif text-sm font-semibold text-foreground first:mt-0">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="mb-1 mt-3 font-serif text-sm font-medium text-muted-foreground first:mt-0">
        {children}
      </h6>
    ),
    p: ({ children }) => (
      <p className="mb-3 last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-3 list-disc pl-6 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-3 list-decimal pl-6 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="mb-1">{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className="my-3 rounded-r-md py-2 pl-4 pr-3 italic text-muted-foreground"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
        style={{ color: accent }}
      >
        {children}
      </a>
    ),
    code: ({ className: codeClassName, children }) => {
      const isBlock = codeClassName?.startsWith("language-");
      if (isBlock) {
        return (
          <code
            className={cn(
              "block rounded-lg border border-border bg-muted px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground",
              codeClassName,
            )}
          >
            {children}
          </code>
        );
      }
      return (
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-3 overflow-x-auto last:mb-0">{children}</pre>
    ),
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto last:mb-0">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead>{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody>{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-border">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="border-b-2 border-border px-3 py-2 text-left text-xs font-bold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-muted-foreground">{children}</td>
    ),
    hr: () => (
      <hr className="my-5 border-border" />
    ),
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt ?? ""}
        className="my-3 max-w-full rounded-lg"
      />
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => (
      <em>{children}</em>
    ),
  };

  return (
    <div
      className={cn(
        "text-sm leading-relaxed text-foreground",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
