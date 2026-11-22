import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UnpairSheet } from './unpair-sheet';

const noop = () => {};
const machine = {
  url: 'https://deimos.ts.net',
  host: 'deimos',
  version: '0.48.0',
  pairedHere: true,
};

describe('UnpairSheet', () => {
  it('renders nothing until a machine is picked', () => {
    expect(
      renderToStaticMarkup(<UnpairSheet machine={null} onUnpair={noop} onClose={noop} />),
    ).toBe('');
  });

  it('asks before unpairing, with Keep and Unpair', () => {
    const html = renderToStaticMarkup(
      <UnpairSheet machine={machine} onUnpair={noop} onClose={noop} />,
    );
    expect(html).toContain('Unpair deimos?');
    expect(html).toContain('Keep');
    expect(html).toContain('>Unpair<');
  });
});
