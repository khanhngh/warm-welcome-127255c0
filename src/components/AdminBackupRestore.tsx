import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Download, 
  Upload, 
  Loader2, 
  FolderArchive,
  AlertTriangle,
  CheckCircle,
  File,
  MessageSquare,
  FileText,
  History,
  FolderOpen,
  MessageCircle,
  Award,
  Settings,
  Filter,
  ChevronDown
} from 'lucide-react';
import JSZip from 'jszip';
import { generateProjectEvidencePdfBlob, ExportData as EvidenceExportData, ExportOptions as EvidenceExportOptions } from '@/lib/projectEvidencePdf';

interface Group {
  id: string;
  name: string;
  description: string | null;
  class_code: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  additional_info: string | null;
  zalo_link: string | null;
  leader_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  is_public: boolean | null;
  share_token: string | null;
  show_activity_public: boolean | null;
  show_members_public: boolean | null;
  show_resources_public: boolean | null;
}

interface FileSubmission {
  original_path: string;
  file_name: string;
  file_size: number;
  zip_path: string;
  bucket: string;
}

interface BackupMessage {
  student_id: string;
  content: string;
  source_type: string;
  created_at: string;
}

interface BackupTaskNote {
  task_title: string;
  version_name: string;
  content: string | null;
  created_by_student_id: string;
  created_at: string;
  attachments: Array<{
    file_name: string;
    file_size: number;
    original_path: string;
  }>;
}

interface BackupTaskComment {
  task_title: string;
  student_id: string;
  content: string;
  parent_index: number | null;
  created_at: string;
}

interface BackupResource {
  name: string;
  description: string | null;
  file_path: string | null;
  file_size: number;
  file_type: string | null;
  category: string | null;
  folder_name: string | null;
  uploaded_by_student_id: string;
  created_at: string;
  resource_type?: string;
  link_url?: string | null;
  order_index?: number;
}

interface BackupResourceFolder {
  name: string;
  description: string | null;
  created_by_student_id: string;
  created_at: string;
}

interface BackupActivityLog {
  action: string;
  action_type: string;
  description: string | null;
  user_name: string;
  student_id: string;
  created_at: string;
  metadata: any;
}

interface BackupStageWeight {
  stage_name: string;
  weight: number;
}

interface BackupMemberStageScore {
  student_id: string;
  stage_name: string;
  average_score: number | null;
  k_coefficient: number | null;
  adjusted_score: number | null;
  final_stage_score: number | null;
  late_task_count: number;
  early_submission_bonus: boolean;
  bug_hunter_bonus: boolean;
}

interface BackupMemberFinalScore {
  student_id: string;
  weighted_average: number | null;
  adjustment: number | null;
  final_score: number | null;
}

interface BackupScoreAppeal {
  student_id: string;
  task_title: string | null;
  stage_name: string | null;
  reason: string;
  status: string;
  reviewer_student_id: string | null;
  reviewer_response: string | null;
  created_at: string;
}

interface BackupData {
  version: string;
  exported_at: string;
  project_name: string;
  group: Omit<Group, 'id'>;
  members: Array<{ user_id: string; role: string; joined_at: string; profile: { student_id: string; full_name: string; email: string } }>;
  stages: Array<{ 
    name: string; 
    description: string | null; 
    order_index: number; 
    start_date: string | null; 
    end_date: string | null; 
    weight: number | null;
    is_hidden: boolean | null;
  }>;
  tasks: Array<{
    title: string;
    description: string | null;
    status: string;
    deadline: string | null;
    extended_deadline: string | null;
    submission_link: string | null;
    stage_name: string | null;
    max_file_size: number | null;
    is_hidden: boolean | null;
    assignments: Array<{ student_id: string }>;
    scores: Array<any>;
    submissions: Array<any>;
  }>;
  messages?: BackupMessage[];
  task_notes?: BackupTaskNote[];
  task_comments?: BackupTaskComment[];
  resources?: BackupResource[];
  resource_folders?: BackupResourceFolder[];
  activity_logs?: BackupActivityLog[];
  stage_weights?: BackupStageWeight[];
  member_stage_scores?: BackupMemberStageScore[];
  member_final_scores?: BackupMemberFinalScore[];
  score_appeals?: BackupScoreAppeal[];
  files?: FileSubmission[];
}

interface ExportOptions {
  includeMessages: boolean;
  includeTaskNotes: boolean;
  includeTaskComments: boolean;
  includeResources: boolean;
  includeActivityLogs: boolean;
  includeScores: boolean;
}

export default function AdminBackupRestore() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeMessages: true,
    includeTaskNotes: true,
    includeTaskComments: true,
    includeResources: true,
    includeActivityLogs: true,
    includeScores: true,
  });

  const selectedCount = Object.values(exportOptions).filter(v => v).length;

  const selectAllOptions = () => {
    setExportOptions({
      includeMessages: true,
      includeTaskNotes: true,
      includeTaskComments: true,
      includeResources: true,
      includeActivityLogs: true,
      includeScores: true,
    });
  };

  const deselectAllOptions = () => {
    setExportOptions({
      includeMessages: false,
      includeTaskNotes: false,
      includeTaskComments: false,
      includeResources: false,
      includeActivityLogs: false,
      includeScores: false,
    });
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllGroups();
    }
  }, [isAdmin]);

  const fetchAllGroups = async () => {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('name');
    
    if (data && !error) {
      setGroups(data as Group[]);
    }
  };

  const generateNewId = () => crypto.randomUUID();

  // Parse submission links to find file submissions
  const parseFileSubmissions = (submissionLink: string | null): { file_path: string; file_name: string; file_size: number }[] => {
    if (!submissionLink) return [];
    try {
      const parsed = JSON.parse(submissionLink);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(item => item.file_path)
          .map(item => ({
            file_path: item.file_path,
            file_name: item.file_name || 'file',
            file_size: item.file_size || 0
          }));
      }
    } catch {
      return [];
    }
    return [];
  };

  const exportProject = async () => {
    if (!selectedGroupId) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn project để sao lưu', variant: 'destructive' });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const group = groups.find(g => g.id === selectedGroupId);
      if (!group) throw new Error('Không tìm thấy project');

      setExportProgress(5);

      // Fetch all related data
      const [membersRes, stagesRes, tasksRes] = await Promise.all([
        supabase
          .from('group_members')
          .select('user_id, role, joined_at')
          .eq('group_id', selectedGroupId),
        supabase
          .from('stages')
          .select('*')
          .eq('group_id', selectedGroupId)
          .order('order_index'),
        supabase
          .from('tasks')
          .select('*')
          .eq('group_id', selectedGroupId),
      ]);

      setExportProgress(15);

      // Fetch profiles for members
      const memberUserIds = membersRes.data?.map(m => m.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, student_id, full_name, email')
        .in('id', memberUserIds);

      const userIdToStudentId = new Map<string, string>();
      profilesData?.forEach(p => userIdToStudentId.set(p.id, p.student_id));

      // Fetch task-related data
      const taskIds = tasksRes.data?.map(t => t.id) || [];
      const stageIds = stagesRes.data?.map(s => s.id) || [];

      const [assignmentsRes, scoresRes, submissionsRes] = await Promise.all([
        supabase.from('task_assignments').select('*').in('task_id', taskIds),
        supabase.from('task_scores').select('*').in('task_id', taskIds),
        supabase.from('submission_history').select('*').in('task_id', taskIds)
      ]);

      setExportProgress(25);

      // Fetch optional data based on export options
      let messagesRes = { data: [] as any[] };
      let taskNotesRes = { data: [] as any[] };
      let noteAttachmentsRes = { data: [] as any[] };
      let taskCommentsRes = { data: [] as any[] };
      let resourcesRes = { data: [] as any[] };
      let resourceFoldersRes = { data: [] as any[] };
      let activityLogsRes = { data: [] as any[] };
      let stageWeightsRes = { data: [] as any[] };
      let memberStageScoresRes = { data: [] as any[] };
      let memberFinalScoresRes = { data: [] as any[] };
      let scoreAppealsRes = { data: [] as any[] };

      const optionalFetches: Promise<void>[] = [];

      if (exportOptions.includeMessages) {
        optionalFetches.push(
          (async () => {
            const res = await supabase
              .from('project_messages')
              .select('*')
              .eq('group_id', selectedGroupId)
              .order('created_at');
            messagesRes = res;
          })()
        );
      }

      if (exportOptions.includeTaskNotes && taskIds.length > 0) {
        optionalFetches.push(
          (async () => {
            const res = await supabase
              .from('task_notes')
              .select('*')
              .in('task_id', taskIds)
              .order('created_at');
            taskNotesRes = res;
          })()
        );
      }

      if (exportOptions.includeTaskComments && taskIds.length > 0) {
        optionalFetches.push(
          (async () => {
            const res = await supabase
              .from('task_comments')
              .select('*')
              .in('task_id', taskIds)
              .order('created_at');
            taskCommentsRes = res;
          })()
        );
      }

      if (exportOptions.includeResources) {
        optionalFetches.push(
          (async () => {
            const res = await supabase
              .from('project_resources')
              .select('*')
              .eq('group_id', selectedGroupId);
            resourcesRes = res;
          })(),
          (async () => {
            const res = await supabase
              .from('resource_folders')
              .select('*')
              .eq('group_id', selectedGroupId);
            resourceFoldersRes = res;
          })()
        );
      }

      if (exportOptions.includeActivityLogs) {
        optionalFetches.push(
          (async () => {
            const res = await supabase
              .from('activity_logs')
              .select('*')
              .eq('group_id', selectedGroupId)
              .order('created_at', { ascending: false })
              .limit(500);
            activityLogsRes = res;
          })()
        );
      }

      if (exportOptions.includeScores && stageIds.length > 0) {
        optionalFetches.push(
          (async () => {
            const res = await supabase
              .from('stage_weights')
              .select('*')
              .eq('group_id', selectedGroupId);
            stageWeightsRes = res;
          })(),
          (async () => {
            const res = await supabase
              .from('member_stage_scores')
              .select('*')
              .in('stage_id', stageIds);
            memberStageScoresRes = res;
          })(),
          (async () => {
            const res = await supabase
              .from('member_final_scores')
              .select('*')
              .eq('group_id', selectedGroupId);
            memberFinalScoresRes = res;
          })()
        );
      }

      await Promise.all(optionalFetches);

      setExportProgress(35);

      // Fetch note attachments if task notes exist
      if (taskNotesRes.data && taskNotesRes.data.length > 0) {
        const noteIds = taskNotesRes.data.map(n => n.id);
        const { data } = await supabase
          .from('task_note_attachments')
          .select('*')
          .in('note_id', noteIds);
        noteAttachmentsRes = { data: data || [] };
      }

      // Fetch score appeals
      if (exportOptions.includeScores && taskIds.length > 0) {
        const taskScoreIds = scoresRes.data?.map(s => s.id) || [];
        const stageScoreIds = memberStageScoresRes.data?.map(s => s.id) || [];
        
        if (taskScoreIds.length > 0 || stageScoreIds.length > 0) {
          const { data } = await supabase
            .from('score_appeals')
            .select('*');
          scoreAppealsRes = { 
            data: (data || []).filter(a => 
              (a.task_score_id && taskScoreIds.includes(a.task_score_id)) ||
              (a.stage_score_id && stageScoreIds.includes(a.stage_score_id))
            ) 
          };
        }
      }

      setExportProgress(45);

      // Collect all files to download
      const filesToDownload: { path: string; name: string; size: number; bucket: string }[] = [];
      
      // Task submission files
      tasksRes.data?.forEach(task => {
        const files = parseFileSubmissions(task.submission_link);
        files.forEach(f => filesToDownload.push({ path: f.file_path, name: f.file_name, size: f.file_size, bucket: 'task-submissions' }));
      });
      
      submissionsRes.data?.forEach(sub => {
        if (sub.file_path && sub.file_name) {
          filesToDownload.push({ path: sub.file_path, name: sub.file_name, size: sub.file_size || 0, bucket: 'task-submissions' });
        }
        const files = parseFileSubmissions(sub.submission_link);
        files.forEach(f => filesToDownload.push({ path: f.file_path, name: f.file_name, size: f.file_size, bucket: 'task-submissions' }));
      });

      // Task note attachments
      noteAttachmentsRes.data?.forEach(att => {
        filesToDownload.push({ path: att.file_path, name: att.file_name, size: att.file_size, bucket: 'task-note-attachments' });
      });

      // Project resources
      resourcesRes.data?.forEach(res => {
        filesToDownload.push({ path: res.file_path, name: res.name, size: res.file_size, bucket: 'project-resources' });
      });

      // Remove duplicates
      const uniqueFiles = Array.from(new Map(filesToDownload.map(f => [`${f.bucket}/${f.path}`, f])).values());

      setExportProgress(50);

      // Build backup data
      const membersWithProfiles = membersRes.data?.map(m => {
        const profile = profilesData?.find(p => p.id === m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          profile: {
            student_id: profile?.student_id || '',
            full_name: profile?.full_name || '',
            email: profile?.email || ''
          }
        };
      }) || [];

      const stagesMap = new Map<string, string>();
      stagesRes.data?.forEach(s => stagesMap.set(s.id, s.name));

      const taskIdToTitle = new Map<string, string>();
      tasksRes.data?.forEach(t => taskIdToTitle.set(t.id, t.title));

      const tasksWithDetails = tasksRes.data?.map(task => {
        const taskAssignments = assignmentsRes.data?.filter(a => a.task_id === task.id) || [];
        const taskScores = scoresRes.data?.filter(s => s.task_id === task.id) || [];
        const taskSubmissions = submissionsRes.data?.filter(s => s.task_id === task.id) || [];

        return {
          title: task.title,
          description: task.description,
          status: task.status,
          deadline: task.deadline,
          extended_deadline: task.extended_deadline,
          submission_link: task.submission_link,
          stage_name: task.stage_id ? stagesMap.get(task.stage_id) || null : null,
          max_file_size: task.max_file_size,
          is_hidden: task.is_hidden,
          assignments: taskAssignments.map(a => ({
            student_id: userIdToStudentId.get(a.user_id) || ''
          })),
          scores: taskScores.map(s => ({
            student_id: userIdToStudentId.get(s.user_id) || '',
            base_score: s.base_score,
            late_penalty: s.late_penalty,
            review_penalty: s.review_penalty,
            review_count: s.review_count,
            early_bonus: s.early_bonus,
            bug_hunter_bonus: s.bug_hunter_bonus,
            final_score: s.final_score,
            adjustment: s.adjustment,
            adjustment_reason: s.adjustment_reason
          })),
          submissions: taskSubmissions.map(s => ({
            student_id: userIdToStudentId.get(s.user_id) || '',
            submission_link: s.submission_link,
            note: s.note,
            submitted_at: s.submitted_at,
            submission_type: s.submission_type,
            file_path: s.file_path,
            file_name: s.file_name,
            file_size: s.file_size
          }))
        };
      }) || [];

      // Process messages
      const messagesForBackup: BackupMessage[] = messagesRes.data?.map(msg => ({
        student_id: userIdToStudentId.get(msg.user_id) || '',
        content: msg.content,
        source_type: msg.source_type,
        created_at: msg.created_at
      })) || [];

      // Process task notes
      const taskNotesForBackup: BackupTaskNote[] = taskNotesRes.data?.map(note => ({
        task_title: taskIdToTitle.get(note.task_id) || '',
        version_name: note.version_name,
        content: note.content,
        created_by_student_id: userIdToStudentId.get(note.created_by) || '',
        created_at: note.created_at,
        attachments: noteAttachmentsRes.data
          ?.filter(att => att.note_id === note.id)
          .map(att => ({
            file_name: att.file_name,
            file_size: att.file_size,
            original_path: att.file_path
          })) || []
      })) || [];

      // Process task comments
      const commentIdToIndex = new Map<string, number>();
      taskCommentsRes.data?.forEach((c, idx) => commentIdToIndex.set(c.id, idx));

      const taskCommentsForBackup: BackupTaskComment[] = taskCommentsRes.data?.map(comment => ({
        task_title: taskIdToTitle.get(comment.task_id) || '',
        student_id: userIdToStudentId.get(comment.user_id) || '',
        content: comment.content,
        parent_index: comment.parent_id ? commentIdToIndex.get(comment.parent_id) ?? null : null,
        created_at: comment.created_at
      })) || [];

      // Process resource folders
      const folderIdToName = new Map<string, string>();
      resourceFoldersRes.data?.forEach(f => folderIdToName.set(f.id, f.name));

      const resourceFoldersForBackup: BackupResourceFolder[] = resourceFoldersRes.data?.map(folder => ({
        name: folder.name,
        description: folder.description,
        created_by_student_id: userIdToStudentId.get(folder.created_by) || '',
        created_at: folder.created_at
      })) || [];

      // Process resources
      const resourcesForBackup: BackupResource[] = resourcesRes.data?.map(res => ({
        name: res.name,
        description: res.description,
        file_path: res.file_path,
        file_size: res.file_size,
        file_type: res.file_type,
        category: res.category,
        folder_name: res.folder_id ? folderIdToName.get(res.folder_id) || null : null,
        uploaded_by_student_id: userIdToStudentId.get(res.uploaded_by) || '',
        created_at: res.created_at,
        resource_type: res.resource_type || 'file',
        link_url: res.link_url || null,
        order_index: res.order_index ?? 0,
      })) || [];

      // Process activity logs
      const activityLogsForBackup: BackupActivityLog[] = activityLogsRes.data?.map(log => ({
        action: log.action,
        action_type: log.action_type,
        description: log.description,
        user_name: log.user_name,
        student_id: userIdToStudentId.get(log.user_id) || '',
        created_at: log.created_at,
        metadata: log.metadata
      })) || [];

      // Process stage weights
      const stageWeightsForBackup: BackupStageWeight[] = stageWeightsRes.data?.map(sw => ({
        stage_name: stagesMap.get(sw.stage_id) || '',
        weight: sw.weight
      })) || [];

      // Process member stage scores
      const memberStageScoresForBackup: BackupMemberStageScore[] = memberStageScoresRes.data?.map(mss => ({
        student_id: userIdToStudentId.get(mss.user_id) || '',
        stage_name: stagesMap.get(mss.stage_id) || '',
        average_score: mss.average_score,
        k_coefficient: mss.k_coefficient,
        adjusted_score: mss.adjusted_score,
        final_stage_score: mss.final_stage_score,
        late_task_count: mss.late_task_count,
        early_submission_bonus: mss.early_submission_bonus,
        bug_hunter_bonus: mss.bug_hunter_bonus
      })) || [];

      // Process member final scores
      const memberFinalScoresForBackup: BackupMemberFinalScore[] = memberFinalScoresRes.data?.map(mfs => ({
        student_id: userIdToStudentId.get(mfs.user_id) || '',
        weighted_average: mfs.weighted_average,
        adjustment: mfs.adjustment,
        final_score: mfs.final_score
      })) || [];

      // Process score appeals
      const taskScoreIdToTaskTitle = new Map<string, string>();
      const stageScoreIdToStageName = new Map<string, string>();
      scoresRes.data?.forEach(s => {
        const taskTitle = taskIdToTitle.get(s.task_id);
        if (taskTitle) taskScoreIdToTaskTitle.set(s.id, taskTitle);
      });
      memberStageScoresRes.data?.forEach(s => {
        const stageName = stagesMap.get(s.stage_id);
        if (stageName) stageScoreIdToStageName.set(s.id, stageName);
      });

      const scoreAppealsForBackup: BackupScoreAppeal[] = scoreAppealsRes.data?.map(appeal => ({
        student_id: userIdToStudentId.get(appeal.user_id) || '',
        task_title: appeal.task_score_id ? taskScoreIdToTaskTitle.get(appeal.task_score_id) || null : null,
        stage_name: appeal.stage_score_id ? stageScoreIdToStageName.get(appeal.stage_score_id) || null : null,
        reason: appeal.reason,
        status: appeal.status,
        reviewer_student_id: appeal.reviewer_id ? userIdToStudentId.get(appeal.reviewer_id) || null : null,
        reviewer_response: appeal.reviewer_response,
        created_at: appeal.created_at
      })) || [];

      setExportProgress(55);

      // Create ZIP file
      const zip = new JSZip();
      const fileMapping: FileSubmission[] = [];

      // Download and add files to ZIP
      if (uniqueFiles.length > 0) {
        const filesFolder = zip.folder('files');
        let filesProcessed = 0;
        
        for (const file of uniqueFiles) {
          try {
            const { data } = supabase.storage
              .from(file.bucket)
              .getPublicUrl(file.path);
            
            if (data?.publicUrl) {
              const response = await fetch(data.publicUrl);
              if (response.ok) {
                const blob = await response.blob();
                const safeFileName = `${file.bucket}_${file.path.replace(/\//g, '_')}`;
                const zipPath = `files/${safeFileName}`;
                filesFolder?.file(safeFileName, blob);
                fileMapping.push({
                  original_path: file.path,
                  file_name: file.name,
                  file_size: file.size,
                  zip_path: zipPath,
                  bucket: file.bucket
                });
              }
            }
          } catch (err) {
            console.warn(`Could not download file: ${file.path}`, err);
          }
          
          filesProcessed++;
          setExportProgress(55 + Math.round((filesProcessed / uniqueFiles.length) * 30));
        }
      }

      setExportProgress(90);

      const backupData: BackupData = {
        version: '4.0', // Updated version for full feature support
        exported_at: new Date().toISOString(),
        project_name: group.name,
        group: {
          name: group.name,
          description: group.description,
          class_code: group.class_code,
          instructor_name: group.instructor_name,
          instructor_email: group.instructor_email,
          additional_info: group.additional_info,
          zalo_link: group.zalo_link,
          leader_id: null,
          created_by: group.created_by,
          created_at: group.created_at,
          updated_at: group.updated_at,
          image_url: group.image_url,
          is_public: group.is_public,
          share_token: null, // Don't copy share token
          show_activity_public: group.show_activity_public,
          show_members_public: group.show_members_public,
          show_resources_public: group.show_resources_public
        },
        members: membersWithProfiles,
        stages: stagesRes.data?.map(s => ({
          name: s.name,
          description: s.description,
          order_index: s.order_index,
          start_date: s.start_date,
          end_date: s.end_date,
          weight: s.weight,
          is_hidden: s.is_hidden
        })) || [],
        tasks: tasksWithDetails,
        messages: exportOptions.includeMessages ? messagesForBackup : undefined,
        task_notes: exportOptions.includeTaskNotes ? taskNotesForBackup : undefined,
        task_comments: exportOptions.includeTaskComments ? taskCommentsForBackup : undefined,
        resources: exportOptions.includeResources ? resourcesForBackup : undefined,
        resource_folders: exportOptions.includeResources ? resourceFoldersForBackup : undefined,
        activity_logs: exportOptions.includeActivityLogs ? activityLogsForBackup : undefined,
        stage_weights: exportOptions.includeScores ? stageWeightsForBackup : undefined,
        member_stage_scores: exportOptions.includeScores ? memberStageScoresForBackup : undefined,
        member_final_scores: exportOptions.includeScores ? memberFinalScoresForBackup : undefined,
        score_appeals: exportOptions.includeScores ? scoreAppealsForBackup : undefined,
        files: fileMapping
      };

      zip.file('backup.json', JSON.stringify(backupData, null, 2));

      setExportProgress(92);

      // Generate evidence PDF and add to ZIP
      try {
        // Prepare data for evidence PDF (use 'any' to avoid type conflicts with partial profile data)
        const membersFull = membersRes.data?.map(m => {
          const profile = profilesData?.find(p => p.id === m.user_id);
          return {
            ...m,
            profiles: profile
          };
        }) || [];

        const tasksFull = tasksRes.data?.map(task => {
          const taskAssignments = assignmentsRes.data?.filter(a => a.task_id === task.id) || [];
          const assigneeProfilesLocal = taskAssignments.map(a => {
            const prof = profilesData?.find(p => p.id === a.user_id);
            return { ...a, profiles: prof };
          });
          return {
            ...task,
            task_assignments: assigneeProfilesLocal
          };
        }) || [];

        const evidenceOptions: EvidenceExportOptions = {
          includeMembers: true,
          includeTasks: true,
          includeScores: exportOptions.includeScores,
          includeResources: exportOptions.includeResources,
          includeLogs: exportOptions.includeActivityLogs,
        };

        const evidenceData: EvidenceExportData = {
          project: group as any,
          members: membersFull as any,
          stages: (stagesRes.data || []) as any,
          tasks: tasksFull as any,
          taskScores: scoresRes.data || [],
          stageScores: memberStageScoresRes.data || [],
          finalScores: memberFinalScoresRes.data || [],
          scoreAppeals: scoreAppealsRes.data || [],
          resources: resourcesRes.data || [],
          activityLogs: activityLogsRes.data || [],
          options: evidenceOptions,
        };

        const { blob: pdfBlob, fileName: pdfFileName } = await generateProjectEvidencePdfBlob(evidenceData);
        zip.file(pdfFileName, pdfBlob);
        
        console.log('Evidence PDF added to backup:', pdfFileName);
      } catch (pdfError) {
        console.warn('Could not generate evidence PDF:', pdfError);
        // Continue without PDF - not critical
      }

      setExportProgress(95);

      const blob = await zip.generateAsync({ type: 'blob' });
      const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);

      const stats = [
        `${fileMapping.length} file`,
        exportOptions.includeMessages ? `${messagesForBackup.length} tin nhắn` : null,
        exportOptions.includeTaskNotes ? `${taskNotesForBackup.length} ghi chú` : null,
        exportOptions.includeTaskComments ? `${taskCommentsForBackup.length} bình luận` : null,
        exportOptions.includeResources ? `${resourcesForBackup.length} tài nguyên` : null,
        '+ PDF minh chứng',
      ].filter(Boolean).join(', ');

      toast({ 
        title: 'Xuất thành công!', 
        description: `Đã sao lưu project "${group.name}" với ${stats}.` 
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Lỗi xuất dữ liệu', description: String(error), variant: 'destructive' });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const importProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress('Đang đọc file...');

    try {
      const zip = await JSZip.loadAsync(file);
      const backupFile = zip.file('backup.json');
      if (!backupFile) {
        throw new Error('File backup.json không tồn tại trong tệp ZIP');
      }

      const content = await backupFile.async('string');
      const backupData: BackupData = JSON.parse(content);

      if (!backupData.version || !backupData.group) {
        throw new Error('Định dạng file backup không hợp lệ');
      }

      setImportProgress('Đang tạo project mới...');

      // Create new group
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: `${backupData.group.name} (Bản sao)`,
          description: backupData.group.description,
          class_code: backupData.group.class_code,
          instructor_name: backupData.group.instructor_name,
          instructor_email: backupData.group.instructor_email,
          additional_info: backupData.group.additional_info,
          zalo_link: backupData.group.zalo_link,
          image_url: backupData.group.image_url || null,
          leader_id: user!.id,
          created_by: user!.id,
          is_public: false, // Default to private
          show_activity_public: backupData.group.show_activity_public,
          show_members_public: backupData.group.show_members_public,
          show_resources_public: backupData.group.show_resources_public,
          slug: '',
        })
        .select()
        .single();

      if (groupError || !newGroup) throw groupError || new Error('Không thể tạo project');
      
      const newGroupId = newGroup.id;

      setImportProgress('Đang thêm thành viên...');

      // Map student_id to user_id
      const studentIds = backupData.members.map(m => m.profile.student_id);
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, student_id')
        .in('student_id', studentIds);

      const studentIdToUserId = new Map<string, string>();
      existingProfiles?.forEach(p => studentIdToUserId.set(p.student_id, p.id));

      // Add current admin as leader
      await supabase
        .from('group_members')
        .insert({
          group_id: newGroupId,
          user_id: user!.id,
          role: 'leader'
        });

      // Add existing members
      const memberInserts = backupData.members
        .filter(m => studentIdToUserId.has(m.profile.student_id) && studentIdToUserId.get(m.profile.student_id) !== user!.id)
        .map(m => ({
          group_id: newGroupId,
          user_id: studentIdToUserId.get(m.profile.student_id)!,
          role: m.role as 'admin' | 'leader' | 'member'
        }));

      if (memberInserts.length > 0) {
        await supabase.from('group_members').insert(memberInserts);
      }

      setImportProgress('Đang khôi phục file đính kèm...');

      // Upload files and create path mapping
      const oldToNewPath = new Map<string, { path: string; bucket: string }>();
      
      const generateSafeStorageName = (originalName: string): string => {
        const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
        const uuid = crypto.randomUUID();
        return `${uuid}.${ext}`;
      };
      
      if (backupData.files && backupData.files.length > 0) {
        for (const fileInfo of backupData.files) {
          try {
            const zipPath = fileInfo.zip_path.replace('files/', '');
            const fileContent = await zip.file(`files/${zipPath}`)?.async('blob');
            
            if (fileContent) {
              const safeStorageName = generateSafeStorageName(fileInfo.file_name);
              const bucket = fileInfo.bucket || 'task-submissions';
              const newPath = `${user!.id}/${newGroupId}/${safeStorageName}`;
              
              const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(newPath, fileContent);
              
              if (!uploadError) {
                oldToNewPath.set(`${bucket}/${fileInfo.original_path}`, { path: newPath, bucket });
                // Also store without bucket prefix for backward compatibility
                oldToNewPath.set(fileInfo.original_path, { path: newPath, bucket });
              }
            }
          } catch (err) {
            console.warn(`Could not restore file: ${fileInfo.file_name}`, err);
          }
        }
      }

      setImportProgress('Đang tạo các giai đoạn...');

      // Create stages
      const stageNameToId = new Map<string, string>();
      for (const stage of backupData.stages) {
        const newStageId = generateNewId();
        await supabase
          .from('stages')
          .insert({
            id: newStageId,
            group_id: newGroupId,
            name: stage.name,
            description: stage.description,
            order_index: stage.order_index,
            start_date: stage.start_date,
            end_date: stage.end_date,
            weight: stage.weight,
            is_hidden: stage.is_hidden
          });
        stageNameToId.set(stage.name, newStageId);
      }

      setImportProgress('Đang khôi phục các task...');

      // Helper function to update file paths
      const updateFilePaths = (submissionLink: string | null): string | null => {
        if (!submissionLink) return null;
        try {
          const parsed = JSON.parse(submissionLink);
          if (Array.isArray(parsed)) {
            const updated = parsed.map(item => {
              if (item.file_path) {
                const newPathInfo = oldToNewPath.get(item.file_path);
                if (newPathInfo) {
                  return { ...item, file_path: newPathInfo.path };
                }
              }
              return item;
            });
            return JSON.stringify(updated);
          }
        } catch {
          return submissionLink;
        }
        return submissionLink;
      };

      // Create tasks
      const taskTitleToId = new Map<string, string>();
      for (const task of backupData.tasks) {
        const { data: newTask } = await supabase
          .from('tasks')
          .insert({
            group_id: newGroupId,
            stage_id: task.stage_name ? stageNameToId.get(task.stage_name) || null : null,
            title: task.title,
            description: task.description,
            status: task.status as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'VERIFIED',
            deadline: task.deadline,
            extended_deadline: task.extended_deadline,
            submission_link: updateFilePaths(task.submission_link),
            max_file_size: task.max_file_size,
            is_hidden: task.is_hidden,
            created_by: user!.id,
            slug: '',
          })
          .select()
          .single();
        
        const newTaskId = newTask?.id;
        if (!newTaskId) continue;

        taskTitleToId.set(task.title, newTaskId);

        // Create task assignments
        const assignmentInserts = task.assignments
          .filter(a => studentIdToUserId.has(a.student_id))
          .map(a => ({
            task_id: newTaskId,
            user_id: studentIdToUserId.get(a.student_id)!
          }));

        if (assignmentInserts.length > 0) {
          await supabase.from('task_assignments').insert(assignmentInserts);
        }

        // Create task scores
        const scoreInserts = task.scores
          .filter(s => studentIdToUserId.has(s.student_id))
          .map(s => ({
            task_id: newTaskId,
            user_id: studentIdToUserId.get(s.student_id)!,
            base_score: s.base_score,
            late_penalty: s.late_penalty,
            review_penalty: s.review_penalty,
            review_count: s.review_count,
            early_bonus: s.early_bonus,
            bug_hunter_bonus: s.bug_hunter_bonus,
            final_score: s.final_score,
            adjustment: s.adjustment,
            adjustment_reason: s.adjustment_reason
          }));

        if (scoreInserts.length > 0) {
          await supabase.from('task_scores').insert(scoreInserts);
        }

        // Create submission history
        const submissionInserts = task.submissions
          .filter(s => studentIdToUserId.has(s.student_id))
          .map(s => {
            const newPathInfo = s.file_path ? oldToNewPath.get(s.file_path) : null;
            
            return {
              task_id: newTaskId,
              user_id: studentIdToUserId.get(s.student_id)!,
              submission_link: updateFilePaths(s.submission_link),
              note: s.note,
              submitted_at: s.submitted_at,
              submission_type: s.submission_type || 'link',
              file_path: newPathInfo?.path || s.file_path,
              file_name: s.file_name,
              file_size: s.file_size
            };
          });

        if (submissionInserts.length > 0) {
          await supabase.from('submission_history').insert(submissionInserts);
        }
      }

      // Restore messages
      let messagesRestored = 0;
      if (backupData.messages && backupData.messages.length > 0) {
        setImportProgress('Đang khôi phục tin nhắn...');
        
        const messageInserts = backupData.messages
          .filter(msg => studentIdToUserId.has(msg.student_id))
          .map(msg => ({
            group_id: newGroupId,
            user_id: studentIdToUserId.get(msg.student_id)!,
            content: msg.content,
            source_type: msg.source_type || 'direct',
            created_at: msg.created_at
          }));

        if (messageInserts.length > 0) {
          const { error: msgError } = await supabase.from('project_messages').insert(messageInserts);
          if (!msgError) messagesRestored = messageInserts.length;
        }
      }

      // Restore task notes
      let notesRestored = 0;
      if (backupData.task_notes && backupData.task_notes.length > 0) {
        setImportProgress('Đang khôi phục ghi chú task...');
        
        for (const note of backupData.task_notes) {
          const taskId = taskTitleToId.get(note.task_title);
          const userId = studentIdToUserId.get(note.created_by_student_id);
          if (!taskId || !userId) continue;

          const { data: newNote } = await supabase
            .from('task_notes')
            .insert({
              task_id: taskId,
              version_name: note.version_name,
              content: note.content,
              created_by: userId,
              created_at: note.created_at
            })
            .select()
            .single();

          if (newNote && note.attachments.length > 0) {
            const attachmentInserts = note.attachments
              .map(att => {
                const newPathInfo = oldToNewPath.get(`task-note-attachments/${att.original_path}`) || 
                                   oldToNewPath.get(att.original_path);
                if (!newPathInfo) return null;
                return {
                  note_id: newNote.id,
                  file_name: att.file_name,
                  file_path: newPathInfo.path,
                  file_size: att.file_size,
                  storage_name: att.file_name
                };
              })
              .filter(Boolean);

            if (attachmentInserts.length > 0) {
              await supabase.from('task_note_attachments').insert(attachmentInserts);
            }
          }
          notesRestored++;
        }
      }

      // Restore task comments
      let commentsRestored = 0;
      if (backupData.task_comments && backupData.task_comments.length > 0) {
        setImportProgress('Đang khôi phục bình luận task...');
        
        const commentIndexToId = new Map<number, string>();
        
        for (let i = 0; i < backupData.task_comments.length; i++) {
          const comment = backupData.task_comments[i];
          const taskId = taskTitleToId.get(comment.task_title);
          const userId = studentIdToUserId.get(comment.student_id);
          if (!taskId || !userId) continue;

          const parentId = comment.parent_index !== null ? commentIndexToId.get(comment.parent_index) || null : null;

          const { data: newComment } = await supabase
            .from('task_comments')
            .insert({
              task_id: taskId,
              user_id: userId,
              content: comment.content,
              parent_id: parentId,
              created_at: comment.created_at
            })
            .select()
            .single();

          if (newComment) {
            commentIndexToId.set(i, newComment.id);
            commentsRestored++;
          }
        }
      }

      // Restore resource folders
      const folderNameToId = new Map<string, string>();
      if (backupData.resource_folders && backupData.resource_folders.length > 0) {
        setImportProgress('Đang khôi phục thư mục tài nguyên...');
        
        for (const folder of backupData.resource_folders) {
          const userId = studentIdToUserId.get(folder.created_by_student_id) || user!.id;
          
          const { data: newFolder } = await supabase
            .from('resource_folders')
            .insert({
              group_id: newGroupId,
              name: folder.name,
              description: folder.description,
              created_by: userId,
              created_at: folder.created_at
            })
            .select()
            .single();

          if (newFolder) {
            folderNameToId.set(folder.name, newFolder.id);
          }
        }
      }

      // Restore resources
      let resourcesRestored = 0;
      if (backupData.resources && backupData.resources.length > 0) {
        setImportProgress('Đang khôi phục tài nguyên...');
        
        for (const resource of backupData.resources) {
          const userId = studentIdToUserId.get(resource.uploaded_by_student_id) || user!.id;
          const isLinkResource = resource.resource_type === 'link' || (!resource.file_path && resource.link_url);
          
          let filePath: string | null = null;
          
          if (isLinkResource) {
            // Link-type resources don't need file restoration
            filePath = null;
          } else if (resource.file_path) {
            const newPathInfo = oldToNewPath.get(`project-resources/${resource.file_path}`) || 
                               oldToNewPath.get(resource.file_path);
            if (!newPathInfo) continue; // Skip file resources without restored files
            filePath = newPathInfo.path;
          } else {
            continue; // Skip resources with no file and no link
          }

          const folderId = resource.folder_name ? folderNameToId.get(resource.folder_name) || null : null;

          await supabase
            .from('project_resources')
            .insert({
              group_id: newGroupId,
              name: resource.name,
              description: resource.description,
              file_path: filePath,
              file_size: resource.file_size || 0,
              file_type: resource.file_type,
              category: resource.category,
              folder_id: folderId,
              uploaded_by: userId,
              storage_name: resource.name,
              created_at: resource.created_at,
              resource_type: resource.resource_type || 'file',
              link_url: isLinkResource ? resource.link_url : null,
              order_index: resource.order_index ?? 0,
            });

          resourcesRestored++;
        }
      }

      // Restore stage weights
      if (backupData.stage_weights && backupData.stage_weights.length > 0) {
        setImportProgress('Đang khôi phục trọng số giai đoạn...');
        
        const weightInserts = backupData.stage_weights
          .filter(sw => stageNameToId.has(sw.stage_name))
          .map(sw => ({
            group_id: newGroupId,
            stage_id: stageNameToId.get(sw.stage_name)!,
            weight: sw.weight
          }));

        if (weightInserts.length > 0) {
          await supabase.from('stage_weights').insert(weightInserts);
        }
      }

      // Restore member stage scores
      if (backupData.member_stage_scores && backupData.member_stage_scores.length > 0) {
        setImportProgress('Đang khôi phục điểm giai đoạn...');
        
        const scoreInserts = backupData.member_stage_scores
          .filter(mss => studentIdToUserId.has(mss.student_id) && stageNameToId.has(mss.stage_name))
          .map(mss => ({
            user_id: studentIdToUserId.get(mss.student_id)!,
            stage_id: stageNameToId.get(mss.stage_name)!,
            average_score: mss.average_score,
            k_coefficient: mss.k_coefficient,
            adjusted_score: mss.adjusted_score,
            final_stage_score: mss.final_stage_score,
            late_task_count: mss.late_task_count,
            early_submission_bonus: mss.early_submission_bonus,
            bug_hunter_bonus: mss.bug_hunter_bonus
          }));

        if (scoreInserts.length > 0) {
          await supabase.from('member_stage_scores').insert(scoreInserts);
        }
      }

      // Restore member final scores
      if (backupData.member_final_scores && backupData.member_final_scores.length > 0) {
        setImportProgress('Đang khôi phục điểm tổng kết...');
        
        const scoreInserts = backupData.member_final_scores
          .filter(mfs => studentIdToUserId.has(mfs.student_id))
          .map(mfs => ({
            group_id: newGroupId,
            user_id: studentIdToUserId.get(mfs.student_id)!,
            weighted_average: mfs.weighted_average,
            adjustment: mfs.adjustment,
            final_score: mfs.final_score
          }));

        if (scoreInserts.length > 0) {
          await supabase.from('member_final_scores').insert(scoreInserts);
        }
      }

      setImportProgress('Hoàn tất!');

      const stats = [
        `${oldToNewPath.size} file`,
        messagesRestored > 0 ? `${messagesRestored} tin nhắn` : null,
        notesRestored > 0 ? `${notesRestored} ghi chú` : null,
        commentsRestored > 0 ? `${commentsRestored} bình luận` : null,
        resourcesRestored > 0 ? `${resourcesRestored} tài nguyên` : null,
      ].filter(Boolean).join(', ');

      toast({ 
        title: 'Khôi phục thành công!', 
        description: `Đã tạo bản sao project "${backupData.project_name}" với ${stats}.` 
      });

      fetchAllGroups();

    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Lỗi khôi phục', description: String(error), variant: 'destructive' });
    } finally {
      setIsImporting(false);
      setImportProgress('');
      event.target.value = '';
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <FolderArchive className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Sao lưu & Khôi phục
              <span className="text-xs font-normal text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full">Admin</span>
            </CardTitle>
            <CardDescription>Xuất và nhập toàn bộ dữ liệu project</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />
            Sao lưu Project
          </Label>
          
          {/* Project selector + Export button */}
          <div className="flex gap-3">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Chọn project để sao lưu..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={exportProject} 
              disabled={!selectedGroupId || isExporting}
              className="gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xuất...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Xuất toàn bộ
                </>
              )}
            </Button>
          </div>

          {/* Collapsible Filter Options */}
          <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3 h-3" />
                  Lọc nội dung ({selectedCount}/6)
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                <div className="flex gap-2 mb-2">
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAllOptions}>
                    Chọn tất cả
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={deselectAllOptions}>
                    Bỏ chọn
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="includeMessages" 
                      checked={exportOptions.includeMessages}
                      onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeMessages: !!checked }))}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor="includeMessages" className="text-xs flex items-center gap-1 cursor-pointer">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      Tin nhắn
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="includeTaskNotes" 
                      checked={exportOptions.includeTaskNotes}
                      onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeTaskNotes: !!checked }))}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor="includeTaskNotes" className="text-xs flex items-center gap-1 cursor-pointer">
                      <FileText className="w-3 h-3 text-muted-foreground" />
                      Ghi chú task
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="includeTaskComments" 
                      checked={exportOptions.includeTaskComments}
                      onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeTaskComments: !!checked }))}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor="includeTaskComments" className="text-xs flex items-center gap-1 cursor-pointer">
                      <MessageCircle className="w-3 h-3 text-muted-foreground" />
                      Bình luận
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="includeResources" 
                      checked={exportOptions.includeResources}
                      onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeResources: !!checked }))}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor="includeResources" className="text-xs flex items-center gap-1 cursor-pointer">
                      <FolderOpen className="w-3 h-3 text-muted-foreground" />
                      Tài nguyên
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="includeActivityLogs" 
                      checked={exportOptions.includeActivityLogs}
                      onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeActivityLogs: !!checked }))}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor="includeActivityLogs" className="text-xs flex items-center gap-1 cursor-pointer">
                      <History className="w-3 h-3 text-muted-foreground" />
                      Nhật ký
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="includeScores" 
                      checked={exportOptions.includeScores}
                      onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeScores: !!checked }))}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor="includeScores" className="text-xs flex items-center gap-1 cursor-pointer">
                      <Award className="w-3 h-3 text-muted-foreground" />
                      Điểm số
                    </label>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Progress bar */}
          {isExporting && exportProgress > 0 && (
            <div className="space-y-1">
              <Progress value={exportProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{exportProgress}%</p>
            </div>
          )}
        </div>

        <div className="border-t pt-6 space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Khôi phục Project
          </Label>
          <div className="flex items-center gap-3">
            <Input 
              type="file" 
              accept=".zip" 
              onChange={importProject}
              disabled={isImporting}
              className="flex-1"
            />
          </div>
          {isImporting && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              {importProgress}
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-medium mb-1">Lưu ý quan trọng:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Dữ liệu sẽ được khôi phục thành project mới với ID hoàn toàn mới</li>
                <li>Chỉ những thành viên đã tồn tại trong hệ thống mới được thêm vào</li>
                <li>Admin hiện tại sẽ trở thành Leader của project mới</li>
                <li>Project mới sẽ mặc định ở chế độ riêng tư</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-green-700 dark:text-green-400">
            <p className="font-medium mb-1">Tính năng hỗ trợ (v4.0):</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <Settings className="w-3 h-3" /> Thông tin project
              </span>
              <span className="flex items-center gap-1">
                <File className="w-3 h-3" /> File đính kèm
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Tin nhắn
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" /> Ghi chú task
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> Bình luận task
              </span>
              <span className="flex items-center gap-1">
                <FolderOpen className="w-3 h-3" /> Tài nguyên dự án
              </span>
              <span className="flex items-center gap-1">
                <History className="w-3 h-3" /> Nhật ký hoạt động
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3" /> Điểm số đầy đủ
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
