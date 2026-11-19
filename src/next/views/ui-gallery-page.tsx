import { Card, ChatIcon, FolderIcon, LightbulbIcon, RunIcon } from '@dendelion/folk-ui';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Code } from '../ui/code';
import { EmptyState } from '../ui/empty-state';
import { type FontRole, Hand, type HandColor } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import { List, ListLabel, ListRow } from '../ui/list';
import { NavIsland } from '../ui/nav-island';
import { Paper } from '../ui/paper';
import { Sheet } from '../ui/sheet';
import { SkeletonRows } from '../ui/skeleton-rows';
import { Stamp, type StampMeaning } from '../ui/stamp';
import { SubIsland } from '../ui/sub-island';
import { type TextSize, textSize } from '../ui/tokens';
import styles from './ui-gallery-page.module.css';

const FONTS: FontRole[] = ['serif', 'display', 'hand', 'mono'];
const SIZES = Object.keys(textSize) as TextSize[];
const COLORS: HandColor[] = [
  'ink',
  'inkSoft',
  'inkFaint',
  'sketchInk',
  'canvas700',
  'danger',
  'good',
];
const MEANINGS: StampMeaning[] = ['running', 'done', 'failed', 'parked', 'idle'];

const TABS = [
  { id: 'projects', label: 'Projects', icon: <FolderIcon size={20} /> },
  { id: 'ideas', label: 'Ideas', icon: <LightbulbIcon size={20} /> },
  { id: 'runs', label: 'Runs', icon: <RunIcon size={20} /> },
  { id: 'chat', label: 'Chat', icon: <ChatIcon size={20} /> },
];

const SEGMENTS = [
  { id: 'open', label: 'Open', count: 12 },
  { id: 'review', label: 'Review', count: 3 },
  { id: 'done', label: 'Done' },
];

const noop = () => {};

export const UiGalleryPage = () => {
  const [tab, setTab] = useState('ideas');
  const [segment, setSegment] = useState('open');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <Paper>
      <div className={styles.page}>
        <Hand as="h1" size="2xl" font="display">
          The phone's primitives
        </Hand>

        <ListLabel>Hand</ListLabel>
        <KraftCard>
          <div className={styles.stack}>
            {FONTS.map((font) => (
              <Hand key={font} font={font}>
                {font} — The quick brown fox
              </Hand>
            ))}
            {FONTS.map((font) => (
              <Hand key={`${font}-bold`} font={font} bold>
                {font} bold — The quick brown fox
              </Hand>
            ))}
            {SIZES.map((size) => (
              <Hand key={size} size={size}>
                {size} · {textSize[size]}px
              </Hand>
            ))}
            {COLORS.map((color) => (
              <Hand key={color} color={color}>
                {color}
              </Hand>
            ))}
            <Hand numberOfLines={1}>
              One line only — this sentence runs on long enough that it has to be cut off at the
              edge of the card.
            </Hand>
          </div>
        </KraftCard>

        <ListLabel>KraftCard</ListLabel>
        <KraftCard>
          <Hand>Default padding of 16.</Hand>
        </KraftCard>
        <KraftCard padding={24}>
          <Hand>Padding of 24.</Hand>
        </KraftCard>

        <ListLabel trailing={<Stamp meaning="running">2 running</Stamp>}>
          ListLabel and ListRow
        </ListLabel>
        <ListLabel onPress={noop}>A pressable label</ListLabel>
        <List>
          <ListRow title="A short row" />
          <ListRow title="With a detail" detail="One short line under the title" />
          <ListRow eyebrow="IDEA-337 · 2h ago" title="With an eyebrow" detail="And a detail" />
          <ListRow
            title="With a trailing stamp"
            detail="Pressable"
            trailing={<Stamp meaning="parked">parked</Stamp>}
            onPress={noop}
            accessibilityLabel="Open the row with a trailing stamp"
          />
          <ListRow title="A muted row" muted />
        </List>

        <ListLabel>Stamp</ListLabel>
        <div className={styles.wrap}>
          {MEANINGS.map((meaning) => (
            <Stamp key={meaning} meaning={meaning}>
              {meaning}
            </Stamp>
          ))}
        </div>

        <ListLabel>Button</ListLabel>
        <div className={styles.wrap}>
          <Button label="Primary" onPress={noop} />
          <Button label="Secondary" variant="secondary" onPress={noop} />
          <Button label="Ghost" variant="ghost" onPress={noop} />
        </div>
        <div className={styles.wrap}>
          <Button label="Primary" disabled />
          <Button label="Secondary" variant="secondary" disabled />
          <Button label="Ghost" variant="ghost" disabled />
        </div>
        <div className={styles.wrap}>
          <Button label="Small" size="sm" onPress={noop} />
          <Button label="Large" size="lg" onPress={noop} />
        </div>

        <ListLabel>Code</ListLabel>
        <Hand>
          Run <Code>paper-camp start</Code> and open <Code>papercamp/ideas/</Code>.
        </Hand>

        <ListLabel>NavIsland</ListLabel>
        <NavIsland tabs={TABS} current={tab} onSelect={setTab} docked={false} />

        <ListLabel>SubIsland</ListLabel>
        <div className={styles.frame}>
          <SubIsland
            segments={SEGMENTS}
            current={segment}
            onSelect={setSegment}
            bottomSpace={0}
            docked={false}
          />
        </div>

        <ListLabel>Sheet</ListLabel>
        <div className={styles.wrap}>
          <Button label="Open the sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
        </div>

        <ListLabel>EmptyState</ListLabel>
        <KraftCard>
          <EmptyState title="Nothing here yet" line="Ideas you capture land on this list." />
        </KraftCard>
        <KraftCard>
          <EmptyState
            title="No projects"
            line="Pair a machine to see its projects."
            actionLabel="Pair a machine"
            onAction={noop}
          />
        </KraftCard>

        <ListLabel>SkeletonRows</ListLabel>
        <SkeletonRows />

        <ListLabel>Chalkboard</ListLabel>
        <Card surface="chalkboard">
          <div className={styles.chalk}>
            <span>$ pnpm run check-types</span>
            <span>tsc --noEmit --incremental</span>
            <span>✓ no errors</span>
          </div>
        </Card>
      </div>

      <Sheet visible={sheetOpen} onRequestClose={() => setSheetOpen(false)} label="Sample sheet">
        <div className={styles.sheetBody}>
          <Hand size="lg" font="display">
            A sheet
          </Hand>
          <Hand color="inkSoft">Tap the scrim or press Escape to close it.</Hand>
          <Button label="Close" onPress={() => setSheetOpen(false)} />
        </div>
      </Sheet>
    </Paper>
  );
};
