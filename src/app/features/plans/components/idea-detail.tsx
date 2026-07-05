import { Markdown } from '@/app/components/markdown';
import { fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import type { IdeaEntry } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { ExtendIdeaButton } from './extend-idea-button';

interface IdeaDetailProps {
  idea: IdeaEntry;
}

export const IdeaDetail = ({ idea }: IdeaDetailProps) => {
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
