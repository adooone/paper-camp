import { apiUrl } from '@/app/services/api-base';
import { InlineCode } from '@dendelion/folk-ui';
import type { ReactNode } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const headingClass = (fontSizeClass: string): string =>
  `font-display-luminari font-semibold ${fontSizeClass} mt-6 mb-3 leading-tight`;

const RELATIVE_ASSET_LINK = /^assets\/([^/]+)$/;
const CROSS_IDEA_ASSET_LINK = /^\.\.\/assets\/([^/]+)\/([^/]+)$/;
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const HTML_EXTENSIONS = new Set(['html', 'htm']);

interface ResolvedAssetLink {
  url: string;
  name: string;
}

const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

// `assets/<name>` is relative to the idea rendering this markdown; `../assets/<ID>/<name>`
// is the path that also resolves when browsing the repo on GitHub (IDEA-322).
const resolveAssetLink = (href: string, ideaId?: string): ResolvedAssetLink | undefined => {
  const relative = href.match(RELATIVE_ASSET_LINK);
  if (relative) {
    const [, name] = relative;
    return ideaId ? { url: assetRoute(ideaId, name), name } : undefined;
  }
  const cross = href.match(CROSS_IDEA_ASSET_LINK);
  if (cross) {
    const [, id, name] = cross;
    return { url: assetRoute(id, name), name };
  }
  return undefined;
};

const assetRoute = (id: string, name: string): string =>
  apiUrl(`/api/ideas/asset?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`);

const createComponents = (
  ideaId: string | undefined,
  onOpenAssetPreview: ((url: string) => void) | undefined,
): Components => ({
  p: ({ children }) => <p className="mb-4">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  h1: ({ children }) => <h1 className={headingClass('text-lg')}>{children}</h1>,
  h2: ({ children }) => <h2 className={headingClass('text-[1.3rem]')}>{children}</h2>,
  h3: ({ children }) => <h3 className={headingClass('text-[1.1rem]')}>{children}</h3>,
  a: ({ children, href }) => {
    const asset = href ? resolveAssetLink(href, ideaId) : undefined;
    if (asset && IMAGE_EXTENSIONS.has(extensionOf(asset.name))) {
      return (
        <img
          src={asset.url}
          alt={typeof children === 'string' ? children : asset.name}
          className="max-w-full rounded-md mb-4"
        />
      );
    }
    if (asset && HTML_EXTENSIONS.has(extensionOf(asset.name)) && onOpenAssetPreview) {
      return (
        <button
          type="button"
          onClick={() => onOpenAssetPreview(asset.url)}
          className="text-watercolor-amber-dark underline cursor-pointer bg-transparent border-0 p-0"
        >
          {children}
        </button>
      );
    }
    return (
      <a
        href={asset?.url ?? href}
        target="_blank"
        rel="noreferrer"
        className="text-watercolor-amber-dark"
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => (
    <img
      src={typeof src === 'string' ? (resolveAssetLink(src, ideaId)?.url ?? src) : src}
      alt={alt}
      className="max-w-full rounded-md mb-4"
    />
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
});

// A single `~` stays literal: plans write `~$4` and `~2h` as estimates.
const remarkPlugins: Options['remarkPlugins'] = [[remarkGfm, { singleTilde: false }]];

interface MarkdownProps {
  children: string;
  ideaId?: string;
  onOpenAssetPreview?: (url: string) => void;
}

export const Markdown = ({ children, ideaId, onOpenAssetPreview }: MarkdownProps): ReactNode => (
  <ReactMarkdown
    components={createComponents(ideaId, onOpenAssetPreview)}
    remarkPlugins={remarkPlugins}
  >
    {children}
  </ReactMarkdown>
);
