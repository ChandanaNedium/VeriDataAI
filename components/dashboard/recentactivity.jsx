import React from 'react';
import { format } from 'date-fns';
import { Upload, CheckCircle, AlertTriangle, Edit, FileOutput, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const actionIcons = {
  upload: Upload,
  validation_run: CheckCircle,
  record_approved: CheckCircle,
  record_rejected: AlertTriangle,
  record_edited: Edit,
  settings_changed: Settings,
  export: FileOutput,
};

const actionColors = {
  upload: 'bg-blue-100 text-blue-600',
  validation_run: 'bg-indigo-100 text-indigo-600',
  record_approved: 'bg-emerald-100 text-emerald-600',
  record_rejected: 'bg-red-100 text-red-600',
  record_edited: 'bg-amber-100 text-amber-600',
  settings_changed: 'bg-purple-100 text-purple-600',
  export: 'bg-slate-100 text-slate-600',
};

export default function RecentActivity({ logs }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent Activity</h3>
      <div className="space-y-4">
        {logs.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No recent activity</p>
        ) : (
          logs.slice(0, 8).map((log) => {
            const Icon = actionIcons[log.action] || CheckCircle;
            return (
              <div key={log.id} className="flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  actionColors[log.action] || 'bg-slate-100 text-slate-600'
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 line-clamp-1">{log.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">{log.user_email}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(log.created_date), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
