import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700', icon: null },
  validated: { label: 'Validated', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  flagged: { label: 'Flagged', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function ProviderCard({ provider, onClick, showDetails = false }) {
  const status = statusConfig[provider.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const getFieldStatus = (field) => {
    if (!provider.validation_results) return null;
    return provider.validation_results[field];
  };

  const FieldIndicator = ({ field, children }) => {
    const valid = getFieldStatus(field);
    if (valid === null || valid === undefined) return children;
    return (
      <span className={cn(
        "flex items-center gap-1",
        valid === true ? "text-emerald-600" : valid === false ? "text-red-500" : "text-slate-600"
      )}>
        {children}
        {valid === true && <CheckCircle className="w-3 h-3" />}
        {valid === false && <XCircle className="w-3 h-3" />}
      </span>
    );
  };

  return (
    <div 
      className={cn(
        "bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-all",
        onClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-900 truncate">{provider.name}</h3>
            <Badge className={cn("border-0 flex items-center gap-1", status.color)}>
              {StatusIcon && <StatusIcon className="w-3 h-3" />}
              {status.label}
            </Badge>
          </div>
          {provider.specialty && (
            <p className="text-sm text-slate-500 mt-1">{provider.specialty}</p>
          )}
          {provider.organization && (
            <p className="text-sm text-slate-400">{provider.organization}</p>
          )}
        </div>
        <div className="text-right">
          <div className={cn(
            "text-2xl font-bold",
            provider.confidence_score >= 80 ? "text-emerald-600" :
            provider.confidence_score >= 60 ? "text-amber-600" : "text-red-600"
          )}>
            {provider.confidence_score || 0}%
          </div>
          <p className="text-xs text-slate-500">Confidence</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <FieldIndicator field="phone">
          <div className="flex items-center gap-2 text-slate-600">
            <Phone className="w-4 h-4 text-slate-400" />
            <span className="truncate">{provider.phone || '—'}</span>
          </div>
        </FieldIndicator>
        <FieldIndicator field="email">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="truncate">{provider.email || '—'}</span>
          </div>
        </FieldIndicator>
        <FieldIndicator field="website">
          <div className="flex items-center gap-2 text-slate-600">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="truncate">{provider.website || '—'}</span>
          </div>
        </FieldIndicator>
        <FieldIndicator field="address">
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="truncate">
              {provider.city && provider.state ? `${provider.city}, ${provider.state}` : '—'}
            </span>
          </div>
        </FieldIndicator>
      </div>

      {showDetails && provider.ai_suggestions && Object.keys(provider.ai_suggestions).length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            AI Suggestions
          </p>
          <div className="space-y-1">
            {Object.entries(provider.ai_suggestions).map(([field, value]) => (
              <div key={field} className="text-xs text-slate-600">
                <span className="font-medium capitalize">{field}:</span> {value}
              </div>
            ))}
          </div>
        </div>
      )}

      {onClick && (
        <div className="flex items-center justify-end mt-4 pt-4 border-t border-slate-100">
          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
            Review Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
