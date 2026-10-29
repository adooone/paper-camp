import { InlineCode } from '@dendelion/folk-ui';
import type { ReactNode } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const headingClass = (fontSizeClass: string): string =>
  `font-display-luminari font-semibold ${fontSizeClass} mt-6 mb-3 leading-tight`;

const components: Components = {
  p: ({ children }) => <p className="mb-4">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  h1: ({ children }) => <h1 className={headingClass('text-lg')}>{children}</h1>,
  h2: ({ children }) => <h2 className={headingClass('text-[1.3rem]')}>{children}</h2>,
  h3: ({ children }) => <h3 className={headingClass('text-[1.1rem]')}>{children}</h3>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-watercolor-amber-dark">
      {children}
    </a>
  ),
  code: ({ children }) => <InlineCode className="text-[0.85em]">{children}</InlineCode>,
  pre: ({ children }) => (
    <pre className="font-mono text-[0.85em] bg-black/[6%] rounded-md py-3 px-4 overflow-x-auto mb-4">
      {children}
    </pre>
  ),
  ul: ({ children }) => <ul className="list-disc mb-4 pl-[1.4rem]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal mb-4 pl-[1.4rem]">{children}</ol>,
  li: ({ children }) => <li className="mb-[0.4rem]">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 pl-4 border-l-[3px] border-solid border-black/[15%] opacity-[0.85]">
      {children}
    </blockquote>
  ),
  // Ideas and repo docs are written as GitHub Markdown, so tables come through
  // remark-gfm; a wide one scrolls on its own instead of widening the page.
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="border-collapse text-[0.95em]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left font-semibold align-bottom py-1.5 px-3 border-b-[1.5px] border-solid border-black/[25%]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="align-top py-1.5 px-3 border-b border-solid border-black/[10%]">{children}</td>
  ),
};

// A single `~` stays literal: plans write `~$4` and `~2h` as estimates.
const remarkPlugins: Options['remarkPlugins'] = [[remarkGfm, { singleTilde: false }]];

interface MarkdownProps {
  children: string;
}

export const Markdown = ({ children }: MarkdownProps): ReactNode => (
  <ReactMarkdown components={components} remarkPlugins={remarkPlugins}>
    {children}
  </ReactMarkdown>
);
