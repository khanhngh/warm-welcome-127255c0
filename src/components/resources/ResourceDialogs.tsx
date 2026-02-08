import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FolderPlus, Pencil, Loader2 } from 'lucide-react';
import type { ProjectResource, ResourceFolder } from './types';

/* ---- Folder Dialog ---- */
interface FolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingFolder: ResourceFolder | null;
  onSubmit: (name: string, description: string | null) => Promise<void>;
}

export function FolderDialog({ open, onOpenChange, editingFolder, onSubmit }: FolderDialogProps) {
  const [name, setName] = useState(editingFolder?.name || '');
  const [description, setDescription] = useState(editingFolder?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && editingFolder) {
      setName(editingFolder.name);
      setDescription(editingFolder.description || '');
    } else if (newOpen) {
      setName('');
      setDescription('');
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), description || null);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-primary" />
            {editingFolder ? 'Sửa thư mục' : 'Tạo thư mục mới'}
          </DialogTitle>
          <DialogDescription>Tổ chức tài nguyên theo thư mục</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tên thư mục</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Tài liệu tham khảo..." />
          </div>
          <div className="space-y-2">
            <Label>Mô tả (tùy chọn)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn..." />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()} className="gap-2">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
            {editingFolder ? 'Cập nhật' : 'Tạo thư mục'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Delete Resource Dialog ---- */
interface DeleteResourceDialogProps {
  resource: ProjectResource | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteResourceDialog({ resource, onClose, onConfirm, isDeleting }: DeleteResourceDialogProps) {
  return (
    <AlertDialog open={!!resource} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận xóa {resource?.resource_type === 'link' ? 'link' : 'file'}</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc muốn xóa "{resource?.name}"? Hành động này không thể hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xóa'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---- Delete Folder Dialog ---- */
interface DeleteFolderDialogProps {
  folder: ResourceFolder | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteFolderDialog({ folder, onClose, onConfirm, isDeleting }: DeleteFolderDialogProps) {
  return (
    <AlertDialog open={!!folder} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận xóa thư mục</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc muốn xóa thư mục "{folder?.name}"? Các file sẽ được chuyển về gốc.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xóa'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---- Rename Dialog ---- */
interface RenameDialogProps {
  resource: ProjectResource | null;
  onClose: () => void;
  onConfirm: (newName: string) => void;
  isRenaming: boolean;
}

export function RenameDialog({ resource, onClose, onConfirm, isRenaming }: RenameDialogProps) {
  const isLink = resource?.resource_type === 'link';
  const initialName = resource
    ? isLink
      ? resource.name
      : resource.name.substring(0, resource.name.lastIndexOf('.')) || resource.name
    : '';
  const [name, setName] = useState(initialName);

  // Update name when resource changes
  if (resource && name === '' && initialName !== '') {
    setName(initialName);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setName('');
    }
  };

  return (
    <Dialog open={!!resource} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Đổi tên {isLink ? 'link' : 'file'}
          </DialogTitle>
          <DialogDescription>
            {isLink ? 'Nhập tên mới cho link' : 'Nhập tên mới (giữ nguyên phần mở rộng)'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Tên mới</Label>
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên..."
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && onConfirm(name)}
              autoFocus
            />
            {!isLink && resource && (
              <span className="text-sm text-muted-foreground shrink-0">
                .{resource.name.split('.').pop()}
              </span>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Hủy</Button>
          <Button onClick={() => onConfirm(name)} disabled={isRenaming || !name.trim()} className="gap-2">
            {isRenaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Đổi tên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
