import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  AlertTriangle, 
  Filter, 
  Search,
  Phone,
  MapPin,
  FileText,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProviderCard from '@/components/providers/ProviderCard';
import { cn } from '@/lib/utils';

const issueTypes = [
  { id: 'phone', label: 'Phone Issues', icon: Phone, field: 'phone' },
  { id: 'address', label: 'Address Issues', icon: MapPin, field: 'address' },
  { id: 'license', label: 'License Issues', icon: FileText, field: 'license' },
  { id: 'low_confidence', label: 'Low Confidence', icon: TrendingDown, field: null },
];

export default function FlaggedRecords() {
  const [search, setSearch] = useState('');
  const [issueFilter, setIssueFilter] = useState('all');
  const [sortBy, setSortBy] = useState('confidence');

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['flagged-providers'],
    queryFn: () => base44.entities.Provider.filter({ status: 'flagged' }, '-created_date', 500),
  });

  // Filter providers
  const filteredProviders = providers.filter(provider => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (!provider.name?.toLowerCase().includes(searchLower) &&
          !provider.phone?.toLowerCase().includes(searchLower) &&
          !provider.email?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Issue type filter
    if (issueFilter !== 'all') {
      const issue = issueTypes.find(i => i.id === issueFilter);
      if (issue) {
        if (issue.id === 'low_confidence') {
          return provider.confidence_score < 50;
        }
        return provider.validation_results?.[issue.field] === false;
      }
    }

    return true;
  });

  // Sort providers
  const sortedProviders = [...filteredProviders].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return (a.confidence_score || 0) - (b.confidence_score || 0);
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'date':
        return new Date(b.created_date) - new Date(a.created_date);
      default:
        return 0;
    }
  });

  // Count issues by type
  const issueCounts = {
    all: providers.length,
    phone: providers.filter(p => p.validation_results?.phone === false).length,
    address: providers.filter(p => p.validation_results?.address === false).length,
    license: providers.filter(p => p.validation_results?.license === false).length,
    low_confidence: providers.filter(p => p.confidence_score < 50).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Flagged Records
          </h1>
          <p className="text-slate-500 mt-1">
            {providers.length} records require human review
          </p>
        </div>
        <Link to={createPageUrl('ReviewApprove')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            Start Review
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Issue Type Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={issueFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIssueFilter('all')}
          className={issueFilter === 'all' ? 'bg-indigo-600' : ''}
        >
          All Issues
          <Badge variant="secondary" className="ml-2 bg-white/20">{issueCounts.all}</Badge>
        </Button>
        {issueTypes.map(issue => (
          <Button
            key={issue.id}
            variant={issueFilter === issue.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIssueFilter(issue.id)}
            className={issueFilter === issue.id ? 'bg-indigo-600' : ''}
          >
            <issue.icon className="w-4 h-4 mr-1" />
            {issue.label}
            <Badge variant="secondary" className="ml-2 bg-white/20">{issueCounts[issue.id]}</Badge>
          </Button>
        ))}
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confidence">Lowest Confidence</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="date">Most Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Provider Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sortedProviders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Flagged Records</h3>
          <p className="text-slate-500">
            {search || issueFilter !== 'all' 
              ? 'No records match your filters' 
              : 'All records have passed validation!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedProviders.map(provider => (
            <Link 
              key={provider.id} 
              to={createPageUrl(`ReviewApprove?providerId=${provider.id}`)}
            >
              <ProviderCard 
                provider={provider} 
                showDetails={true}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
