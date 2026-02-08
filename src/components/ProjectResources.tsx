import { useState, useRef, useCallback, useEffect } from 'react';
import { useFilePreview } from '@/contexts/FilePreviewContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, Search, FolderOpen, FolderPlus, Folder, Plus, Loader2, Filter,
  ChevronRight, ChevronDown, MoreHorizontal, Pencil, Trash2,
  Link as LinkIcon, GripVertical, ArrowUp, ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import { useResources } from './resources/useResources';
import ResourceItem from './resources/ResourceItem';
import ResourceUploadDialog from './resources/ResourceUploadDialog';
import MoveToFolderDialog from './resources/MoveToFolderDialog';
import { FolderDialog, DeleteResourceDialog, DeleteFolderDialog, RenameDialog } from './resources/ResourceDialogs';
import { CATEGORIES } from './resources/constants';
import type { ProjectResource, ResourceFolder } from './resources/types';

interface ProjectResourcesProps {
  groupId: string;
  isLeader: boolean;
}

export default function ProjectResources({ groupId, isLeader }: ProjectResourcesProps) {
  const { toast } = useToast();
  const { openPreview } = useFilePreview();

  const {
    resources, folders, isLoading,
    moveResourceToFolder, reorderResources, reorderFolders,
    deleteResource, renameResource,
    createFolder, updateFolder, deleteFolder,
    uploadResource, uploadMultipleResources,
  } = useResources(groupId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Dialog states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'file' | 'link'>('file');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ResourceFolder | null>(null);
  const [deleteResourceTarget, setDeleteResourceTarget] = useState<ProjectResource | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<ResourceFolder | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectResource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [moveTarget, setMoveTarget] = useState<ProjectResource | null>(null);

  // Auto-expand folder on drag hover
  const dragOverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (dragOverTimerRef.current) clearTimeout(dragOverTimerRef.current);
    };
  }, []);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  };

  // Filter
  const filtered = resources.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
    return matchSearch && matchCat;
  });
  const rootResources = filtered.filter(r => !r.folder_id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const getResourcesInFolder = (folderId: string) =>
    filtered.filter(r => r.folder_id === folderId).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  // Drag and drop
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (dragOverTimerRef.current) clearTimeout(dragOverTimerRef.current);
      setDragOverFolderId(null);

      if (!result.destination || !isLeader) return;
      const { source, destination, draggableId } = result;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      const sourceFolderId = source.droppableId === 'root-resources' ? null : source.droppableId;
      const destFolderId = destination.droppableId === 'root-resources' ? null : destination.droppableId;
      const resource = resources.find(r => r.id === draggableId);
      if (!resource) return;

      // Build new ordered list for destination
      const destResources = resources
        .filter(r => r.folder_id === destFolderId && r.id !== draggableId)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      const movedResource = { ...resource, folder_id: destFolderId };
      destResources.splice(destination.index, 0, movedResource);

      const updates = destResources.map((r, i) => ({
        id: r.id,
        order_index: i + 1,
        folder_id: destFolderId,
      }));

      // Also re-index source if different
      if (sourceFolderId !== destFolderId) {
        const sourceResources = resources
          .filter(r => r.folder_id === sourceFolderId && r.id !== draggableId)
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        sourceResources.forEach((r, i) => {
          updates.push({ id: r.id, order_index: i + 1, folder_id: sourceFolderId });
        });

        const folderName = destFolderId
          ? folders.find(f => f.id === destFolderId)?.name || 'thư mục'
          : 'ngoài thư mục';
        toast({ title: 'Đã di chuyển', description: `"${resource.name}" → ${folderName}` });
      }

      reorderResources(updates);
    },
    [isLeader, resources, folders, reorderResources, toast]
  );

  // Navigation
  const handlePreview = (resource: ProjectResource) => {
    if (resource.resource_type === 'link' && resource.link_url) {
      window.open(resource.link_url, '_blank');
    } else if (resource.file_path) {
      openPreview({
        url: resource.file_path,
        name: resource.name,
        size: resource.file_size,
        source: 'resource',
      });
    }
  };

  const handleDownload = (resource: ProjectResource) => {
    if (resource.resource_type === 'link' && resource.link_url) {
      window.open(resource.link_url, '_blank');
    } else if (resource.file_path) {
      window.open(resource.file_path, '_blank');
    }
  };

  // Delete handlers
  const handleDeleteResource = async () => {
    if (!deleteResourceTarget) return;
    setIsDeleting(true);
    try {
      await deleteResource(deleteResourceTarget);
      setDeleteResourceTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    setIsDeleting(true);
    try {
      await deleteFolder(deleteFolderTarget.id);
      setDeleteFolderTarget(null);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameTarget) return;
    setIsRenaming(true);
    try {
      await renameResource(renameTarget, newName);
      setRenameTarget(null);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleFolderSubmit = async (name: string, description: string | null) => {
    if (editingFolder) {
      await updateFolder(editingFolder.id, name, description);
    } else {
      await createFolder(name, description);
    }
  };

  const openUploadDialog = (folderId: string | null, type: 'file' | 'link') => {
    setUploadFolderId(folderId);
    setUploadType(type);
    setUploadOpen(true);
  };

  const moveFolderUp = (index: number) => {
    if (index <= 0) return;
    const newFolders = [...folders];
    [newFolders[index - 1], newFolders[index]] = [newFolders[index], newFolders[index - 1]];
    reorderFolders(newFolders);
  };

  const moveFolderDown = (index: number) => {
    if (index >= folders.length - 1) return;
    const newFolders = [...folders];
    [newFolders[index], newFolders[index + 1]] = [newFolders[index + 1], newFolders[index]];
    reorderFolders(newFolders);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* hidden inputs removed - multi-file handled in dialog */}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary" />
          Tài nguyên dự án
          <Badge variant="secondary" className="ml-2">{resources.length}</Badge>
        </h2>
        {isLeader && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditingFolder(null); setFolderDialogOpen(true); }}>
              <FolderPlus className="w-4 h-4 mr-2" /> Tạo thư mục
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Thêm mới</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openUploadDialog(null, 'file')}>
                  <Upload className="w-4 h-4 mr-2" /> Tải file lên
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openUploadDialog(null, 'link')}>
                  <LinkIcon className="w-4 h-4 mr-2" /> Thêm link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tìm kiếm tài nguyên..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-44 h-9">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Phân loại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {folders.length === 0 && filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg">Chưa có tài nguyên</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isLeader ? 'Tải lên tài liệu, thêm link hoặc tạo thư mục cho dự án' : 'Chưa có tài nguyên nào được chia sẻ'}
            </p>
            {isLeader && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setFolderDialogOpen(true)}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Tạo thư mục
                </Button>
                <Button onClick={() => openUploadDialog(null, 'file')}>
                  <Upload className="w-4 h-4 mr-2" /> Tải file lên
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-3">
            {/* Folders */}
            {folders.map((folder, folderIndex) => {
              const folderResources = getResourcesInFolder(folder.id);
              const isExpanded = expandedFolders.has(folder.id);
              const isDragOver = dragOverFolderId === folder.id;

              return (
                <Droppable key={folder.id} droppableId={folder.id}>
                  {(droppableProvided, droppableSnapshot) => {
                    // Auto-expand on drag hover
                    if (droppableSnapshot.isDraggingOver && !isExpanded) {
                      if (!dragOverTimerRef.current || dragOverFolderId !== folder.id) {
                        if (dragOverTimerRef.current) clearTimeout(dragOverTimerRef.current);
                        setDragOverFolderId(folder.id);
                        dragOverTimerRef.current = setTimeout(() => {
                          setExpandedFolders(prev => new Set(prev).add(folder.id));
                        }, 600);
                      }
                    } else if (!droppableSnapshot.isDraggingOver && dragOverFolderId === folder.id) {
                      if (dragOverTimerRef.current) clearTimeout(dragOverTimerRef.current);
                      setDragOverFolderId(null);
                    }

                    return (
                      <Collapsible open={isExpanded} onOpenChange={() => toggleFolder(folder.id)}>
                        <Card className={cn(
                          'overflow-hidden transition-all',
                          droppableSnapshot.isDraggingOver && 'ring-2 ring-primary/40 shadow-md'
                        )}>
                          <CollapsibleTrigger asChild>
                            <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center shrink-0 border border-amber-200">
                                <Folder className="w-5 h-5 text-amber-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm">{folder.name}</h4>
                                  <Badge variant="secondary" className="text-[10px]">{folderResources.length} file</Badge>
                                </div>
                                {folder.description && <p className="text-xs text-muted-foreground truncate">{folder.description}</p>}
                              </div>
                              <div className="flex items-center gap-1">
                                {isLeader && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openUploadDialog(folder.id, 'file'); }}>
                                        <Upload className="w-4 h-4 mr-2" /> Tải file vào đây
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openUploadDialog(folder.id, 'link'); }}>
                                        <LinkIcon className="w-4 h-4 mr-2" /> Thêm link vào đây
                                      </DropdownMenuItem>
                                      {folderIndex > 0 && (
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveFolderUp(folderIndex); }}>
                                          <ArrowUp className="w-4 h-4 mr-2" /> Di chuyển lên
                                        </DropdownMenuItem>
                                      )}
                                      {folderIndex < folders.length - 1 && (
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveFolderDown(folderIndex); }}>
                                          <ArrowDown className="w-4 h-4 mr-2" /> Di chuyển xuống
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); setFolderDialogOpen(true); }}>
                                        <Pencil className="w-4 h-4 mr-2" /> Sửa thư mục
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteFolderTarget(folder); }}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Xóa thư mục
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div
                              ref={droppableProvided.innerRef}
                              {...droppableProvided.droppableProps}
                              className={cn(
                                'border-t p-2 space-y-2 min-h-[48px] transition-colors',
                                droppableSnapshot.isDraggingOver ? 'bg-primary/5' : 'bg-muted/30'
                              )}
                            >
                              {folderResources.length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  {droppableSnapshot.isDraggingOver ? (
                                    <span className="text-primary font-medium">Thả vào đây</span>
                                  ) : (
                                    <>
                                      Thư mục trống
                                      {isLeader && (
                                        <div className="flex justify-center gap-2 mt-2">
                                          <Button variant="link" size="sm" onClick={() => openUploadDialog(folder.id, 'file')}>
                                            <Upload className="w-3 h-3 mr-1" /> Tải file
                                          </Button>
                                          <Button variant="link" size="sm" onClick={() => openUploadDialog(folder.id, 'link')}>
                                            <LinkIcon className="w-3 h-3 mr-1" /> Thêm link
                                          </Button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : (
                                folderResources.map((resource, index) => (
                                  <Draggable key={resource.id} draggableId={resource.id} index={index} isDragDisabled={!isLeader}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                                        <ResourceItem
                                          resource={resource}
                                          isLeader={isLeader}
                                          folders={folders}
                                          dragHandleProps={dragProvided.dragHandleProps}
                                          isDragging={dragSnapshot.isDragging}
                                          onPreview={handlePreview}
                                          onDownload={handleDownload}
                                          onRename={setRenameTarget}
                                          onDelete={setDeleteResourceTarget}
                                          onMoveToFolder={setMoveTarget}
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                ))
                              )}
                              {droppableProvided.placeholder}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  }}
                </Droppable>
              );
            })}

            {/* Root resources */}
            <Droppable droppableId="root-resources">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'space-y-2 min-h-[48px] rounded-lg transition-colors',
                    snapshot.isDraggingOver && 'bg-primary/5 p-2 border-2 border-dashed border-primary/30'
                  )}
                >
                  {folders.length > 0 && rootResources.length > 0 && (
                    <h3 className="text-sm font-medium text-muted-foreground px-1">File không thuộc thư mục</h3>
                  )}
                  {rootResources.map((resource, index) => (
                    <Draggable key={resource.id} draggableId={resource.id} index={index} isDragDisabled={!isLeader}>
                      {(dragProvided, dragSnapshot) => (
                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                          <ResourceItem
                            resource={resource}
                            isLeader={isLeader}
                            folders={folders}
                            dragHandleProps={dragProvided.dragHandleProps}
                            isDragging={dragSnapshot.isDragging}
                            onPreview={handlePreview}
                            onDownload={handleDownload}
                            onRename={setRenameTarget}
                            onDelete={setDeleteResourceTarget}
                            onMoveToFolder={setMoveTarget}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>
      )}

      {/* Dialogs */}
      <ResourceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folders={folders}
        initialFolderId={uploadFolderId}
        initialType={uploadType}
        onUploadMultiple={uploadMultipleResources}
        onUpload={uploadResource}
      />
      <MoveToFolderDialog
        open={!!moveTarget}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        folders={folders}
        currentFolderId={moveTarget?.folder_id || null}
        resourceName={moveTarget?.name || ''}
        onMove={(folderId) => {
          if (moveTarget) {
            moveResourceToFolder(moveTarget.id, folderId);
            setMoveTarget(null);
          }
        }}
      />
      <FolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        editingFolder={editingFolder}
        onSubmit={handleFolderSubmit}
      />
      <DeleteResourceDialog
        resource={deleteResourceTarget}
        onClose={() => setDeleteResourceTarget(null)}
        onConfirm={handleDeleteResource}
        isDeleting={isDeleting}
      />
      <DeleteFolderDialog
        folder={deleteFolderTarget}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={handleDeleteFolder}
        isDeleting={isDeleting}
      />
      <RenameDialog
        resource={renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={handleRename}
        isRenaming={isRenaming}
      />
    </div>
  );
}
