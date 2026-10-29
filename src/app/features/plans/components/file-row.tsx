import { assetKind, formatFileSize, relativeDate } from '@/app/features/plans/helpers';
import type { AssetEntry } from '@/types/index';
import { CloseIcon, CopyButton, IconButton, ListItem, NoteIcon } from '@dendelion/folk-ui';

interface FileRowProps {
  asset: AssetEntry;
  url: string;
  markdownLink: string;
  onOpen: () => void;
  onDelete: () => void;
}

export const FileRow = ({ asset, url, markdownLink, onOpen, onDelete }: FileRowProps) => (
  <ListItem
    size="small"
    onClick={onOpen}
    ariaLabel={`Open ${asset.name}`}
    icon={
      assetKind(asset) === 'image' ? (
        <img src={url} alt="" className="w-8 h-8 object-cover rounded" />
      ) : (
        <NoteIcon size={18} />
      )
    }
    action={
      <div className="flex items-center gap-1">
        <CopyButton text={markdownLink} />
        <IconButton
          icon={<CloseIcon size={16} />}
          variant="danger"
          size="small"
          label={`Delete ${asset.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        />
      </div>
    }
  >
    <div className="flex flex-col items-start gap-0.5 min-w-0">
      <span className="truncate">{asset.name}</span>
      <span className="text-sm opacity-60">
        {formatFileSize(asset.size)} · {relativeDate(asset.modified)}
      </span>
    </div>
  </ListItem>
);
