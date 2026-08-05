import { detailHeadingClassName } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { useReleaseNotes } from '../hooks/use-release-notes';

export const ReleaseNotesDetail = () => {
  const version = useAppStore((s) => s.activeReleaseVersion);
  const sections = useReleaseNotes(version);
  if (!version) return null;

  if (!sections) {
    return (
      <div>
        <h2 className={`${detailHeadingClassName} m-0 mb-4`}>{version}</h2>
        <p className="opacity-50">No release notes found for {version}.</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div>
        <h2 className={`${detailHeadingClassName} m-0 mb-4`}>{version}</h2>
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
      <h2 className={`${detailHeadingClassName} m-0 mb-4`}>{version}</h2>
      <div className="text-base leading-[1.7] text-ink-900">
        <Markdown>{markdown}</Markdown>
      </div>
    </div>
  );
};
