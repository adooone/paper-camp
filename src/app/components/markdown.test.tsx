import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './markdown';

const render = (source: string, ideaId?: string): string =>
  renderToStaticMarkup(<Markdown ideaId={ideaId}>{source}</Markdown>);

describe('Markdown', () => {
  it('renders a GitHub table instead of its pipes', () => {
    const html = render('| Home | In git |\n| --- | --- |\n| `papercamp/` | yes |\n');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
    expect(html).not.toContain('| ---');
  });

  it('keeps a single tilde literal, as in cost estimates', () => {
    const html = render('From ~$4 to ~$7 per idea.');
    expect(html).not.toContain('<del');
    expect(html).toContain('~$4');
  });

  it('still strikes through double tildes', () => {
    expect(render('~~dropped~~')).toContain('<del>dropped</del>');
  });

  it('rewrites a relative asset link to the idea route', () => {
    const html = render('[notes](assets/notes.txt)', 'IDEA-321');
    expect(html).toContain('href="/api/ideas/asset?id=IDEA-321&amp;name=notes.txt"');
  });

  it('rewrites a cross-idea asset link without needing an ideaId prop', () => {
    const html = render('[mockups](../assets/IDEA-321/mockups.html)');
    expect(html).toContain('href="/api/ideas/asset?id=IDEA-321&amp;name=mockups.html"');
  });

  it('renders an image link inline instead of as a dead anchor', () => {
    const html = render('[screenshot](assets/shot.png)', 'IDEA-321');
    expect(html).toContain('<img');
    expect(html).toContain('src="/api/ideas/asset?id=IDEA-321&amp;name=shot.png"');
    expect(html).not.toContain('<a ');
  });

  it('rewrites markdown image syntax to the asset route too', () => {
    const html = render('![shot](assets/shot.png)', 'IDEA-321');
    expect(html).toContain('src="/api/ideas/asset?id=IDEA-321&amp;name=shot.png"');
  });

  it('leaves a relative asset link alone without an ideaId', () => {
    const html = render('[notes](assets/notes.txt)');
    expect(html).toContain('href="assets/notes.txt"');
  });

  it('opens an HTML asset link as a plain link when no preview handler is given', () => {
    const html = render('[mockups](../assets/IDEA-321/mockups.html)');
    expect(html).toContain('href="/api/ideas/asset?id=IDEA-321&amp;name=mockups.html"');
    expect(html).toContain('target="_blank"');
  });
});
