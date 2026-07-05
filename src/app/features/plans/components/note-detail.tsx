import { Markdown } from '@/app/components/markdown';
import { fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import type { IdeaEntry } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP } from '../constants';
import { ExtendIdeaButton } from './extend-idea-button';

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
        color: '#1C1B18',
      }}
    >
      <h2
        style={{
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          fontSize: '1.75rem',
          margin: `0 0 ${space[4]}`,
          lineHeight: lineHeight.tight,
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        {idea.id && (
          <Stamp size="small" fillColor="rgba(0,0,0,0.08)">
            {idea.id}
          </Stamp>
        )}
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
