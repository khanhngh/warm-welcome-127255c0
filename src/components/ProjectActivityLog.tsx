import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import ActivityLogFilters, { ActivityFilters } from '@/components/ActivityLogFilters';
import { exportActivityLogToPdf } from '@/lib/activityLogPdf';
import { 
  Activity, 
  UserPlus, 
  UserMinus, 
  Edit, 
  Trash2, 
  Plus, 
  CheckCircle,
  AlertCircle,
  Layers,
  FileText,
  Clock,
  Download,
  List,
  LayoutGrid,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  action_type: string;
  description: string | null;
  created_at: string;
  metadata: any;
  avatar_url?: string;
}

interface ProjectActivityLogProps {
  groupId: string;
  groupName?: string;
}

const DEFAULT_FILTERS: ActivityFilters = {
  searchText: '',
  actionType: 'all',
  action: 'all',
  userId: 'all',
  dateFrom: undefined,
  dateTo: undefined,
};

export default function ProjectActivityLog({ groupId, groupName = 'Project' }: ProjectActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [groupId]);

  const fetchLogs = async () => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (data) {
        const userIds = [...new Set(data.map(log => log.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', userIds);

        const avatarMap = new Map(profiles?.map(p => [p.id, p.avatar_url]) || []);
        
        const logsWithAvatars = data.map(log => ({
          ...log,
          avatar_url: avatarMap.get(log.user_id) || null
        }));
        
        setLogs(logsWithAvatars as ActivityLog[]);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const userMap = new Map<string, string>();
    logs.forEach(log => {
      if (!userMap.has(log.user_id)) {
        userMap.set(log.user_id, log.user_name.split('@')[0]);
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search text
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matchesSearch = 
          log.user_name.toLowerCase().includes(searchLower) ||
          log.action.toLowerCase().includes(searchLower) ||
          (log.description?.toLowerCase().includes(searchLower) || false);
        if (!matchesSearch) return false;
      }

      // Action type
      if (filters.actionType !== 'all' && log.action_type !== filters.actionType) {
        return false;
      }

      // Action
      if (filters.action !== 'all' && !log.action.includes(filters.action)) {
        return false;
      }

      // User
      if (filters.userId !== 'all' && log.user_id !== filters.userId) {
        return false;
      }

      // Date from
      if (filters.dateFrom) {
        const logDate = new Date(log.created_at);
        logDate.setHours(0, 0, 0, 0);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (logDate < fromDate) return false;
      }

      // Date to
      if (filters.dateTo) {
        const logDate = new Date(log.created_at);
        logDate.setHours(23, 59, 59, 999);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (logDate > toDate) return false;
      }

      return true;
    });
  }, [logs, filters]);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportActivityLogToPdf({
        projectName: groupName,
        logs: filteredLogs,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ADD_MEMBER':
      case 'CREATE_AND_ADD_MEMBER':
        return <UserPlus className="w-4 h-4 text-success" />;
      case 'REMOVE_MEMBER':
        return <UserMinus className="w-4 h-4 text-destructive" />;
      case 'UPDATE_MEMBER':
        return <Edit className="w-4 h-4 text-warning" />;
      case 'CREATE_STAGE':
        return <Plus className="w-4 h-4 text-primary" />;
      case 'UPDATE_STAGE':
        return <Layers className="w-4 h-4 text-warning" />;
      case 'DELETE_STAGE':
        return <Trash2 className="w-4 h-4 text-destructive" />;
      case 'CREATE_TASK':
        return <Plus className="w-4 h-4 text-primary" />;
      case 'UPDATE_TASK':
        return <FileText className="w-4 h-4 text-warning" />;
      case 'DELETE_TASK':
        return <Trash2 className="w-4 h-4 text-destructive" />;
      case 'SUBMISSION':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'LATE_SUBMISSION':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'member':
        return <Badge variant="secondary" className="text-xs">Thành viên</Badge>;
      case 'stage':
        return <Badge className="bg-primary/10 text-primary text-xs">Giai đoạn</Badge>;
      case 'task':
        return <Badge className="bg-warning/10 text-warning text-xs">Task</Badge>;
      case 'resource':
        return <Badge className="bg-success/10 text-success text-xs">Tài nguyên</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{actionType}</Badge>;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Đang tải nhật ký hoạt động...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Nhật ký hoạt động
            <Badge variant="outline" className="ml-2">
              {filteredLogs.length} / {logs.length}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className="rounded-r-none"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Export PDF button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPdf}
              disabled={isExporting || filteredLogs.length === 0}
              className="gap-2"
            >
              <FileDown className="w-4 h-4" />
              Xuất PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Filters */}
        <ActivityLogFilters
          filters={filters}
          onFiltersChange={setFilters}
          users={uniqueUsers}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Không tìm thấy hoạt động nào</p>
          </div>
        ) : viewMode === 'timeline' ? (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {filteredLogs.map((log, index) => (
                <div key={log.id} className="relative flex gap-4">
                  {/* Index number */}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {index + 1}
                  </div>
                  
                  {/* Timeline line */}
                  {index < filteredLogs.length - 1 && (
                    <div className="absolute left-4 top-10 w-0.5 h-full bg-border" />
                  )}
                  
                  {/* Avatar */}
                  <UserAvatar 
                    src={log.avatar_url}
                    name={log.user_name.split('@')[0]}
                    size="md"
                    className="border-2 border-background z-10 flex-shrink-0"
                  />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="font-medium text-sm">{log.user_name.split('@')[0]}</span>
                      </div>
                      {getActionBadge(log.action_type)}
                    </div>
                    
                    {log.description && (
                      <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs text-muted-foreground">
                        {formatTime(log.created_at)}
                      </p>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">STT</TableHead>
                  <TableHead className="w-[100px]">Ngày</TableHead>
                  <TableHead className="w-[80px]">Giờ</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Mô tả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log, index) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{format(new Date(log.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(log.created_at), 'HH:mm:ss')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar 
                          src={log.avatar_url}
                          name={log.user_name.split('@')[0]}
                          size="sm"
                        />
                        <span className="text-sm">{log.user_name.split('@')[0]}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getActionIcon(log.action)}
                        <span className="text-sm">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.description || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
