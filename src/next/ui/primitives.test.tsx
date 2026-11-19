import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { Code } from './code';
import { EmptyState } from './empty-state';
import { Hand } from './hand';
import { KraftCard } from './kraft-card';
import { ListLabel, ListRow } from './list';
import { NavIsland } from './nav-island';
import { Paper } from './paper';
import { Sheet } from './sheet';
import { SkeletonRows } from './skeleton-rows';
import { Stamp } from './stamp';
import { SubIsland } from './sub-island';
import { textSize, tokenVars } from './tokens';

const render = (element: ReactElement): string => renderToStaticMarkup(element);
const noop = () => {};

describe('tokens', () => {
  it('scales folk-ui rem sizes to the phone 17px root', () => {
    expect(textSize).toEqual({ xs: 13, sm: 15, base: 17, md: 19, lg: 21, xl: 26, '2xl': 32 });
  });

  it('carries the phone ground and kraft colours', () => {
    expect(tokenVars).toMatchObject({
      '--next-ground': '#ECEAE3',
      '--next-kraft': '#C9B79C',
      '--next-kraft-deep': '#B5A185',
      '--next-slab-edge': '#9C8B6F',
      '--next-grain-opacity': '0.3',
    });
  });
});

describe('Paper', () => {
  it('lays a hidden grain under its children', () => {
    const html = render(
      <Paper>
        <p>sheet</p>
      </Paper>,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<p>sheet</p>');
  });
});

describe('Hand', () => {
  it('renders a span by default and the requested element', () => {
    expect(render(<Hand>body</Hand>)).toMatch(/^<span[^>]*>body<\/span>$/);
    expect(render(<Hand as="h1">title</Hand>)).toMatch(/^<h1[^>]*>title<\/h1>$/);
  });

  it('clamps to a number of lines', () => {
    expect(render(<Hand numberOfLines={2}>long</Hand>)).toContain('-webkit-line-clamp:2');
    expect(render(<Hand>long</Hand>)).not.toContain('line-clamp');
  });
});

describe('KraftCard', () => {
  it('pads its body by 16 unless told otherwise', () => {
    expect(render(<KraftCard>card</KraftCard>)).toContain('padding:16px');
    expect(render(<KraftCard padding={24}>card</KraftCard>)).toContain('padding:24px');
  });
});

describe('ListLabel', () => {
  it('is static text, or a button when pressable, with its trailing element', () => {
    expect(render(<ListLabel>Ideas</ListLabel>)).toMatch(/^<div/);
    const html = render(
      <ListLabel onPress={noop} trailing={<Stamp>3</Stamp>}>
        Ideas
      </ListLabel>,
    );
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('>3</span>');
  });
});

describe('ListRow', () => {
  it('shows eyebrow, title, detail and trailing', () => {
    const html = render(
      <ListRow eyebrow="2h ago" title="Title" detail="Detail" trailing={<Stamp>run</Stamp>} />,
    );
    for (const text of ['2h ago', 'Title', 'Detail', 'run']) expect(html).toContain(`>${text}<`);
  });

  it('is a labelled button when pressable', () => {
    const html = render(<ListRow title="Open" onPress={noop} accessibilityLabel="Open the idea" />);
    expect(html).toMatch(/^<button type="button" aria-label="Open the idea"/);
  });

  it('renders a non-string title as given', () => {
    expect(render(<ListRow title={<em>custom</em>} />)).toContain('<em>custom</em>');
  });
});

describe('Stamp', () => {
  it('renders its text for every meaning', () => {
    for (const meaning of ['running', 'done', 'failed', 'parked', 'idle'] as const) {
      expect(render(<Stamp meaning={meaning}>{meaning}</Stamp>)).toContain(`>${meaning}</span>`);
    }
  });
});

describe('Button', () => {
  it('is a button with its label', () => {
    const html = render(<Button label="Run" onPress={noop} />);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('>Run</span>');
  });

  it('can be disabled and given its own accessible name', () => {
    const html = render(<Button label="Run" disabled accessibilityLabel="Run the phase" />);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="Run the phase"');
  });
});

describe('NavIsland', () => {
  const tabs = [
    { id: 'projects', label: 'Projects', icon: <svg /> },
    { id: 'ideas', label: 'Ideas', icon: <svg /> },
  ];

  it('marks the current tab and renders every label', () => {
    const html = render(<NavIsland tabs={tabs} current="ideas" onSelect={noop} />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*>.*Ideas/);
    expect(html).toContain('>Projects</span>');
  });

  it('drops the floating dock when not docked', () => {
    expect(
      render(<NavIsland tabs={tabs} current="ideas" onSelect={noop} docked={false} />),
    ).toMatch(/^<nav/);
  });
});

describe('SubIsland', () => {
  it('selects the current segment and shows counts', () => {
    const html = render(
      <SubIsland
        segments={[
          { id: 'open', label: 'Open', count: 4 },
          { id: 'done', label: 'Done' },
        ]}
        current="open"
        onSelect={noop}
        bottomSpace={84}
      />,
    );
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('>Open · 4</span>');
    expect(html).toContain('>Done</span>');
    expect(html).toContain('padding-bottom:96px');
  });
});

describe('Sheet', () => {
  it('renders a dialog over a scrim while visible', () => {
    const html = render(
      <Sheet visible onRequestClose={noop} label="Choose">
        body
      </Sheet>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Choose"');
    expect(html).toContain('aria-label="Close"');
  });

  it('renders nothing while hidden', () => {
    expect(
      render(
        <Sheet visible={false} onRequestClose={noop}>
          body
        </Sheet>,
      ),
    ).toBe('');
  });
});

describe('Code', () => {
  it('renders inline code', () => {
    expect(render(<Code>pnpm dev</Code>)).toMatch(/^<code[^>]*>pnpm dev<\/code>$/);
  });
});

describe('EmptyState', () => {
  it('shows title and line, and an action only with a handler', () => {
    const bare = render(<EmptyState title="Empty" line="Nothing yet" actionLabel="Add" />);
    expect(bare).toContain('>Empty<');
    expect(bare).toContain('>Nothing yet<');
    expect(bare).not.toContain('<button');
    const withAction = render(
      <EmptyState title="Empty" line="Nothing yet" actionLabel="Add" onAction={noop} />,
    );
    expect(withAction).toContain('>Add</span>');
  });
});

describe('SkeletonRows', () => {
  it('renders three loading rows by default', () => {
    const html = render(<SkeletonRows />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Loading"');
    const rows = (markup: string) => markup.split('<div').length - 2;
    expect(rows(html)).toBe(3);
    expect(rows(render(<SkeletonRows count={5} />))).toBe(5);
  });
});
