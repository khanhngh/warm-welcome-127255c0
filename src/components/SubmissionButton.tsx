import { useFilePreview } from '@/contexts/FilePreviewContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ExternalLink, 
  ChevronDown, 
  Eye, 
  File, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  Image as ImageIcon 
} from 'lucide-react';

interface SubmissionItem {
  title?: string;
  url?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  storage_name?: string; // Safe UUID-based storage name
  type?: 'link' | 'file';
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return <FileText className="w-3 h-3 text-red-500" />;
    case 'doc': case 'docx': return <FileText className="w-3 h-3 text-blue-500" />;
    case 'xls': case 'xlsx': case 'csv': return <FileSpreadsheet className="w-3 h-3 text-green-500" />;
    case 'ppt': case 'pptx': return <Presentation className="w-3 h-3 text-orange-500" />;
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return <ImageIcon className="w-3 h-3 text-purple-500" />;
    default: return <File className="w-3 h-3 text-muted-foreground" />;
  }
};

export function parseSubmissionLinks(submissionLink: string | null): SubmissionItem[] {
  if (!submissionLink) return [];
  try {
    const parsed = JSON.parse(submissionLink);
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        ...item,
        type: item.file_path ? 'file' : 'link'
      }));
    }
    return [{ title: 'Bài nộp', url: submissionLink, type: 'link' }];
  } catch {
    return [{ title: 'Bài nộp', url: submissionLink, type: 'link' }];
  }
}

interface SubmissionButtonProps {
  submissionLink: string | null;
  variant?: 'default' | 'compact';
  onStopPropagation?: boolean;
  taskId?: string;
  taskTitle?: string;
  groupId?: string;
  shareToken?: string;
  taskSlug?: string;
}

export default function SubmissionButton({ 
  submissionLink, 
  variant = 'default',
  onStopPropagation = true,
  taskId,
  taskTitle,
  groupId,
  shareToken,
  taskSlug,
}: SubmissionButtonProps) {
  // Hooks must be called before any conditional returns
  const { openPreview } = useFilePreview();

  if (!submissionLink) {
    return variant === 'compact' ? (
      <span className="inline-flex h-7 w-[104px] items-center justify-center text-[10px] text-muted-foreground whitespace-nowrap">—</span>
    ) : null;
  }

  const items = parseSubmissionLinks(submissionLink);
  
  if (items.length === 0) {
    return variant === 'compact' ? (
      <span className="inline-flex h-7 w-[104px] items-center justify-center text-[10px] text-muted-foreground whitespace-nowrap">—</span>
    ) : null;
  }

  // Build sibling files list for the popup sidebar
  const fileItems = items.filter(i => i.type === 'file' && i.file_path);
  const buildSiblingFiles = () => {
    return fileItems.map(fi => {
      const { data } = supabase.storage.from('task-submissions').getPublicUrl(fi.file_path!);
      return {
        url: data?.publicUrl || '',
        name: fi.file_name || 'file',
        size: fi.file_size || 0,
        filePath: fi.file_path,
      };
    });
  };

  const handleOpenItem = (item: SubmissionItem, e?: React.MouseEvent) => {
    if (onStopPropagation && e) {
      e.stopPropagation();
    }
    
    if (item.type === 'file' && item.file_path) {
      const { data } = supabase.storage
        .from('task-submissions')
        .getPublicUrl(item.file_path);
      if (data?.publicUrl) {
        const siblings = buildSiblingFiles();
        const activeIdx = siblings.findIndex(s => s.filePath === item.file_path);
        openPreview({
          url: data.publicUrl,
          name: item.file_name || 'file',
          size: item.file_size || 0,
          filePath: item.file_path,
          taskId,
          taskTitle,
          taskSlug,
          groupSlug: groupId,
          shareToken,
          siblingFiles: siblings.length > 1 ? siblings : undefined,
          activeIndex: siblings.length > 1 ? activeIdx : undefined,
          source: 'submission',
        });
      }
    } else if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (items.length === 1) {
    const item = items[0];
    const isFile = item.type === 'file';
    
    return (
      <Button
        variant="outline"
        size="sm"
        className={`h-7 text-xs px-2 gap-1 text-primary whitespace-nowrap ${
          variant === 'compact' ? 'w-[104px] justify-center' : ''
        }`}
        onClick={(e) => handleOpenItem(item, e)}
      >
        {isFile ? (
          <>
            <Eye className="w-3 h-3" />
            {variant === 'compact' ? 'File' : 'Xem file'}
          </>
        ) : (
          <>
            <ExternalLink className="w-3 h-3" />
            {variant === 'compact' ? 'Xem' : 'Xem bài nộp'}
          </>
        )}
      </Button>
    );
  }

  // Multiple items
  const hasFiles = items.some(i => i.type === 'file');
  const hasLinks = items.some(i => i.type === 'link');
  const filesCount = items.filter(i => i.type === 'file').length;
  const linksCount = items.filter(i => i.type === 'link').length;
  
  let label = `Xem (${items.length})`;
  if (hasFiles && hasLinks) {
    label = `${filesCount}F+${linksCount}L`;
  } else if (hasFiles) {
    label = `${filesCount} file`;
  } else {
    label = `${linksCount} link`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-xs px-2 gap-1 text-primary whitespace-nowrap overflow-hidden ${
            variant === 'compact' ? 'w-[104px] justify-center' : ''
          }`}
          onClick={(e) => onStopPropagation && e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className={variant === 'compact' ? 'truncate max-w-[56px]' : ''}>
            {variant === 'compact' ? label : `Xem bài (${items.length})`}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 bg-popover min-w-[200px]">
        {items.map((item, i) => {
          const isFile = item.type === 'file';
          return (
            <DropdownMenuItem 
              key={i}
              onClick={(e) => handleOpenItem(item, e)}
              className="text-xs cursor-pointer"
            >
              {isFile ? (
                <>
                  {getFileIcon(item.file_name || 'file')}
                  <span className="ml-2 truncate">{item.title || item.file_name || 'File'}</span>
                  <Eye className="w-3 h-3 ml-auto opacity-50" />
                </>
              ) : (
                <>
                  <ExternalLink className="w-3 h-3 mr-2" />
                  <span className="truncate">{item.title || `Link ${i + 1}`}</span>
                </>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
