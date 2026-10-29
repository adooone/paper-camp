import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './markdown';

const render = (source: string): string => renderToStaticMarkup(<Markdown>{source}</Markdown>);

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
});
