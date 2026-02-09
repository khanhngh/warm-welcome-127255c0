
-- Add is_locked column to task_notes
ALTER TABLE public.task_notes ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- Make created_by nullable so anonymous users can create notes
ALTER TABLE public.task_notes ALTER COLUMN created_by DROP NOT NULL;

-- Allow public to view notes of public group tasks
CREATE POLICY "Public can view notes of public groups"
ON public.task_notes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tasks t JOIN groups g ON g.id = t.group_id
  WHERE t.id = task_notes.task_id AND g.is_public = true
));

-- Allow public to create notes on public group tasks
CREATE POLICY "Public can create notes on public groups"
ON public.task_notes
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM tasks t JOIN groups g ON g.id = t.group_id
  WHERE t.id = task_notes.task_id AND g.is_public = true
));

-- Allow public to update unlocked notes on public group tasks
CREATE POLICY "Public can update unlocked notes on public groups"
ON public.task_notes
FOR UPDATE
USING (
  is_locked = false AND EXISTS (
    SELECT 1 FROM tasks t JOIN groups g ON g.id = t.group_id
    WHERE t.id = task_notes.task_id AND g.is_public = true
  )
);

-- Allow authenticated users to update locked notes (they already have ALL via assignee/leader policy)
-- But we also need group members (not just assignees) to lock/unlock
CREATE POLICY "Group members can update task notes"
ON public.task_notes
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM tasks t
  WHERE t.id = task_notes.task_id AND is_group_member(auth.uid(), t.group_id)
));

-- Allow public to view note attachments of public groups
CREATE POLICY "Public can view note attachments of public groups"
ON public.task_note_attachments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM task_notes n
  JOIN tasks t ON t.id = n.task_id
  JOIN groups g ON g.id = t.group_id
  WHERE n.id = task_note_attachments.note_id AND g.is_public = true
));
