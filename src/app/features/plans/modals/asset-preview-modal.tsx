import { assetKind } from '@/app/features/plans/helpers';
import type { AssetPreview } from '@/app/features/plans/hooks';
import { Button, CodeBlock, Modal } from '@dendelion/folk-ui';

interface AssetPreviewModalProps {
  preview: AssetPreview;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const AssetPreviewModal = ({
  preview,
  loading,
  onClose,
  onDelete,
}: AssetPreviewModalProps) => {
  const { asset, url, text } = preview;
  const kind = assetKind(asset);

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <Modal open title={asset.name} size="large" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {kind === 'image' && (
          <img
            src={url}
            alt={asset.name}
            className="max-w-full max-h-[70vh] object-contain mx-auto"
          />
        )}
        {kind === 'html' && (
          // folk-ui has no iframe/sandboxed-preview component
          <iframe
            src={url}
            sandbox="allow-scripts"
            title={asset.name}
            className="w-full h-[70vh] border-0"
          />
        )}
        {kind === 'text' &&
          (loading ? (
            <p className="text-sm opacity-60 m-0">Loading…</p>
          ) : (
            <CodeBlock code={text ?? ''} filename={asset.name} />
          ))}
        {kind === 'other' && (
          <p className="text-sm opacity-60 m-0">No preview available for this file type.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => window.open(url, '_blank', 'noopener')}
          >
            Open in new tab
          </Button>
          <Button variant="danger" size="small" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
};
