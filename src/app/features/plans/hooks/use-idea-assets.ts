import { assetKind } from '@/app/features/plans/helpers';
import { assetUrl, deleteIdeaAsset, uploadIdeaAsset } from '@/app/services/content';
import { refreshPlans } from '@/app/services/query-client';
import type { AssetEntry } from '@/types/index';
import { useToast } from '@dendelion/folk-ui';
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';

export interface AssetPreview {
  asset: AssetEntry;
  url: string;
  text?: string;
}

const readFileAsDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const useIdeaAssets = (id: string | null, assets: AssetEntry[] | undefined) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<AssetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const upload = async (file: File) => {
    if (!id) return;
    setUploading(true);
    try {
      const dataUri = await readFileAsDataUri(file);
      await uploadIdeaAsset(id, file.name, dataUri);
      await refreshPlans();
    } catch (err) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await upload(file);
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await upload(file);
  };

  const openPreview = async (asset: AssetEntry) => {
    if (!id) return;
    const url = assetUrl(id, asset.name);
    if (assetKind(asset) !== 'text') {
      setPreview({ asset, url });
      return;
    }
    setPreviewLoading(true);
    try {
      const response = await fetch(url);
      setPreview({ asset, url, text: await response.text() });
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => setPreview(null);

  const handleDelete = async (asset: AssetEntry) => {
    if (!id) return;
    try {
      await deleteIdeaAsset(id, asset.name);
      await refreshPlans();
      if (preview?.asset.name === asset.name) closePreview();
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' });
    }
  };

  return {
    assets: assets ?? [],
    uploading,
    dragActive,
    preview,
    previewLoading,
    fileInputRef,
    handleFileInputChange,
    handleAddFileClick: () => fileInputRef.current?.click(),
    dropHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    openPreview,
    closePreview,
    handleDelete,
    assetUrl: (asset: AssetEntry) => (id ? assetUrl(id, asset.name) : ''),
  };
};
