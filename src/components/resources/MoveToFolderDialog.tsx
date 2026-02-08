import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceFolder } from './types';

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ResourceFolder[];
  currentFolderId: string | null;
  resourceName: string;
  onMove: (folderId: string | null) => void;
}

export default function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  resourceName,
  onMove,
}: MoveToFolderDialogProps) {
  const targets = [
    { id: null as string | null, name: 'Ngoài thư mục', isCurrent: currentFolderId === null },
    ...folders.map(f => ({ id: f.id as string | null, name: f.name, isCurrent: f.id === currentFolderId })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Di chuyển tài nguyên</DialogTitle>
          <DialogDescription className="text-sm truncate">"{resourceName}"</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {targets.map(target => (
            <Button
              key={target.id || 'root'}
              variant={target.isCurrent ? 'secondary' : 'ghost'}
              className={cn('w-full justify-start gap-2 h-10', target.isCurrent && 'pointer-events-none opacity-60')}
              onClick={() => {
                if (!target.isCurrent) {
                  onMove(target.id);
                  onOpenChange(false);
                }
              }}
              disabled={target.isCurrent}
            >
              {target.id ? (
                <Folder className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <FolderOpen className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{target.name}</span>
              {target.isCurrent && <span className="text-xs text-muted-foreground ml-auto">(hiện tại)</span>}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
