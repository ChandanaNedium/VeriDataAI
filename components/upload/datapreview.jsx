import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const requiredFields = ['name', 'phone', 'address', 'city', 'state', 'zip'];
const optionalFields = ['npi', 'email', 'website', 'license_number', 'specialty', 'organization'];

export default function DataPreview({ data, validationErrors }) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const missingRequired = requiredFields.filter(f => !columns.map(c => c.toLowerCase()).includes(f.toLowerCase()));
  const hasAllRequired = missingRequired.length === 0;

  return (
    <div className="space-y-4">
      {/* Validation Summary */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-slate-900">File Validation</h4>
          {hasAllRequired ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-0">
              <CheckCircle className="w-3 h-3 mr-1" />
              Valid Format
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-700 border-0">
              <XCircle className="w-3 h-3 mr-1" />
              Missing Fields
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Required Fields</p>
            <div className="flex flex-wrap gap-2">
              {requiredFields.map(field => {
                const found = columns.map(c => c.toLowerCase()).includes(field.toLowerCase());
                return (
                  <Badge 
                    key={field}
                    variant="outline"
                    className={cn(
                      "text-xs",
                      found ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {found ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {field}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Optional Fields Found</p>
            <div className="flex flex-wrap gap-2">
              {optionalFields.filter(f => columns.map(c => c.toLowerCase()).includes(f.toLowerCase())).map(field => (
                <Badge key={field} variant="outline" className="text-xs border-slate-200">
                  {field}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {!hasAllRequired && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Missing required fields</p>
                <p className="text-sm text-red-600 mt-1">
                  Please ensure your file contains: {missingRequired.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h4 className="font-semibold text-slate-900">Data Preview</h4>
          <p className="text-sm text-slate-500">Showing first {Math.min(data.length, 5)} of {data.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {columns.slice(0, 8).map(col => (
                  <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                ))}
                {columns.length > 8 && (
                  <TableHead className="text-slate-400">+{columns.length - 8} more</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 5).map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="text-slate-400">{index + 1}</TableCell>
                  {columns.slice(0, 8).map(col => (
                    <TableCell key={col} className="max-w-[200px] truncate">
                      {row[col] || <span className="text-slate-300">—</span>}
                    </TableCell>
                  ))}
                  {columns.length > 8 && <TableCell />}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
