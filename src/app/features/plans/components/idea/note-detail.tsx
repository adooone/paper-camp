import { detailHeadingStyle } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { color, fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import type { IdeaEntry } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP } from '../../constants';
import { ExtendIdeaButton } from '../agent';
import { PlanIdStamp } from '../plan-id-stamp';

interface NoteDetailProps {
  idea: IdeaEntry;
}

/** Detail view for a note entity — reference material that never grows phases. */
export const NoteDetail = ({ idea }: NoteDetailProps) => {
  return (
    <div
      style={{
        fontFamily: fontFamily.body,
        fontSize: fontSize.base,
        lineHeight: lineHeight.relaxed,
        color: color.textProse,
      }}
    >
      <h2
        style={{
          ...detailHeadingStyle,
          margin: `0 0 ${space[4]}`,
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        <PlanIdStamp id={idea.id ?? undefined} />
        {idea.title}
        {idea.status && (
          <Stamp
            size="small"
            fillColor={IDEA_STATUS_STAMP[idea.status].fill}
            textColor={IDEA_STATUS_STAMP[idea.status].text}
          >
            {IDEA_STATUS_LABEL[idea.status]}
          </Stamp>
        )}
      </h2>
      <Markdown>
        {idea.body
          .replace(/^#{1,3}\s+.+(\n|$)/, '')
          // Only a leading delimiter, not the `m` flag — otherwise this strips any
          // standalone `---` horizontal rule the user wrote mid-body.
          .replace(/^\s*-{3,}\s*(\n|$)/, '')
          .trim()}
      </Markdown>
      <div style={{ marginTop: space[6] }}>
        <ExtendIdeaButton idea={idea} />
      </div>
    </div>
  );
};
