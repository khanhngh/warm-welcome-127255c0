export interface ProjectResource {
  id: string;
  group_id: string;
  name: string;
  file_path: string | null;
  storage_name: string | null;
  file_size: number;
  file_type: string | null;
  category: string | null;
  description: string | null;
  uploaded_by: string;
  created_at: string;
  folder_id: string | null;
  resource_type: string;
  link_url: string | null;
  order_index: number;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface ResourceFolder {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}
