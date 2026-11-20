import type { KeyboardEvent, PointerEvent } from 'react';
import { useRef } from 'react';
import { scaleAtRatio, scaleRatio, scaleStep } from '../shell/settings-model';
import { Hand } from '../ui/hand';
import { TEXT_SCALE_ORDER, TEXT_SCALES, type TextScaleId } from '../ui/typography';
import styles from './settings.module.css';

interface TextSizeSliderProps {
  value: TextScaleId;
  onChange: (next: TextScaleId) => void;
}

const KEY_STEPS: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

export function TextSizeSlider({ value, onChange }: TextSizeSliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const index = TEXT_SCALE_ORDER.indexOf(value);

  const pick = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    const next = scaleAtRatio((clientX - box.left) / box.width);
    if (next !== value) onChange(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pick(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event.clientX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(scaleStep(value, step));
  };

  return (
    <div className={styles.sliderBlock}>
      <div className={styles.sliderEnds}>
        <Hand size="xs" color="inkSoft">
          Aa
        </Hand>
        <Hand size="lg" bold color="inkSoft">
          Aa
        </Hand>
      </div>
      {/* folk-ui has no slider; the phone's is a four-stop track under a kraft thumb. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Text size"
        aria-valuemin={0}
        aria-valuemax={TEXT_SCALE_ORDER.length - 1}
        aria-valuenow={index}
        aria-valuetext={TEXT_SCALES[value].label}
        className={styles.sliderHit}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        <div ref={track} className={styles.track}>
          {TEXT_SCALE_ORDER.map((id, position) => (
            <span
              key={id}
              className={position <= index ? `${styles.stop} ${styles.stopPassed}` : styles.stop}
              style={{ left: `${(scaleRatio(id) * 100).toFixed(2)}%` }}
            />
          ))}
          <span className={styles.thumb} style={{ left: `${scaleRatio(value) * 100}%` }} />
        </div>
      </div>
      <Hand size="sm" color="inkSoft" className={styles.sliderCaption}>
        {TEXT_SCALES[value].label}
      </Hand>
    </div>
  );
}
