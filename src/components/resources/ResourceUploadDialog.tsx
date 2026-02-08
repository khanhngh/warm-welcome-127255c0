import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, Link as LinkIcon, Folder, FolderOpen, X, Plus, FolderUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileIcon, formatFileSize } from './resourceUtils';
import { CATEGORIES } from './constants';
import type { ResourceFolder } from './types';

interface PendingLink {
  id: string;
  name: string;
  url: string;
}

interface ResourceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ResourceFolder[];
  initialFolderId: string | null;
  initialType: 'file' | 'link';
  onUploadMultiple: (params: {
    type: 'file' | 'link';
    files?: File[];
    fileNames?: Map<string, string>;
    links?: { name: string; url: string }[];
    category: string;
    description: string;
    folderId: string | null;
  }) => Promise<void>;
  // Keep backward compat
  onUpload?: (params: {
    type: 'file' | 'link';
    file?: File;
    fileName?: string;
    linkUrl?: string;
    linkName?: string;
    category: string;
    description: string;
    folderId: string | null;
  }) => Promise<void>;
}

export default function ResourceUploadDialog({
  open,
  onOpenChange,
  folders,
  initialFolderId,
  initialType,
  onUploadMultiple,
  onUpload,
}: ResourceUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'file' | 'link'>(initialType);
  const [files, setFiles] = useState<File[]>([]);
  const [fileNames, setFileNames] = useState<Map<string, string>>(new Map());
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setUploadType(initialType);
      setFolderId(initialFolderId);
      setFiles([]);
      setFileNames(new Map());
      setLinks([]);
      setNewLinkName('');
      setNewLinkUrl('');
      setCategory('general');
      setDescription('');
      setProgress(0);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (uploadType === 'file' && files.length === 0) return;
    if (uploadType === 'link' && links.length === 0) return;

    setIsUploading(true);
    setProgress(0);
    const progressInterval = uploadType === 'file'
      ? setInterval(() => setProgress(prev => Math.min(prev + 5, 90)), 300)
      : null;

    try {
      if (onUploadMultiple) {
        await onUploadMultiple({
          type: uploadType,
          files: uploadType === 'file' ? files : undefined,
          fileNames: uploadType === 'file' ? fileNames : undefined,
          links: uploadType === 'link' ? links.map(l => ({ name: l.name, url: l.url })) : undefined,
          category,
          description,
          folderId,
        });
      }
      if (progressInterval) clearInterval(progressInterval);
      setProgress(100);
      handleOpenChange(false);
    } catch {
      if (progressInterval) clearInterval(progressInterval);
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(f => f.size <= 50 * 1024 * 1024);
    if (validFiles.length < selectedFiles.length) {
      // Some files were too large, silently skip
    }
    setFiles(prev => [...prev, ...validFiles]);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(f => f.size <= 50 * 1024 * 1024);
    // For folder uploads, preserve relative path in fileNames map
    validFiles.forEach(f => {
      const relativePath = (f as any).webkitRelativePath || f.name;
      setFileNames(prev => new Map(prev).set(f.name + f.size + f.lastModified, relativePath));
    });
    setFiles(prev => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) return;
    setLinks(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      name: newLinkName.trim(),
      url: newLinkUrl.trim(),
    }]);
    setNewLinkName('');
    setNewLinkUrl('');
  };

  const removeLink = (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {uploadType === 'file' ? (
              <><Upload className="w-5 h-5 text-primary" /> Tải lên tài nguyên</>
            ) : (
              <><LinkIcon className="w-5 h-5 text-primary" /> Thêm link tài nguyên</>
            )}
          </DialogTitle>
          <DialogDescription>
            {folderId
              ? `Thêm vào thư mục "${folders.find(f => f.id === folderId)?.name}"`
              : uploadType === 'file' ? 'Hỗ trợ nhiều file, folder cùng lúc • Tối đa 50MB/file' : 'Thêm nhiều link tham khảo cùng lúc'}
          </DialogDescription>
        </DialogHeader>

        {files.length === 0 && links.length === 0 && (
          <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as 'file' | 'link')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="gap-2"><Upload className="w-4 h-4" /> Tải file</TabsTrigger>
              <TabsTrigger value="link" className="gap-2"><LinkIcon className="w-4 h-4" /> Thêm link</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left panel: files or links */}
          <div className="space-y-4">
            {uploadType === 'file' ? (
              <>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                <input ref={folderInputRef} type="file" className="hidden" onChange={handleFolderSelect}
                  {...{ webkitdirectory: '', directory: '' } as any}
                />

                {/* Drop zone */}
                <div className="flex gap-2">
                  <div
                    className="flex-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Chọn nhiều file</p>
                    <p className="text-xs text-muted-foreground mt-1">Tối đa 50MB/file</p>
                  </div>
                  <div
                    className="flex-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => folderInputRef.current?.click()}
                  >
                    <FolderUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Chọn thư mục</p>
                    <p className="text-xs text-muted-foreground mt-1">Tải cả folder</p>
                  </div>
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{files.length} file đã chọn ({formatFileSize(totalSize)})</Label>
                      <Button variant="ghost" size="sm" onClick={() => setFiles([])}>Xóa tất cả</Button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                      {files.map((f, i) => {
                        const key = f.name + f.size + f.lastModified;
                        const displayName = fileNames.get(key) || f.name;
                        return (
                          <div key={i} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 group">
                            <div className="shrink-0">{getFileIcon(f.name, 'sm')}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate" title={displayName}>{displayName}</p>
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                              onClick={() => removeFile(i)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Add link form */}
                <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <Label className="text-sm font-medium">Thêm link mới</Label>
                  <Input value={newLinkName} onChange={(e) => setNewLinkName(e.target.value)}
                    placeholder="Tên hiển thị..." className="h-8 text-sm" />
                  <div className="flex gap-2">
                    <Input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://..." type="url" className="h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                    <Button size="sm" variant="outline" onClick={addLink}
                      disabled={!newLinkName.trim() || !newLinkUrl.trim()} className="shrink-0 h-8">
                      <Plus className="w-3 h-3 mr-1" /> Thêm
                    </Button>
                  </div>
                </div>

                {/* Link list */}
                {links.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{links.length} link đã thêm</Label>
                    <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                      {links.map(link => (
                        <div key={link.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 group">
                          <LinkIcon className="w-4 h-4 text-blue-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{link.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => removeLink(link.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel: settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phân loại</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <Badge variant="outline" className={cn('text-[10px]', cat.color)}>{cat.label}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Thư mục đích</Label>
              <Select value={folderId || 'root'} onValueChange={(v) => setFolderId(v === 'root' ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    <div className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Không thuộc thư mục</div>
                  </SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex items-center gap-2"><Folder className="w-4 h-4 text-amber-600" /> {f.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mô tả (tùy chọn)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn..." rows={3} />
            </div>
            {isUploading && uploadType === 'file' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Đang tải lên {files.length} file...</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Hủy</Button>
          <Button
            onClick={handleSubmit}
            disabled={isUploading || (uploadType === 'file' && files.length === 0) || (uploadType === 'link' && links.length === 0)}
            className="gap-2"
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Đang xử lý...</>
            ) : uploadType === 'file' ? (
              <><Upload className="w-4 h-4" />Tải lên {files.length > 0 ? `(${files.length})` : ''}</>
            ) : (
              <><LinkIcon className="w-4 h-4" />Thêm {links.length > 0 ? `(${links.length})` : ''} link</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
