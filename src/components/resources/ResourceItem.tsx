import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  File,
  Download,
  Eye,
  Calendar,
  User,
  GripVertical,
  Pencil,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  MoreVertical,
  FolderInput,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getFileIcon, formatFileSize } from './resourceUtils';
import { CATEGORIES } from './constants';
import type { ProjectResource, ResourceFolder } from './types';

interface ResourceItemProps {
  resource: ProjectResource;
  isLeader: boolean;
  folders: ResourceFolder[];
  dragHandleProps?: any;
  isDragging?: boolean;
  onPreview: (resource: ProjectResource) => void;
  onDownload: (resource: ProjectResource) => void;
  onRename: (resource: ProjectResource) => void;
  onDelete: (resource: ProjectResource) => void;
  onMoveToFolder: (resource: ProjectResource) => void;
}

export default function ResourceItem({
  resource,
  isLeader,
  folders,
  dragHandleProps,
  isDragging,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onMoveToFolder,
}: ResourceItemProps) {
  const category = CATEGORIES.find(c => c.value === resource.category);
  const isLink = resource.resource_type === 'link';

  return (
    <Card
      className={cn(
        'group hover:shadow-md transition-all hover:border-primary/30 cursor-pointer',
        isDragging && 'shadow-lg ring-2 ring-primary/30 opacity-90'
      )}
      onClick={() => onPreview(resource)}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {isLeader && dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none shrink-0"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border',
              isLink
                ? 'bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-200'
                : 'bg-gradient-to-br from-primary/10 to-primary/5'
            )}
          >
            {isLink ? <LinkIcon className="w-5 h-5 text-blue-600" /> : getFileIcon(resource.name, 'md')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm truncate max-w-[200px] sm:max-w-none" title={resource.name}>
                {resource.name}
              </h4>
              {isLink && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-blue-500/10 text-blue-600 border-blue-200">
                  Link
                </Badge>
              )}
              {category && (
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', category.color)}>
                  {category.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {!isLink && (
                <span className="flex items-center gap-1">
                  <File className="w-3 h-3" />
                  {formatFileSize(resource.file_size)}
                </span>
              )}
              {isLink && resource.link_url && (
                <span className="flex items-center gap-1 truncate max-w-[150px]" title={resource.link_url}>
                  <ExternalLink className="w-3 h-3" />
                  {(() => { try { return new URL(resource.link_url).hostname; } catch { return resource.link_url; } })()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(resource.created_at), 'dd/MM/yyyy', { locale: vi })}
              </span>
              <span className="items-center gap-1 hidden sm:flex">
                <User className="w-3 h-3" />
                {resource.profiles?.full_name || 'Unknown'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onPreview(resource); }}
              title={isLink ? 'Mở link' : 'Xem trước'}
            >
              {isLink ? <ExternalLink className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            {!isLink && (
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); onDownload(resource); }}
                title="Tải xuống"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            {isLeader && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onRename(resource)}>
                    <Pencil className="w-4 h-4 mr-2" /> Đổi tên
                  </DropdownMenuItem>
                  {folders.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onMoveToFolder(resource)}>
                        <FolderInput className="w-4 h-4 mr-2" /> Di chuyển vào thư mục
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(resource)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Xóa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
