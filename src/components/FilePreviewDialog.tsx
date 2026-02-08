import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  File,
  Loader2,
  Eye,
  FolderDown,
  ClipboardList,
  Video,
  Music,
  Archive,
  Code,
  FileCode,
  AlertTriangle,
} from 'lucide-react';
import { useFilePreview } from '@/contexts/FilePreviewContext';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { cn } from '@/lib/utils';

/* ─── File type helpers ─── */
const getFileExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const getFileIcon = (fileName: string, size: 'sm' | 'lg' = 'sm') => {
  const ext = getFileExt(fileName);
  const iconClass = size === 'lg' ? 'w-12 h-12' : 'w-4 h-4';
  switch (ext) {
    case 'pdf': return <FileText className={cn(iconClass, 'text-red-500')} />;
    case 'doc': case 'docx': return <FileText className={cn(iconClass, 'text-blue-500')} />;
    case 'xls': case 'xlsx': case 'csv': return <FileSpreadsheet className={cn(iconClass, 'text-green-500')} />;
    case 'ppt': case 'pptx': return <Presentation className={cn(iconClass, 'text-orange-500')} />;
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'bmp': case 'svg': case 'ico':
      return <ImageIcon className={cn(iconClass, 'text-purple-500')} />;
    case 'mp4': case 'webm': case 'ogg': case 'mov': case 'avi':
      return <Video className={cn(iconClass, 'text-pink-500')} />;
    case 'mp3': case 'wav': case 'flac': case 'aac': case 'm4a':
      return <Music className={cn(iconClass, 'text-cyan-500')} />;
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz':
      return <Archive className={cn(iconClass, 'text-amber-500')} />;
    case 'js': case 'ts': case 'jsx': case 'tsx': case 'py': case 'java': case 'c': case 'cpp': case 'go': case 'rs':
      return <FileCode className={cn(iconClass, 'text-emerald-500')} />;
    case 'html': case 'css': case 'xml': case 'json': case 'yaml': case 'yml':
      return <Code className={cn(iconClass, 'text-teal-500')} />;
    case 'txt': case 'md': case 'log':
      return <FileText className={cn(iconClass, 'text-muted-foreground')} />;
    default: return <File className={cn(iconClass, 'text-muted-foreground')} />;
  }
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const getExtLabel = (name: string) => {
  const ext = getFileExt(name).toUpperCase();
  return ext || 'FILE';
};

const isPreviewableImage = (name: string) =>
  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(getFileExt(name));
const isPDF = (name: string) => getFileExt(name) === 'pdf';
const isOfficeDoc = (name: string) =>
  ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(getFileExt(name));
const isTextFile = (name: string) =>
  ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'sql', 'sh', 'yaml', 'yml', 'log', 'csv', 'toml', 'ini', 'env', 'gitignore', 'dockerfile'].includes(getFileExt(name));
const isVideoFile = (name: string) =>
  ['mp4', 'webm', 'ogg', 'mov'].includes(getFileExt(name));
const isAudioFile = (name: string) =>
  ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(getFileExt(name));

/* ─── Simple loading indicator ─── */
function PreviewSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Đang tải file...</p>
    </div>
  );
}

/* ─── PDF Viewer with fallback ─── */
function PDFViewer({ url, name }: { url: string; name: string }) {
  const [viewerMode, setViewerMode] = useState<'native' | 'google' | 'failed'>('native');
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);

  // Timeout fallback: if native iframe doesn't load in 8s, switch to Google viewer
  useEffect(() => {
    if (viewerMode !== 'native' || isLoaded) return;
    const timer = setTimeout(() => {
      if (!isLoaded) {
        setLoadTimeout(true);
        setViewerMode('google');
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [viewerMode, isLoaded]);

  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  if (viewerMode === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <AlertTriangle className="w-12 h-12 text-warning mb-3" />
        <h3 className="text-sm font-semibold mb-1">Không thể xem PDF trực tiếp</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm">
          Trình duyệt không hỗ trợ xem PDF nhúng. Vui lòng tải về hoặc mở trong tab mới.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')} className="gap-1.5 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewerMode('google')} className="gap-1.5 text-xs">
            Thử Google Viewer
          </Button>
        </div>
      </div>
    );
  }

  const iframeSrc = viewerMode === 'native'
    ? `${url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`
    : googleViewerUrl;

  return (
    <div className="relative h-full">
      {!isLoaded && (
        <div className="absolute inset-0 z-10"><PreviewSkeleton /></div>
      )}
      <iframe
        key={viewerMode} // force re-mount on mode switch
        src={iframeSrc}
        className={cn('w-full h-full border-0 transition-opacity duration-200', isLoaded ? 'opacity-100' : 'opacity-0')}
        title={name}
        allow="fullscreen"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (viewerMode === 'native') setViewerMode('google');
          else setViewerMode('failed');
        }}
      />
      {viewerMode === 'google' && isLoaded && (
        <div className="absolute bottom-2 right-2 z-20">
          <Badge variant="secondary" className="text-[9px] bg-background/80 backdrop-blur-sm">
            Google Viewer
          </Badge>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function FilePreviewDialog() {
  const { isOpen, previewInfo, closePreview, switchFile } = useFilePreview();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const url = previewInfo?.url || '';
  const name = previewInfo?.name || 'file';
  const size = previewInfo?.size || 0;
  const taskTitle = previewInfo?.taskTitle;
  const siblingFiles = previewInfo?.siblingFiles || [];
  const activeIndex = previewInfo?.activeIndex ?? -1;
  const hasSiblings = siblingFiles.length > 1;

  // Load text file content
  useEffect(() => {
    if (isOpen && url && isTextFile(name)) {
      setIsLoadingText(true);
      setTextContent(null);
      fetch(url)
        .then(res => res.text())
        .then(text => { setTextContent(text); setIsLoadingText(false); })
        .catch(() => setIsLoadingText(false));
    }
  }, [isOpen, url, name]);

  // Reset states when file changes
  useEffect(() => {
    if (isOpen) {
      setImageError(false);
      setImageLoaded(false);
      setIframeLoaded(false);
      setTextContent(null);
    }
  }, [isOpen, url]);

  const canPreview = isPreviewableImage(name) || isPDF(name) || isOfficeDoc(name) || isTextFile(name) || isVideoFile(name) || isAudioFile(name);

  const handleDownload = useCallback(async () => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Không thể tải file');
    }
  }, [url, name]);

  const handleDownloadAll = useCallback(async () => {
    if (siblingFiles.length === 0) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      for (const file of siblingFiles) {
        if (!file.url) continue;
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          zip.file(file.name, blob);
        } catch (err) {
          console.error(`Failed to download ${file.name}:`, err);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `${taskTitle || 'files'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);
      toast.success(`Đã tải ${siblingFiles.length} file thành công`);
    } catch (err) {
      console.error('Download all error:', err);
      toast.error('Không thể tải toàn bộ file');
    } finally {
      setIsDownloadingAll(false);
    }
  }, [siblingFiles, taskTitle]);

  const handleOpenInNewTab = useCallback(() => {
    if (previewInfo?.shareToken && previewInfo?.taskSlug) {
      const fileIdx = previewInfo.activeIndex ?? 0;
      window.open(`/s/${previewInfo.shareToken}/t/${previewInfo.taskSlug}/f/${fileIdx}`, '_blank', 'noopener,noreferrer');
    } else if (previewInfo?.source === 'submission' && previewInfo?.taskId && previewInfo?.groupSlug && previewInfo?.taskSlug) {
      const fileIdx = previewInfo.activeIndex ?? 0;
      window.open(`/p/${previewInfo.groupSlug}/t/${previewInfo.taskSlug}/f/${fileIdx}`, '_blank', 'noopener,noreferrer');
    } else if (previewInfo?.source === 'submission' && previewInfo?.filePath && previewInfo?.taskId) {
      const params = new URLSearchParams();
      params.set('path', previewInfo.filePath);
      params.set('name', name);
      if (size) params.set('size', size.toString());
      params.set('taskId', previewInfo.taskId);
      if (previewInfo.groupSlug) params.set('groupId', previewInfo.groupSlug);
      window.open(`/file-preview?${params.toString()}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [previewInfo, name, size, url]);

  const getOfficeViewerUrl = (fileUrl: string) =>
    `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;

  /* ─── Render preview content ─── */
  const renderPreview = () => {
    if (!url) return <PreviewSkeleton />;

    if (!canPreview) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-gradient-to-b from-muted/30 to-transparent">
          <div className="p-5 rounded-2xl bg-secondary/50 mb-4 shadow-sm">
            {getFileIcon(name, 'lg')}
          </div>
          <Badge variant="outline" className="mb-3 text-xs">{getExtLabel(name)}</Badge>
          <h2 className="text-base font-semibold mb-1.5 text-foreground">Không thể xem trước</h2>
          <p className="text-muted-foreground mb-4 max-w-sm text-xs">
            Định dạng <strong>.{getFileExt(name)}</strong> không hỗ trợ xem trước. Bạn có thể tải về hoặc mở trong tab mới.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenInNewTab} className="gap-1.5 text-xs">
              <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
            </Button>
            <Button size="sm" onClick={handleDownload} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Tải xuống
            </Button>
          </div>
        </div>
      );
    }

    if (isPreviewableImage(name) && !imageError) {
      return (
        <div className="flex items-center justify-center h-full p-3 bg-secondary/20">
          {!imageLoaded && <PreviewSkeleton />}
          <img
            src={url}
            alt={name}
            className={cn(
              'max-w-full max-h-full object-contain rounded shadow-md transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0 absolute'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    if (isPDF(name)) {
      return <PDFViewer url={url} name={name} />;
    }

    if (isOfficeDoc(name)) {
      return (
        <div className="relative h-full">
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10"><PreviewSkeleton /></div>
          )}
          <iframe
            src={getOfficeViewerUrl(url)}
            className={cn('w-full h-full border-0 transition-opacity duration-200', iframeLoaded ? 'opacity-100' : 'opacity-0')}
            title={name}
            allow="fullscreen"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      );
    }

    if (isVideoFile(name)) {
      return (
        <div className="flex items-center justify-center h-full p-4 bg-black/90">
          <video src={url} controls className="max-w-full max-h-full rounded-lg shadow-2xl">
            Trình duyệt không hỗ trợ phát video.
          </video>
        </div>
      );
    }

    if (isAudioFile(name)) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="p-6 rounded-full bg-primary/10 mb-4 shadow-inner">
            {getFileIcon(name, 'lg')}
          </div>
          <Badge variant="outline" className="mb-2 text-xs">{getExtLabel(name)}</Badge>
          <h3 className="text-base font-medium mb-4 text-foreground">{name}</h3>
          <audio src={url} controls className="w-full max-w-md">
            Trình duyệt không hỗ trợ phát audio.
          </audio>
        </div>
      );
    }

    if (isTextFile(name)) {
      return (
        <div className="h-full bg-secondary/10">
          {isLoadingText ? (
            <PreviewSkeleton />
          ) : (
            <ScrollArea className="h-full">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words text-foreground leading-relaxed">
                {textContent || 'Không thể đọc nội dung file'}
              </pre>
            </ScrollArea>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
      <DialogContent
        className="max-w-[95vw] w-[1400px] h-[800px] max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0 border-2 border-primary/20 [&>button]:z-30"
        style={{ animationDuration: '0.2s' }}
        aria-describedby={undefined}
      >
        <VisuallyHidden><DialogTitle>Xem trước file</DialogTitle></VisuallyHidden>

        {/* ─── Header ─── */}
        <div className="gradient-primary px-4 py-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Task + File Info */}
            <div className="min-w-0 flex-1 space-y-1.5">
              {taskTitle && (
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5 text-white/60 shrink-0" />
                  <span className="text-[11px] text-white/60 font-medium uppercase tracking-wider shrink-0">Task:</span>
                  <h2 className="text-white font-semibold text-sm truncate" title={taskTitle}>
                    {taskTitle}
                  </h2>
                  {siblingFiles.length > 0 && (
                    <Badge variant="secondary" className="bg-white/20 text-white text-[10px] hover:bg-white/30 shrink-0">
                      {siblingFiles.length} file
                    </Badge>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="[&_svg]:text-white/90 shrink-0">
                  {getFileIcon(name, 'sm')}
                </div>
                <Badge variant="secondary" className="bg-white/15 text-white/80 text-[9px] px-1.5 py-0 shrink-0 font-mono">
                  {getExtLabel(name)}
                </Badge>
                <h3 className="font-medium text-sm text-white truncate" title={name}>
                  {name}
                </h3>
                {size > 0 && (
                  <span className="text-[10px] text-white/50 shrink-0">({formatFileSize(size)})</span>
                )}
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {hasSiblings && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadAll}
                  disabled={isDownloadingAll}
                  className="gap-1.5 h-8 text-xs bg-white/20 text-white border-white/30 hover:bg-white/30"
                >
                  {isDownloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderDown className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Tải tất cả</span>
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenInNewTab}
                className="gap-1.5 h-8 text-xs bg-white/20 text-white border-white/30 hover:bg-white/30"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tab mới</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                className="gap-1.5 h-8 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tải xuống</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          {hasSiblings && (
            <div className="w-56 border-r bg-secondary/30 shrink-0 flex flex-col">
              <div className="px-2.5 py-1.5 border-b text-[10px] font-semibold text-primary uppercase tracking-wide">
                Danh sách file ({siblingFiles.length})
              </div>
              <ScrollArea className="flex-1">
                <div className="p-1.5 space-y-1">
                  {siblingFiles.map((file, i) => (
                    <button
                      key={i}
                      onClick={() => switchFile(i, true)}
                      title={file.name}
                      className={cn(
                        'w-full flex items-start gap-2 px-2 py-2 rounded text-left transition-colors text-[11px] group',
                        i === activeIndex
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'hover:bg-secondary text-foreground'
                      )}
                    >
                      <div className={cn('shrink-0 mt-0.5', i === activeIndex && '[&_svg]:text-primary-foreground')}>
                        {getFileIcon(file.name, 'sm')}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p
                          className="text-[11px] leading-tight break-all line-clamp-2"
                          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                        >
                          {file.name}
                        </p>
                        {file.size ? (
                          <p className={cn('text-[9px] mt-0.5', i === activeIndex ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {formatFileSize(file.size)}
                          </p>
                        ) : null}
                      </div>
                      {i === activeIndex && <Eye className="w-3 h-3 shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Preview content */}
          <div className="flex-1 overflow-hidden bg-background">
            {renderPreview()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
