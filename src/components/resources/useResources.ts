import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ProjectResource, ResourceFolder } from './types';

export function useResources(groupId: string) {
  const { toast } = useToast();
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFolders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('resource_folders' as any)
        .select('*')
        .eq('group_id', groupId)
        .order('name', { ascending: true }) as any;
      if (error) throw error;
      setFolders((data || []) as ResourceFolder[]);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
    }
  }, [groupId]);

  const fetchResources = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('project_resources')
        .select('*')
        .eq('group_id', groupId)
        .order('order_index', { ascending: true });
      if (error) throw error;

      if (data && data.length > 0) {
        const uploaderIds = [...new Set(data.map(r => r.uploaded_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', uploaderIds);
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        setResources(
          data.map(r => ({
            ...r,
            folder_id: (r as any).folder_id || null,
            resource_type: (r as any).resource_type || 'file',
            link_url: (r as any).link_url || null,
            order_index: (r as any).order_index || 0,
            profiles: profilesMap.get(r.uploaded_by),
          })) as ProjectResource[]
        );
      } else {
        setResources([]);
      }
    } catch (error: any) {
      toast({ title: 'Lỗi', description: 'Không thể tải danh sách tài nguyên', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    fetchResources();
    fetchFolders();
  }, [fetchResources, fetchFolders]);

  const moveResourceToFolder = useCallback(
    async (resourceId: string, targetFolderId: string | null) => {
      const resource = resources.find(r => r.id === resourceId);
      if (!resource || resource.folder_id === targetFolderId) return;

      // Calculate new order_index
      const destResources = resources.filter(
        r => r.folder_id === targetFolderId && r.id !== resourceId
      );
      const maxOrder = destResources.length > 0
        ? Math.max(...destResources.map(r => r.order_index || 0))
        : 0;

      // Optimistic update
      setResources(prev =>
        prev.map(r =>
          r.id === resourceId
            ? { ...r, folder_id: targetFolderId, order_index: maxOrder + 1 }
            : r
        )
      );

      try {
        const { error } = await supabase
          .from('project_resources')
          .update({ folder_id: targetFolderId, order_index: maxOrder + 1 } as any)
          .eq('id', resourceId);
        if (error) throw error;

        const folderName = targetFolderId
          ? folders.find(f => f.id === targetFolderId)?.name || 'thư mục'
          : 'ngoài thư mục';
        toast({ title: 'Đã di chuyển', description: `"${resource.name}" → ${folderName}` });
      } catch (error: any) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
        fetchResources();
      }
    },
    [resources, folders, toast, fetchResources]
  );

  const reorderResources = useCallback(
    async (updates: { id: string; order_index: number; folder_id: string | null }[]) => {
      // Optimistic update
      setResources(prev => {
        const updated = [...prev];
        for (const u of updates) {
          const idx = updated.findIndex(r => r.id === u.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], folder_id: u.folder_id, order_index: u.order_index };
          }
        }
        return updated;
      });

      // Batch persist
      try {
        await Promise.all(
          updates.map(u =>
            supabase
              .from('project_resources')
              .update({ order_index: u.order_index, folder_id: u.folder_id } as any)
              .eq('id', u.id)
          )
        );
      } catch (error: any) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
        fetchResources();
      }
    },
    [toast, fetchResources]
  );

  const deleteResource = useCallback(
    async (resource: ProjectResource) => {
      try {
        if (resource.resource_type === 'file' && resource.storage_name) {
          await supabase.storage.from('project-resources').remove([resource.storage_name]);
        }
        const { error } = await supabase
          .from('project_resources')
          .delete()
          .eq('id', resource.id);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã xóa tài nguyên' });
        fetchResources();
      } catch (error: any) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      }
    },
    [toast, fetchResources]
  );

  const renameResource = useCallback(
    async (resource: ProjectResource, newName: string) => {
      let finalName = newName.trim();
      if (resource.resource_type === 'file') {
        const ext = resource.name.split('.').pop();
        const nameWithoutExt = newName.trim().replace(/\.[^/.]+$/, '');
        finalName = ext ? `${nameWithoutExt}.${ext}` : nameWithoutExt;
      }
      try {
        const { error } = await supabase
          .from('project_resources')
          .update({ name: finalName })
          .eq('id', resource.id);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã đổi tên' });
        fetchResources();
      } catch (error: any) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      }
    },
    [toast, fetchResources]
  );

  const createFolder = useCallback(
    async (name: string, description: string | null) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Chưa đăng nhập');
      const { error } = await (supabase
        .from('resource_folders' as any)
        .insert({ group_id: groupId, name, description, created_by: userData.user.id }) as any);
      if (error) throw error;
      toast({ title: 'Thành công', description: 'Đã tạo thư mục mới' });
      fetchFolders();
    },
    [groupId, toast, fetchFolders]
  );

  const updateFolder = useCallback(
    async (folderId: string, name: string, description: string | null) => {
      const { error } = await (supabase
        .from('resource_folders' as any)
        .update({ name, description })
        .eq('id', folderId) as any);
      if (error) throw error;
      toast({ title: 'Thành công', description: 'Đã cập nhật thư mục' });
      fetchFolders();
    },
    [toast, fetchFolders]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      // Move files to root first
      const { error: updateError } = await (supabase
        .from('project_resources')
        .update({ folder_id: null } as any)
        .eq('folder_id', folderId) as any);
      if (updateError) throw updateError;

      const { error } = await (supabase
        .from('resource_folders' as any)
        .delete()
        .eq('id', folderId) as any);
      if (error) throw error;
      toast({ title: 'Thành công', description: 'Đã xóa thư mục (các file được chuyển về gốc)' });
      fetchFolders();
      fetchResources();
    },
    [toast, fetchFolders, fetchResources]
  );

  const uploadResource = useCallback(
    async (params: {
      type: 'file' | 'link';
      file?: File;
      fileName?: string;
      linkUrl?: string;
      linkName?: string;
      category: string;
      description: string;
      folderId: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Chưa đăng nhập');

      const existingInFolder = resources.filter(r => r.folder_id === params.folderId);
      const maxOrder = existingInFolder.length > 0
        ? Math.max(...existingInFolder.map(r => r.order_index || 0))
        : 0;

      if (params.type === 'file' && params.file) {
        const fileExt = params.file.name.split('.').pop();
        const storageName = `${groupId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('project-resources').upload(storageName, params.file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('project-resources').getPublicUrl(storageName);
        const finalFileName = params.fileName?.trim() ? `${params.fileName.trim()}.${fileExt}` : params.file.name;
        const { error } = await (supabase.from('project_resources').insert({
          group_id: groupId, name: finalFileName, file_path: urlData.publicUrl, storage_name: storageName,
          file_size: params.file.size, file_type: params.file.type, category: params.category,
          description: params.description || null, uploaded_by: userData.user.id, folder_id: params.folderId,
          resource_type: 'file', link_url: null, order_index: maxOrder + 1,
        } as any) as any);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã tải lên tài nguyên' });
      } else if (params.type === 'link') {
        const { error } = await (supabase.from('project_resources').insert({
          group_id: groupId, name: params.linkName?.trim() || '', file_path: null, storage_name: null,
          file_size: 0, file_type: null, category: params.category, description: params.description || null,
          uploaded_by: userData.user.id, folder_id: params.folderId, resource_type: 'link',
          link_url: params.linkUrl?.trim() || '', order_index: maxOrder + 1,
        } as any) as any);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã thêm link tài nguyên' });
      }
      fetchResources();
    },
    [groupId, resources, toast, fetchResources]
  );

  const uploadMultipleResources = useCallback(
    async (params: {
      type: 'file' | 'link';
      files?: File[];
      fileNames?: Map<string, string>;
      links?: { name: string; url: string }[];
      category: string;
      description: string;
      folderId: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Chưa đăng nhập');

      const existingInFolder = resources.filter(r => r.folder_id === params.folderId);
      let maxOrder = existingInFolder.length > 0
        ? Math.max(...existingInFolder.map(r => r.order_index || 0))
        : 0;

      if (params.type === 'file' && params.files) {
        for (const file of params.files) {
          const fileExt = file.name.split('.').pop();
          const storageName = `${groupId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('project-resources').upload(storageName, file);
          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }
          const { data: urlData } = supabase.storage.from('project-resources').getPublicUrl(storageName);
          // Use original name or folder-relative path
          const key = file.name + file.size + file.lastModified;
          const relativePath = params.fileNames?.get(key);
          const displayName = relativePath || file.name;

          maxOrder++;
          await (supabase.from('project_resources').insert({
            group_id: groupId, name: displayName, file_path: urlData.publicUrl, storage_name: storageName,
            file_size: file.size, file_type: file.type, category: params.category,
            description: params.description || null, uploaded_by: userData.user.id, folder_id: params.folderId,
            resource_type: 'file', link_url: null, order_index: maxOrder,
          } as any) as any);
        }
        toast({ title: 'Thành công', description: `Đã tải lên ${params.files.length} file` });
      } else if (params.type === 'link' && params.links) {
        for (const link of params.links) {
          maxOrder++;
          await (supabase.from('project_resources').insert({
            group_id: groupId, name: link.name, file_path: null, storage_name: null,
            file_size: 0, file_type: null, category: params.category, description: params.description || null,
            uploaded_by: userData.user.id, folder_id: params.folderId, resource_type: 'link',
            link_url: link.url, order_index: maxOrder,
          } as any) as any);
        }
        toast({ title: 'Thành công', description: `Đã thêm ${params.links.length} link` });
      }
      fetchResources();
    },
    [groupId, resources, toast, fetchResources]
  );

  const reorderFolders = useCallback(
    async (newOrder: ResourceFolder[]) => {
      // We don't have order_index on folders table, so we'll just refetch
      // For now, we store order in local state
      setFolders(newOrder);
    },
    []
  );

  return {
    resources,
    folders,
    isLoading,
    fetchResources,
    fetchFolders,
    moveResourceToFolder,
    reorderResources,
    deleteResource,
    renameResource,
    createFolder,
    updateFolder,
    deleteFolder,
    uploadResource,
    uploadMultipleResources,
    reorderFolders,
  };
}
