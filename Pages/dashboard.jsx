import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  GitCompare, 
  AlertTriangle, 
  CheckCircle,
  Monitor,
  Smartphone,
  FileText,
  ArrowRight,
  RefreshCw,
  Download,
  Sparkles,
  Check,
  Upload,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const sourceConfig = {
  web: { label: 'Web Directory', icon: Monitor, color: 'indigo' },
  mobile: { label: 'Mobile Directory', icon: Smartphone, color: 'purple' },
  print: { label: 'Print Directory', icon: FileText, color: 'amber' },
};

export default function ConsistencyChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResults, setCheckResults] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState({
    web: null,
    mobile: null,
    print: null
  });
  const [isUploading, setIsUploading] = useState({
    web: false,
    mobile: false,
    print: false
  });

  const queryClient = useQueryClient();

  const { data: providers = [], isLoading, refetch } = useQuery({
    queryKey: ['all-providers-consistency'],
    queryFn: () => base44.entities.Provider.list('-created_date', 1000),
  });

  // Group providers by NPI (primary) or normalized name (fallback) for comparison
  const groupedProviders = providers.reduce((acc, provider) => {
    // Use NPI as primary key, or name as fallback (normalized: lowercase, no spaces/punctuation)
    const key = provider.npi?.trim() || provider.name?.toLowerCase().replace(/[^a-z]/g, '');
    if (!key) return acc; // Skip if no valid identifier
    if (!acc[key]) acc[key] = [];
    acc[key].push(provider);
    return acc;
  }, {});

  // Find providers with entries in multiple sources
  const multiSourceProviders = Object.entries(groupedProviders)
    .filter(([_, group]) => {
      const sources = new Set(group.map(p => p.source).filter(Boolean));
      return sources.size > 1; // Must have at least 2 different sources
    })
    .map(([key, group]) => ({
      key,
      providers: group,
      sources: [...new Set(group.map(p => p.source).filter(Boolean))],
      name: group[0].name,
      npi: group[0].npi
    }));

  // Auto-resolve inconsistencies using AI logic
  const resolveFieldValue = async (field, providers) => {
    const webValue = providers.find(p => p.source === 'web')?.[field]?.trim();
    const mobileValue = providers.find(p => p.source === 'mobile')?.[field]?.trim();
    const printValue = providers.find(p => p.source === 'print')?.[field]?.trim();
    
    const values = [webValue, mobileValue, printValue].filter(Boolean);
    if (values.length === 0) return null;
    if (new Set(values).size === 1) return values[0]; // All same
    
    // Rule 1: Prefer web if valid and complete
    if (webValue && webValue.length > 5) {
      return webValue;
    }
    
    // Rule 2: Majority agreement
    const valueCounts = {};
    values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
    const majority = Object.entries(valueCounts).find(([_, count]) => count >= 2);
    if (majority) return majority[0];
    
    // Rule 3: Most complete
    const sorted = values.sort((a, b) => (b?.length || 0) - (a?.length || 0));
    return sorted[0];
  };

  const runConsistencyCheck = async () => {
    setIsChecking(true);
    
    const inconsistencies = [];
    const cleanedProviders = [];
    
    for (const { key, providers } of multiSourceProviders) {
      const inconsistentFields = [];
      const baseProvider = providers[0];
      const correctedFields = {};
      
      // Fields to compare
      const fieldsToCompare = ['phone', 'email', 'address', 'city', 'state', 'zip', 'website'];
      
      for (const field of fieldsToCompare) {
        const values = providers.map(p => ({ source: p.source, value: p[field]?.trim() })).filter(v => v.value);
        const uniqueValues = new Set(values.map(v => v.value?.toLowerCase()));
        
        if (uniqueValues.size > 1) {
          const resolvedValue = await resolveFieldValue(field, providers);
          inconsistentFields.push({
            field,
            values: providers.map(p => ({
              source: p.source,
              value: p[field] || '(empty)'
            })),
            correctedValue: resolvedValue
          });
          correctedFields[field] = resolvedValue;
        } else {
          correctedFields[field] = values[0]?.value || baseProvider[field];
        }
      }

      // Create cleaned provider record
      const cleanedProvider = {
        npi: baseProvider.npi,
        name: baseProvider.name,
        specialty: baseProvider.specialty,
        organization: baseProvider.organization,
        phone: correctedFields.phone || baseProvider.phone,
        email: correctedFields.email || baseProvider.email,
        website: correctedFields.website || baseProvider.website,
        address: correctedFields.address || baseProvider.address,
        city: correctedFields.city || baseProvider.city,
        state: correctedFields.state || baseProvider.state,
        zip: correctedFields.zip || baseProvider.zip,
        license_number: baseProvider.license_number,
        license_state: baseProvider.license_state,
        corrected_fields: Object.keys(correctedFields).filter(f => 
          correctedFields[f] !== providers[0][f] || inconsistentFields.some(inc => inc.field === f)
        )
      };
      
      cleanedProviders.push(cleanedProvider);

      if (inconsistentFields.length > 0) {
        inconsistencies.push({
          providerName: baseProvider.name,
          npi: baseProvider.npi,
          sources: providers.map(p => p.source),
          inconsistentFields,
          cleanedProvider
        });
      }
    }

    setCheckResults({
      totalChecked: multiSourceProviders.length,
      inconsistentCount: inconsistencies.length,
      consistentCount: multiSourceProviders.length - inconsistencies.length,
      inconsistencies,
      cleanedProviders
    });

    setIsChecking(false);
  };

  // Handle file upload
  const handleFileUpload = async (source, file) => {
    if (!file) return;

    setIsUploading(prev => ({ ...prev, [source]: true }));

    try {
      // Upload file to get URL
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data from the uploaded CSV - expecting array of provider objects
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              npi: { type: "string" },
              name: { type: "string" },
              specialty: { type: "string" },
              organization: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              website: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              zip: { type: "string" },
              license_number: { type: "string" },
              license_state: { type: "string" }
            }
          }
        }
      });

      if (extractResult.status === 'success' && extractResult.output) {
        // Get providers array from output
        const providersData = Array.isArray(extractResult.output) 
          ? extractResult.output 
          : (extractResult.output.providers || [extractResult.output]);
        
        // Add source to each provider and bulk insert
        const providersWithSource = providersData.map(p => ({ ...p, source }));

        if (providersWithSource.length > 0) {
          await base44.entities.Provider.bulkCreate(providersWithSource);

          setUploadedFiles(prev => ({ 
            ...prev, 
            [source]: { 
              name: file.name, 
              count: providersWithSource.length 
            } 
          }));
          
          // Refresh provider list
          queryClient.invalidateQueries({ queryKey: ['all-providers-consistency'] });
        } else {
          alert('No provider data found in the file.');
        }
      } else {
        alert(`Error processing file: ${extractResult.details || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload and process file. Please check the file format and try again.');
    } finally {
      setIsUploading(prev => ({ ...prev, [source]: false }));
    }
  };

  // Stats by source
  const statsBySource = {
    web: providers.filter(p => p.source === 'web').length,
    mobile: providers.filter(p => p.source === 'mobile').length,
    print: providers.filter(p => p.source === 'print').length,
  };

  const consistencyScore = checkResults
    ? Math.round((checkResults.consistentCount / checkResults.totalChecked) * 100) || 100
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-purple-500" />
            Consistency Checker
          </h1>
          <p className="text-slate-500 mt-1">
            Upload directory files and compare provider data across all sources
          </p>
        </div>
      </div>

      {/* Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(sourceConfig).map(([source, config]) => {
          const Icon = config.icon;
          const isLoading = isUploading[source];
          const uploadedFile = uploadedFiles[source];
          
          return (
            <Card key={source} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    source === 'web' && "bg-indigo-100",
                    source === 'mobile' && "bg-purple-100",
                    source === 'print' && "bg-emerald-100"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      source === 'web' && "text-indigo-600",
                      source === 'mobile' && "text-purple-600",
                      source === 'print' && "text-emerald-600"
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{config.label}</h3>
                    <p className="text-xs text-slate-500">{statsBySource[source] || 0} providers</p>
                  </div>
                </div>

                <div className={cn(
                  "border-2 border-dashed rounded-xl p-6 transition-all",
                  uploadedFile ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"
                )}>
                  {uploadedFile ? (
                    <div className="text-center">
                      <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-emerald-900">{uploadedFile.name}</p>
                      <p className="text-xs text-emerald-600 mt-1">{uploadedFile.count} providers imported</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 mb-3">Upload CSV file</p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileUpload(source, e.target.files[0])}
                        className="hidden"
                        id={`file-upload-${source}`}
                        disabled={isLoading}
                      />
                      <label htmlFor={`file-upload-${source}`}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(`file-upload-${source}`).click();
                          }}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            'Choose File'
                          )}
                        </Button>
                      </label>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Run Check Button */}
      {multiSourceProviders.length > 0 && (
        <div className="flex justify-center">
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white max-w-md w-full">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Ready to Check Consistency</h3>
              <p className="text-sm text-slate-500 mb-4">
                {multiSourceProviders.length} providers found in multiple sources
              </p>
              <Button 
                onClick={runConsistencyCheck}
                disabled={isChecking}
                className="bg-purple-600 hover:bg-purple-700 w-full"
                size="lg"
              >
                {isChecking ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <GitCompare className="w-4 h-4 mr-2" />
                    Start Check
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Check Results */}
      {checkResults && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Consistency Check Results</CardTitle>
              <Button 
                onClick={() => {
                  const headers = ['NPI', 'Name', 'Specialty', 'Organization', 'Phone', 'Email', 'Website', 'Address', 'City', 'State', 'ZIP', 'License Number', 'Corrected Fields'];
                  const rows = checkResults.cleanedProviders.map(p => [
                    p.npi, p.name, p.specialty, p.organization, p.phone, p.email, p.website, 
                    p.address, p.city, p.state, p.zip, p.license_number,
                    (p.corrected_fields || []).join('; ')
                  ]);
                  const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `clean_directory_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Clean Directory
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-slate-500 mb-2">Consistency Score</p>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "text-4xl font-bold",
                      consistencyScore >= 80 ? "text-emerald-600" :
                      consistencyScore >= 60 ? "text-amber-600" : "text-red-600"
                    )}>
                      {consistencyScore}%
                    </div>
                    <Progress 
                      value={consistencyScore} 
                      className="flex-1 h-3"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">Providers Checked</p>
                  <p className="text-3xl font-bold text-slate-900">{checkResults.totalChecked}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">Consistent</p>
                  <p className="text-3xl font-bold text-emerald-600">{checkResults.consistentCount}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">Auto-Corrected</p>
                  <p className="text-3xl font-bold text-purple-600">{checkResults.inconsistentCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inconsistencies & Corrections */}
          {checkResults.inconsistencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI-Corrected Providers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {checkResults.inconsistencies.map((item, index) => (
                    <div key={index} className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-semibold text-slate-900 text-lg">{item.providerName}</p>
                          {item.npi && (
                            <p className="text-sm text-slate-500">NPI: {item.npi}</p>
                          )}
                        </div>
                        <Badge className="bg-purple-100 text-purple-700 border-0">
                          {item.inconsistentFields.length} fields corrected
                        </Badge>
                      </div>

                      <div className="space-y-4">
                        {item.inconsistentFields.map((field, fieldIdx) => (
                          <div key={fieldIdx} className="bg-white rounded-xl p-4 border-l-4 border-purple-400">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-slate-700 capitalize flex items-center gap-2">
                                {field.field}
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              </p>
                            </div>
                            
                            {/* Show all source values */}
                            <div className="grid grid-cols-1 gap-2 mb-3">
                              {field.values.filter(v => v.value !== '(empty)').map((v, vIdx) => (
                                <div 
                                  key={vIdx}
                                  className="flex items-center gap-3 text-sm p-2 bg-slate-50 rounded"
                                >
                                  <Badge variant="outline" className="text-xs capitalize min-w-[80px]">
                                    {sourceConfig[v.source]?.label || v.source}
                                  </Badge>
                                  <span className="text-slate-600 line-through">{v.value}</span>
                                </div>
                              ))}
                            </div>
                            
                            {/* Show corrected value */}
                            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-emerald-700 mb-1">✓ Corrected Value</p>
                                <p className="font-semibold text-emerald-900">{field.correctedValue}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Final Clean Record Summary */}
                      <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg border border-emerald-200">
                        <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          Final Clean Record
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {['phone', 'email', 'website', 'address', 'city', 'zip'].map(f => (
                            item.cleanedProvider[f] && (
                              <div key={f}>
                                <span className="text-slate-500 capitalize">{f}: </span>
                                <span className="font-medium text-slate-900">{item.cleanedProvider[f]}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {checkResults.inconsistencies.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">All Data is Consistent!</h3>
                  <p className="text-slate-500">
                    No inconsistencies found across your directories.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Initial State */}
      {!checkResults && !isChecking && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <GitCompare className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to Check Consistency</h3>
              <p className="text-slate-500 mb-6">
                {multiSourceProviders.length > 0 
                  ? `Found ${multiSourceProviders.length} providers with data in multiple directories`
                  : 'No providers found in multiple sources yet'}
              </p>
              
              {multiSourceProviders.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                  <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    How to Use Consistency Checker
                  </h4>
                  <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                    <li>Upload the same provider from different sources (Web, Mobile, Print)</li>
                    <li>Make sure providers have matching NPI numbers or names</li>
                    <li>The system will compare data fields across sources</li>
                    <li>Inconsistencies will be highlighted for review</li>
                  </ol>
                  <p className="text-xs text-amber-700 mt-3">
                    💡 Tip: When uploading, select the correct source (Web/Mobile/Print) to enable comparison
                  </p>
                </div>
              )}
              
              {multiSourceProviders.length > 0 ? (
                <div className="space-y-4">
                  <Button 
                    onClick={runConsistencyCheck}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <GitCompare className="w-4 h-4 mr-2" />
                    Start Consistency Check
                  </Button>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                    <h4 className="font-semibold text-blue-900 mb-2">Providers Found in Multiple Sources:</h4>
                    <div className="space-y-2">
                      {multiSourceProviders.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-blue-800">{item.name}</span>
                          <div className="flex gap-1">
                            {item.sources.map(source => (
                              <Badge key={source} variant="outline" className="text-xs capitalize">
                                {sourceConfig[source]?.label || source}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                      {multiSourceProviders.length > 5 && (
                        <p className="text-xs text-blue-600 pt-2">
                          +{multiSourceProviders.length - 5} more providers
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Currently: {statsBySource.web} Web • {statsBySource.mobile} Mobile • {statsBySource.print} Print
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
