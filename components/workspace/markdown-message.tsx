"use client";

// components/workspace/markdown-message.tsx
//
// Renders the assistant's markdown (bold, lists, code, links, tables…) in Nakami's style.
// Raw HTML in the text is NOT rendered (react-markdown escapes it), and unsafe link
// protocols like javascript: are stripped by default.
//
// Needs: npm i react-markdown remark-gfm

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => (
    <p className="leading-relaxed [&:not(:first-child)]:mt-3">{children}</p>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="opacity-60">{children}</del>,

  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-foreground/40 first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:text-foreground/50 first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,

  h1: ({ children }) => (
    <h3 className="mt-5 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-5 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-4 text-sm font-semibold first:mt-0">{children}</h4>
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-[#B84A25] underline underline-offset-4 outline-none hover:text-[#D9623B] focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 dark:text-[#F0A185]"
    >
      {children}
    </a>
  ),

  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-2 border-[#D9623B]/40 pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-4 border-border" />,

  // Inline code (long ids wrap instead of overflowing).
  code: ({ children }) => (
    <code className="break-words rounded-md bg-muted px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[13px]">
      {children}
    </code>
  ),

  // Fenced code blocks: reset the inline-code chip style on the inner <code>.
  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-4 text-[13px] leading-relaxed [&_code]:break-normal [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 last:border-b-0">
      {children}
    </td>
  ),
};

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
}: {
  content: string;
}) {
  return (
    <div className="min-w-0 break-words text-[15px] [&>*:first-child]:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
