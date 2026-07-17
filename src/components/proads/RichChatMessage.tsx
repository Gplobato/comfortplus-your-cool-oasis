import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Renders assistant markdown as structured HTML (tables, lists, headings). */
export function RichChatMessage({
  content,
  className,
  tone = "assistant",
}: {
  content: string;
  className?: string;
  tone?: "assistant" | "user";
}) {
  const isUser = tone === "user";

  return (
    <div
      className={cn(
        "chat-prose text-sm leading-relaxed",
        isUser ? "chat-prose-user" : "chat-prose-assistant",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="mb-2 mt-1 text-base font-bold tracking-tight text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="mb-1.5 mt-3 text-sm font-bold text-foreground first:mt-0">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="mb-1 mt-2.5 text-sm font-semibold text-foreground first:mt-0">
              {children}
            </h5>
          ),
          p: ({ children }) => (
            <p className={cn("mb-2 last:mb-0", isUser ? "text-primary-foreground/95" : "text-foreground/90")}>
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className={cn("font-semibold", isUser ? "text-primary-foreground" : "text-foreground")}>
              {children}
            </strong>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "underline underline-offset-2",
                isUser ? "text-primary-foreground" : "text-primary",
              )}
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClass, children }) => {
            const inline = !codeClass;
            if (inline) {
              return (
                <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] text-foreground">
                  {children}
                </code>
              );
            }
            return (
              <code className="block overflow-x-auto rounded-lg bg-secondary/80 p-2 font-mono text-[11px]">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[240px] border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary/70 text-[11px] uppercase tracking-wide text-muted-foreground">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-2.5 py-1.5 font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/60 px-2.5 py-1.5 align-top">{children}</td>
          ),
          tr: ({ children }) => <tr className="even:bg-secondary/30">{children}</tr>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
