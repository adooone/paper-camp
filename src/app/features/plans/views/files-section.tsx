import { assetMarkdownLink } from '@/app/features/plans/helpers';
import type { AssetEntry } from '@/types/index';
import { Button, SectionHeading } from '@dendelion/folk-ui';
import type { ChangeEvent, RefObject } from 'react';
import { FileRow } from '../components';

interface FilesSectionProps {
  assets: AssetEntry[];
  dragActive: boolean;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onAddFileClick: () => void;
  onOpenPreview: (asset: AssetEntry) => void;
  onDelete: (asset: AssetEntry) => void;
  assetUrl: (asset: AssetEntry) => string;
}

export const FilesSection = ({
  assets,
  dragActive,
  uploading,
  fileInputRef,
  onFileInputChange,
  onAddFileClick,
  onOpenPreview,
  onDelete,
  assetUrl,
}: FilesSectionProps) => {
  if (assets.length === 0 && !dragActive) return null;
  return (
    <div
      className={`mb-5 rounded-md ${dragActive ? 'outline-dashed outline-2 outline-watercolor-amber-dark/60 p-2' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <SectionHeading as="h3" className="mb-0">
          Files
        </SectionHeading>
        <Button variant="ghost" size="small" onClick={onAddFileClick} disabled={uploading}>
          Add file
        </Button>
        {/* folk-ui has no file-input component, so this raw input is intentional */}
        <input ref={fileInputRef} type="file" onChange={onFileInputChange} className="hidden" />
      </div>
      {assets.length === 0 ? (
        <p className="text-sm opacity-60 m-0">Drop a file here to add it.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {assets.map((asset) => (
            <FileRow
              key={asset.name}
              asset={asset}
              url={assetUrl(asset)}
              markdownLink={assetMarkdownLink(asset)}
              onOpen={() => onOpenPreview(asset)}
              onDelete={() => onDelete(asset)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
