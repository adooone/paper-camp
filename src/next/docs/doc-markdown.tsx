import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './prose.module.css';

const remarkPlugins: Options['remarkPlugins'] = [[remarkGfm, { singleTilde: false }]];

const components: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className={styles.scroll}>
      <table>{children}</table>
    </div>
  ),
};

export function DocMarkdown({ children }: { children: string }) {
  return (
    <div className={styles.prose}>
      <ReactMarkdown components={components} remarkPlugins={remarkPlugins}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
