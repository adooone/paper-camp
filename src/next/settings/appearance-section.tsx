import { useAppearanceStore } from '../stores/appearance-slice';
import { Hand } from '../ui/hand';
import { ListLabel } from '../ui/list';
import {
  BODY_FONTS,
  type BodyFontId,
  type FontFace,
  TITLE_FONTS,
  type TitleFontId,
} from '../ui/typography';
import styles from './settings.module.css';
import { TextSizeSlider } from './text-size-slider';

interface FontChoiceProps {
  face: FontFace;
  active: boolean;
  sample: string;
  title?: boolean;
  onPress: () => void;
}

function FontChoice({ face, active, sample, title, onPress }: FontChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={face.label}
      onClick={onPress}
      className={active ? `${styles.choice} ${styles.choiceActive}` : styles.choice}
    >
      <span
        className={styles.sample}
        style={{
          fontFamily: face.family,
          fontWeight: title ? face.weight : 700,
          fontSize: title ? 'var(--next-text-xl)' : 'var(--next-text-lg)',
        }}
      >
        {sample}
      </span>
      <Hand size="xs" color="inkSoft">
        {face.label}
      </Hand>
    </button>
  );
}

export function AppearanceSection() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const setAppearance = useAppearanceStore((state) => state.setAppearance);
  return (
    <>
      <div className={styles.list}>
        <ListLabel>Text size</ListLabel>
        <TextSizeSlider
          value={appearance.textScale}
          onChange={(textScale) => setAppearance({ textScale })}
        />
      </div>
      <div className={styles.list}>
        <ListLabel>Body font</ListLabel>
        <div className={styles.choices}>
          {(Object.keys(BODY_FONTS) as BodyFontId[]).map((id) => (
            <FontChoice
              key={id}
              face={BODY_FONTS[id]}
              active={appearance.bodyFont === id}
              sample="Aa"
              onPress={() => setAppearance({ bodyFont: id })}
            />
          ))}
        </div>
      </div>
      <div className={styles.list}>
        <ListLabel>Title font</ListLabel>
        <div className={styles.choices}>
          {(Object.keys(TITLE_FONTS) as TitleFontId[]).map((id) => (
            <FontChoice
              key={id}
              face={TITLE_FONTS[id]}
              active={appearance.titleFont === id}
              sample="Ideas"
              title
              onPress={() => setAppearance({ titleFont: id })}
            />
          ))}
        </div>
      </div>
    </>
  );
}
