import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  ArrowRight,
  Eye,
  Filter,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function DirectoryOutput() {
  const [user, setUser] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cleaned');

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['all-providers'],
    queryFn: () => base44.entities.Provider.list('-created_date', 1000),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.ValidationBatch.list('-created_date', 50),
  });

  // Filter by source and only show approved/validated
  const cleanedProviders = providers.filter(p => {
    const isClean = p.status === 'approved' || p.status === 'validated';
    if (sourceFilter === 'all') return isClean;
    return isClean && p.source === sourceFilter;
  });

  // Calculate before vs after stats
  const totalOriginal = providers.length;
  const totalCleaned = cleanedProviders.length;
  const avgConfidenceAfter = cleanedProviders.length > 0
    ? Math.round(cleanedProviders.reduce((sum, p) => sum + (p.confidence_score || 0), 0) / cleanedProviders.length)
    : 0;

  const exportToCSV = () => {
    const headers = ['NPI', 'Name', 'Specialty', 'Organization', 'Phone', 'Email', 'Website', 'Address', 'City', 'State', 'ZIP', 'License Number', 'Confidence Score'];
    const rows = cleanedProviders.map(p => [
      p.npi, p.name, p.specialty, p.organization, p.phone, p.email, p.website, p.address, p.city, p.state, p.zip, p.license_number, p.confidence_score
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleaned_provider_directory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    // Log export
    base44.entities.AuditLog.create({
      action: 'export',
      description: `Exported ${cleanedProviders.length} cleaned provider records`,
      user_email: user?.email,
      user_role: user?.role
    });
  };

  const getChangedFields = (provider) => {
    if (!provider.original_data || !provider.ai_suggestions) return [];
    const changes = [];
    const original = provider.original_data;
    
    ['phone', 'email', 'address', 'city', 'state', 'zip'].forEach(field => {
      if (original[field] !== provider[field] && provider[field]) {
        changes.push({
          field,
          before: original[field] || '(empty)',
          after: provider[field]
        });
      }
    });
    
    return changes;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-500" />
            Directory Output
          </h1>
          <p className="text-slate-500 mt-1">
            Export your cleaned and validated provider directory
          </p>
        </div>
        <Button onClick={exportToCSV} className="bg-indigo-600 hover:bg-indigo-700">
          <Download className="w-4 h-4 mr-2" />
          Export Cleaned Data
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Original Records</p>
                <p className="text-2xl font-bold text-slate-900">{totalOriginal}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Cleaned Records</p>
                <p className="text-2xl font-bold text-emerald-600">{totalCleaned}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg. Confidence</p>
                <p className="text-2xl font-bold text-indigo-600">{avgConfidenceAfter}%</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Records Improved</p>
                <p className="text-2xl font-bold text-amber-600">
                  {providers.filter(p => p.ai_suggestions && Object.keys(p.ai_suggestions).length > 0).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="web">Web Directory</SelectItem>
              <SelectItem value="mobile">Mobile Directory</SelectItem>
              <SelectItem value="print">Print Directory</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data View */}
      <Tabs defaultValue="cleaned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cleaned">Cleaned Data</TabsTrigger>
          <TabsTrigger value="changes">Before vs After</TabsTrigger>
        </TabsList>

        <TabsContent value="cleaned">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-slate-400" />
                Cleaned Provider Directory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanedProviders.slice(0, 20).map(provider => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.name}</TableCell>
                        <TableCell>{provider.phone}</TableCell>
                        <TableCell>{provider.email}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {provider.address}, {provider.city}, {provider.state} {provider.zip}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "border-0",
                            provider.confidence_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                            provider.confidence_score >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          )}>
                            {provider.confidence_score}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{provider.source}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {cleanedProviders.length > 20 && (
                <p className="text-center text-sm text-slate-500 mt-4">
                  Showing 20 of {cleanedProviders.length} records. Export to see all.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-slate-400" />
                Before vs After Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cleanedProviders.filter(p => getChangedFields(p).length > 0).slice(0, 10).map(provider => (
                  <div key={provider.id} className="p-4 bg-slate-50 rounded-xl">
                    <p className="font-medium text-slate-900 mb-3">{provider.name}</p>
                    <div className="space-y-2">
                      {getChangedFields(provider).map((change, idx) => (
                        <div key={idx} className="flex items-center gap-4 text-sm">
                          <span className="w-20 text-slate-500 capitalize">{change.field}:</span>
                          <span className="text-red-600 line-through">{change.before}</span>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                          <span className="text-emerald-600 font-medium">{change.after}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {cleanedProviders.filter(p => getChangedFields(p).length > 0).length === 0 && (
                  <p className="text-center text-slate-500 py-8">
                    No changes detected in the cleaned records
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
