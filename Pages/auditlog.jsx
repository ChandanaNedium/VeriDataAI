import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  History, 
  Search, 
  Filter,
  Upload,
  CheckCircle,
  XCircle,
  Edit,
  Settings,
  FileOutput,
  Zap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const actionConfig = {
  upload: { label: 'Upload', icon: Upload, color: 'bg-blue-100 text-blue-700' },
  validation_run: { label: 'Validation', icon: Zap, color: 'bg-indigo-100 text-indigo-700' },
  record_approved: { label: 'Approved', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  record_rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-700' },
  record_edited: { label: 'Edited', icon: Edit, color: 'bg-amber-100 text-amber-700' },
  settings_changed: { label: 'Settings', icon: Settings, color: 'bg-purple-100 text-purple-700' },
  export: { label: 'Export', icon: FileOutput, color: 'bg-slate-100 text-slate-700' },
};

export default function AuditLog() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
  });

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!log.description?.toLowerCase().includes(searchLower) &&
          !log.user_email?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (actionFilter !== 'all' && log.action !== actionFilter) {
      return false;
    }
    return true;
  });

  const paginatedLogs = filteredLogs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  // Stats
  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.created_date);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  }).length;

  const actionCounts = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <History className="w-6 h-6 text-slate-500" />
          Audit Log
        </h1>
        <p className="text-slate-500 mt-1">
          Track all system activities and changes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Activities</p>
            <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Today</p>
            <p className="text-2xl font-bold text-indigo-600">{todayLogs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Validations Run</p>
            <p className="text-2xl font-bold text-emerald-600">{actionCounts.validation_run || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Records Reviewed</p>
            <p className="text-2xl font-bold text-amber-600">
              {(actionCounts.record_approved || 0) + (actionCounts.record_rejected || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by description or user..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(actionConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-[180px]">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <div className="h-10 bg-slate-100 rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map(log => {
                  const config = actionConfig[log.action] || actionConfig.validation_run;
                  const Icon = config.icon;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge className={cn("border-0 flex items-center gap-1 w-fit", config.color)}>
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[400px]">
                        <p className="truncate">{log.description}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                            {log.user_email?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm">{log.user_email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {format(new Date(log.created_date), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, filteredLogs.length)} of {filteredLogs.length}
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
