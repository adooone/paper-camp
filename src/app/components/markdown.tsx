import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

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
  code: ({ children }) => (
    <code className="font-mono text-[0.85em] bg-black/[6%] rounded-[3px] py-[0.1em] px-[0.35em]">
      {children}
    </code>
  ),
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
};

interface MarkdownProps {
  children: string;
}

export const Markdown = ({ children }: MarkdownProps): ReactNode => (
  <ReactMarkdown components={components}>{children}</ReactMarkdown>
);
