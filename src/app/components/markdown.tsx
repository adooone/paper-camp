import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

const headingStyle = (fontSize: string): React.CSSProperties => ({
  fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
  fontWeight: 600,
  fontSize,
  margin: '1.5rem 0 0.75rem',
  lineHeight: 1.25,
});

const components: Components = {
  p: ({ children }) => <p style={{ margin: '0 0 1rem' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  h1: ({ children }) => <h1 style={headingStyle('1.5rem')}>{children}</h1>,
  h2: ({ children }) => <h2 style={headingStyle('1.3rem')}>{children}</h2>,
  h3: ({ children }) => <h3 style={headingStyle('1.1rem')}>{children}</h3>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: '#A67B4F' }}>
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code
      style={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.85em',
        background: 'rgba(0,0,0,0.06)',
        borderRadius: 3,
        padding: '0.1em 0.35em',
      }}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      style={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.85em',
        background: 'rgba(0,0,0,0.06)',
        borderRadius: 6,
        padding: '0.75rem 1rem',
        overflowX: 'auto',
        margin: '0 0 1rem',
      }}
    >
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul style={{ listStyle: 'disc', margin: '0 0 1rem', paddingLeft: '1.4rem' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ listStyle: 'decimal', margin: '0 0 1rem', paddingLeft: '1.4rem' }}>{children}</ol>
  ),
  li: ({ children }) => <li style={{ marginBottom: '0.4rem' }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: '0 0 1rem',
        paddingLeft: '1rem',
        borderLeft: '3px solid rgba(0,0,0,0.15)',
        opacity: 0.85,
      }}
    >
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
