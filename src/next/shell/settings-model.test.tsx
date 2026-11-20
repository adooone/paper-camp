import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PaperCampConfig } from '@/types/index';
import { AppearanceSection } from '../settings/appearance-section';
import { TextSizeSlider } from '../settings/text-size-slider';
import {
  daemonDetail,
  describeAgent,
  notificationKinds,
  pushStamp,
  resolvedAgents,
  scaleAtRatio,
  scaleRatio,
  scaleStep,
  switchAgent,
} from './settings-model';

const config = (patch: Partial<PaperCampConfig>): PaperCampConfig => patch as PaperCampConfig;

describe('pushStamp', () => {
  it('words the browser permission the way the phone words its push status', () => {
    expect(pushStamp('granted')).toEqual({ meaning: 'done', label: 'allowed' });
    expect(pushStamp('default')).toEqual({ meaning: 'parked', label: 'asking' });
    expect(pushStamp('denied')).toEqual({ meaning: 'failed', label: 'off' });
  });
});

describe('text size stops', () => {
  it('snaps a position along the track to one of the four stops', () => {
    expect(scaleAtRatio(-1)).toBe('sm');
    expect(scaleAtRatio(0.2)).toBe('md');
    expect(scaleAtRatio(0.7)).toBe('lg');
    expect(scaleAtRatio(3)).toBe('xl');
  });

  it('places each stop evenly and steps without leaving the ends', () => {
    expect(scaleRatio('sm')).toBe(0);
    expect(scaleRatio('xl')).toBe(1);
    expect(scaleStep('md', 1)).toBe('lg');
    expect(scaleStep('sm', -1)).toBe('sm');
    expect(scaleStep('xl', 1)).toBe('xl');
  });
});

describe('project config', () => {
  it('applies the notification defaults under the saved kinds', () => {
    const kinds = notificationKinds(config({ notifications: { kinds: { 'run-finished': true } } }));
    expect(kinds['run-finished']).toBe(true);
    expect(kinds['run-failed']).toBe(true);
    expect(kinds['reply-posted']).toBe(false);
  });

  it('fills every agent role from the defaults and describes one on a line', () => {
    const agents = resolvedAgents(
      config({
        defaultAgents: { chat: { agent: 'opencode' } } as PaperCampConfig['defaultAgents'],
      }),
    );
    expect(describeAgent(agents.chat)).toBe('OpenCode');
    expect(describeAgent(agents.build)).toBe('Claude Code · opus · medium');
  });

  it('keeps a model the next agent accepts and drops one it does not', () => {
    expect(
      switchAgent({ agent: 'claude-code', model: 'sonnet', effort: 'low' }, 'opencode'),
    ).toEqual({
      agent: 'opencode',
      model: 'sonnet',
    });
    expect(switchAgent({ agent: 'opencode', model: 'x/y' }, 'claude-code')).toEqual({
      agent: 'claude-code',
      model: 'opus',
      effort: 'low',
    });
  });

  it('says when a daemon has not reported its version', () => {
    expect(daemonDetail('0.47.0')).toBe('Daemon 0.47.0');
    expect(daemonDetail(null)).toBe('Daemon version unknown');
  });
});

describe('AppearanceSection', () => {
  const html = renderToStaticMarkup(<AppearanceSection />);

  it('lists the three groups in the phone order', () => {
    const order = ['Text size', 'Body font', 'Title font'].map((label) => html.indexOf(label));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('previews body fonts as "Aa" and title fonts as "Ideas", one card per face', () => {
    expect(html.match(/>Aa</g)?.length).toBeGreaterThanOrEqual(3);
    expect(html.match(/>Ideas</g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });
});

describe('TextSizeSlider', () => {
  it('exposes the stop as a slider between a small and a large "Aa"', () => {
    const html = renderToStaticMarkup(<TextSizeSlider value="lg" onChange={() => {}} />);
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-valuetext="Large"');
    expect(html.match(/>Aa</g)).toHaveLength(2);
  });
});
