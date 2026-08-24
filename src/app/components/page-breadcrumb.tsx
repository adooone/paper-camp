import { entityLink, useActiveIdea, useActivePlan, useResolvedDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

/** The one breadcrumb in the app: rendered once at the top of the sheet, for every
 *  route that has a trail. Each trail is derived here from route + store, so no page
 *  assembles its own, and the spacing above and below it is set in one place. */
export const PageBreadcrumb = () => {
  const navigate = useNavigate();
  const activePlan = useActivePlan();
  const activeIdea = useActiveIdea();
  const plans = useAppStore((s) => s.plans);
  const activeDocSection = useResolvedDocSection();
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const activeReleaseVersion = useAppStore((s) => s.activeReleaseVersion);

  const items = (() => {
    if (activePlan) {
      // A ticket's way out is the board it was decomposed from, with the worklist
      // one hop further back.
      const board =
        activePlan.entityKind === 'ticket' && activePlan.idea
          ? (plans?.entries ?? []).find((p) => p.id === activePlan.idea)
          : undefined;
      return [
        { id: 'plans', label: 'Plans', onClick: () => navigate({ to: '/' }) },
        ...(board
          ? [{ id: 'board', label: board.title, onClick: () => navigate(entityLink(board)) }]
          : []),
        { id: 'plan', label: activePlan.title },
      ];
    }
    if (activeIdea) {
      return [
        { id: 'plans', label: 'Plans', onClick: () => navigate({ to: '/' }) },
        { id: 'idea', label: activeIdea.title },
      ];
    }
    const docLabel =
      activeDocSection === 'repo-docs'
        ? activeDocTitle
        : activeDocSection === 'release-notes'
          ? activeReleaseVersion
          : null;
    if (docLabel) {
      return [
        { id: 'docs', label: 'Docs', onClick: () => navigate({ to: '/docs' }) },
        { id: 'doc', label: docLabel },
      ];
    }
    return null;
  })();

  if (!items) return null;
  return (
    // Pulled up through the sheet's top inset so it sits close under the header;
    // scoped here so pages without a breadcrumb keep the full inset untouched.
    <div className="-mt-6 mb-3">
      <Breadcrumb className="font-handwritten !text-xs min-w-0" items={items} />
    </div>
  );
};
