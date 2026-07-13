import { fontFamily, lineHeight } from '@/app/styles/tokens';
import type { CSSProperties } from 'react';

// Shared by the entity/decision/question/doc detail views' <h2> title — not a
// paper-ui or tokens.ts value, just the one recurring "detail page title" shape.
export const detailHeadingStyle: CSSProperties = {
  fontFamily: fontFamily.serif,
  fontWeight: 600,
  fontSize: '1.75rem',
  lineHeight: lineHeight.tight,
};
