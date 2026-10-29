import { Markdown } from '@/app/components/markdown';
import type { IdeaEntry } from '@/types/index';
import { Button, Stamp } from '@dendelion/folk-ui';
import { ExtendIdeaButton } from '../actions';
import { PlanIdStamp } from '../components';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP } from '../constants';
import { parseAssetUrl } from '../helpers';
import { useIdeaAssets, usePlanStatusPatch } from '../hooks';
import { AssetPreviewModal } from '../modals';
import { FilesSection } from './files-section';

interface NoteDetailProps {
  idea: IdeaEntry;
}

export const NoteDetail = ({ idea }: NoteDetailProps) => {
  const { patch, updating } = usePlanStatusPatch();
  const closed = idea.status === 'done' || idea.status === 'dropped';
  const {
    assets,
    uploading,
    dragActive,
    preview,
    previewLoading,
    fileInputRef,
    handleFileInputChange,
    handleAddFileClick,
    dropHandlers,
    openPreview,
    closePreview,
    handleDelete,
    assetUrl,
  } = useIdeaAssets(idea.id ?? null, idea.assets);

  const handleOpenAssetPreview = (url: string) => {
    const parsed = parseAssetUrl(url);
    const asset =
      parsed && parsed.id === idea.id ? assets.find((a) => a.name === parsed.name) : undefined;
    if (asset) openPreview(asset);
    else window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="text-base leading-[1.7] text-ink-900" {...dropHandlers}>
      <h2 className="font-display-luminari font-semibold text-[1.75rem] leading-tight mt-0 mr-0 mb-4 ml-0 flex items-center gap-3 flex-wrap">
        <PlanIdStamp id={idea.id ?? undefined} />
        {idea.title}
        {idea.status && (
          <Stamp size="small" variant={IDEA_STATUS_STAMP[idea.status]}>
            {IDEA_STATUS_LABEL[idea.status]}
          </Stamp>
        )}
      </h2>
      <Markdown ideaId={idea.id ?? undefined} onOpenAssetPreview={handleOpenAssetPreview}>
        {idea.body
          .replace(/^#{1,3}\s+.+(\n|$)/, '')
          // Only a leading delimiter, not the `m` flag — otherwise this strips any
          // standalone `---` horizontal rule the user wrote mid-body.
          .replace(/^\s*-{3,}\s*(\n|$)/, '')
          .trim()}
      </Markdown>
      <FilesSection
        assets={assets}
        dragActive={dragActive}
        uploading={uploading}
        fileInputRef={fileInputRef}
        onFileInputChange={handleFileInputChange}
        onAddFileClick={handleAddFileClick}
        onOpenPreview={openPreview}
        onDelete={handleDelete}
        assetUrl={assetUrl}
      />
      {preview && (
        <AssetPreviewModal
          preview={preview}
          loading={previewLoading}
          onClose={closePreview}
          onDelete={() => handleDelete(preview.asset)}
        />
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {closed ? (
          <Button
            type="button"
            variant="ghost"
            size="small"
            disabled={updating || !idea.id}
            onClick={() => idea.id && patch(idea.id, { status: null })}
          >
            Reopen
          </Button>
        ) : (
          <>
            <ExtendIdeaButton idea={idea} />
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={updating || !idea.id}
              onClick={() => idea.id && patch(idea.id, { status: 'done' })}
            >
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={updating || !idea.id}
              onClick={() => idea.id && patch(idea.id, { status: 'dropped' })}
            >
              Drop
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
