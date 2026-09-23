import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { Text } from '@dendelion/paper-ui';
import { useReleaseNotes } from '../hooks/use-release-notes';

export const ReleaseNotesDetail = () => {
  const version = useAppStore((s) => s.activeReleaseVersion);
  const sections = useReleaseNotes(version);
  if (!version) return null;

  if (!sections) {
    return (
      <div>
        <Text
          as="h2"
          face="display"
          weight="semibold"
          className="text-[1.75rem] leading-[1.2] mb-4"
        >
          {version}
        </Text>
        <p className="opacity-50">No release notes found for {version}.</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div>
        <Text
          as="h2"
          face="display"
          weight="semibold"
          className="text-[1.75rem] leading-[1.2] mb-4"
        >
          {version}
        </Text>
        <p className="opacity-50">No ideas could be resolved for this release.</p>
      </div>
    );
  }

  const markdown = sections
    .map(
      (section) =>
        `### ${section.label}\n\n${section.ideas.map((idea) => `- ${idea.title} (${idea.id})`).join('\n')}`,
    )
    .join('\n\n');

  return (
    <div>
      <Text as="h2" face="display" weight="semibold" className="text-[1.75rem] leading-[1.2] mb-4">
        {version}
      </Text>
      <div className="text-base leading-[1.7] text-ink-900">
        <Markdown>{markdown}</Markdown>
      </div>
    </div>
  );
};
