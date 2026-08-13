'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { photoUrl, uploadPhotoCloud } from '@/lib/storage';

export interface PhotoSlotProps {
  chartId: string;
  photoKey: string | null | undefined;
  onChange: (key: string) => void;
  disabled?: boolean;
  alt?: string;
}

export default function PhotoSlot({
  chartId,
  photoKey,
  onChange,
  disabled = false,
  alt = 'Reference photo',
}: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPicker = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || disabled || uploading) return;

    setError(null);
    setUploading(true);
    try {
      const result = await uploadPhotoCloud(chartId, file);
      if (result.ok) onChange(result.key);
      else setError(result.error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={event => { void handleFileChange(event); }}
        disabled={disabled || uploading}
        className="hidden"
      />
      <button
        type="button"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          openPicker();
        }}
        disabled={disabled || uploading}
        aria-label={photoKey ? `Replace ${alt.toLowerCase()}` : `Upload ${alt.toLowerCase()}`}
        aria-busy={uploading}
        className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {photoKey ? (
          <>
            {/* A direct R2 URL keeps the slot independent of Next image configuration. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(photoKey)}
              alt={alt}
              className={`h-full w-full object-cover ${uploading ? 'opacity-40' : ''}`}
            />
            {!uploading && (
              <span className="absolute inset-x-1 bottom-1 rounded bg-slate-900/70 px-1 py-0.5 text-[10px] text-white">
                Replace
              </span>
            )}
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 text-[10px] font-semibold">
            <Camera size={18} />
            Upload photo
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 size={18} className="animate-spin text-blue-600" />
          </span>
        )}
      </button>
      {error && <p className="max-w-40 text-[10px] font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}
