
-- Add order_index column to project_resources for drag-drop reordering
ALTER TABLE public.project_resources 
ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Set initial order based on created_at
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY group_id, folder_id ORDER BY created_at) as rn
  FROM public.project_resources
)
UPDATE public.project_resources pr
SET order_index = ranked.rn
FROM ranked
WHERE pr.id = ranked.id;
