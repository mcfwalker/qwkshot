import React from 'react';
import { Pencil, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelLibraryCardProps {
  modelName: string;
  thumbnailUrl?: string;
  onClick?: () => void;
  onEditClick?: () => void;
}

const ModelLibraryCard: React.FC<ModelLibraryCardProps> = ({
  modelName,
  thumbnailUrl,
  onClick,
  onEditClick,
}) => {
  return (
    <div
      className="flex w-[312px] max-w-[312px] p-4 flex-col items-stretch gap-[24px] rounded-xl bg-[#1E1E1E] transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!(e.target instanceof HTMLElement && e.target.closest('button'))) {
            onClick?.();
          }
        }
      }}
    >
      <div className="relative w-full h-[280px] rounded-md group cursor-pointer">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${modelName} thumbnail`}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <div className="w-full h-full rounded-md bg-neutral-700 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-neutral-500" />
          </div>
        )}
        <div
          className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"
        >
          <span className="text-[#E2E2E2] text-sm font-sans font-semibold bg-[#2E2E2E] px-3 py-1.5 rounded-full">Use Model</span>
        </div>
      </div>
      <div className="flex justify-between items-center w-full">
        <h3 className="text-[#E2E2E2] font-sans text-sm font-normal leading-normal truncate mr-2 flex-grow min-w-0">{modelName}</h3>
        <Button
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick?.();
          }}
          className="shrink-0"
        >
          <Pencil className="h-4 w-4 text-white" />
        </Button>
      </div>
    </div>
  );
};

export default ModelLibraryCard; 