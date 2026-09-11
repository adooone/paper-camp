import { ListItem } from '@dendelion/paper-ui';
import { describe, expect, it } from 'vitest';
import { SidebarCommand } from './sidebar-command';

describe('SidebarCommand', () => {
  it('disables the row and dims it when disabled', () => {
    const tree = SidebarCommand({ icon: '▶', children: 'Run all phases', disabled: true });
    const [item] = tree.props.children as [ReturnType<typeof ListItem>];
    expect(item.type).toBe(ListItem);
    expect(item.props.disabled).toBe(true);
    expect(item.props.className).toContain('opacity-50');
    expect(item.props.children).toBe('Run all phases');
  });

  it('shows the busy label instead of the command label and disables the row', () => {
    const tree = SidebarCommand({
      icon: '▶',
      children: 'Run all phases',
      busy: 'Starting…',
    });
    const [item] = tree.props.children as [ReturnType<typeof ListItem>];
    expect(item.props.disabled).toBe(true);
    expect(item.props.children).toBe('Starting…');
  });

  it('tints the icon and label rose for a danger tone', () => {
    const tree = SidebarCommand({ icon: '⊘', children: 'Mark dropped', tone: 'danger' });
    const [item] = tree.props.children as [ReturnType<typeof ListItem>];
    expect(item.props.className).toContain('text-watercolor-rose-dark');
    expect(item.props.icon.props.className).toContain('text-watercolor-rose-dark');
  });

  it('renders a muted mono note beneath the row when given one', () => {
    const tree = SidebarCommand({
      icon: '⎇',
      children: 'Create branch',
      note: 'feat/idea-1 — not this plan',
    });
    const [, note] = tree.props.children as [unknown, { props: { className: string } }];
    expect(note.props.className).toContain('font-mono');
    expect(note.props.className).toContain('text-ink-300');
  });

  it('omits the note slot when none is given', () => {
    const tree = SidebarCommand({ icon: '⎇', children: 'Create branch' });
    const [, note] = tree.props.children as [unknown, unknown];
    expect(note).toBeFalsy();
  });
});
