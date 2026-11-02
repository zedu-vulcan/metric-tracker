import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ node: _node, ...props }) => <h1 className="m-0 text-xl font-extrabold tracking-[-0.02em] text-foreground" {...props} />,
  h2: ({ node: _node, ...props }) => <h2 className="m-0 text-lg font-bold tracking-[-0.02em] text-foreground" {...props} />,
  h3: ({ node: _node, ...props }) => <h3 className="m-0 text-base font-bold text-foreground" {...props} />,
  h4: ({ node: _node, ...props }) => <h4 className="m-0 font-bold text-foreground" {...props} />,
  h5: ({ node: _node, ...props }) => <h5 className="m-0 font-semibold text-foreground" {...props} />,
  h6: ({ node: _node, ...props }) => <h6 className="m-0 font-semibold text-muted-foreground" {...props} />,
  p: ({ node: _node, ...props }) => <p className="m-0" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a
      className="font-medium break-words text-primary-deep underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  ul: ({ node: _node, ...props }) => <ul className="m-0 flex list-disc flex-col gap-1 pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="m-0 flex list-decimal flex-col gap-1 pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="pl-0.5 [&>ol]:mt-1 [&>ul]:mt-1" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="m-0 flex flex-col gap-2 border-l-2 border-border-strong pl-4 text-muted-foreground" {...props} />
  ),
  hr: ({ node: _node, ...props }) => <hr className="m-0 border-border" {...props} />,
  pre: ({ node: _node, ...props }) => (
    <pre className="m-0 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[13px] leading-relaxed [&>code]:bg-transparent [&>code]:p-0" {...props} />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code className={cn("rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]", className)} {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.95em]" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => <th className="border-b border-border-strong px-3 py-2 font-semibold text-foreground" {...props} />,
  td: ({ node: _node, ...props }) => <td className="border-b border-border px-3 py-2 align-top" {...props} />,
  img: ({ node: _node, alt, ...props }) => (
    // Agents link images by URL; their size is unknown, so next/image doesn't fit.
    <img alt={alt ?? ""} className="h-auto max-w-full rounded-lg border border-border" {...props} />
  ),
};

/**
 * Agent-written Markdown (GitHub flavour: tables, task lists, strikethrough) rendered with the app's type.
 * Raw HTML in the text is not rendered, so it's safe for anything an agent posts.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
