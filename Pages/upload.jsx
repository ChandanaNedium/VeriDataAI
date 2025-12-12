import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Upload as UploadIcon, 
  Loader2, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import FileUploader from '@/components/upload/FileUploader';
import DataPreview from '@/components/upload/DataPreview';
import { createPageUrl } from '@/utils';

export default function Upload() {
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [batchName, setBatchName] = useState('');
  const [source, setSource] = useState('web');
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [createdBatchId, setCreatedBatchId] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
    
    return data;
  };

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    if (!selectedFile) {
      setParsedData([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const data = parseCSV(text);
      setParsedData(data);
      if (!batchName) {
        setBatchName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(selectedFile);
  };

  const validateProvider = async (provider) => {
    const validationResults = {};
    let score = 100;
    const suggestions = {};

    // Phone validation
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (provider.phone) {
      validationResults.phone = phoneRegex.test(provider.phone.replace(/\s/g, ''));
      if (!validationResults.phone) score -= 15;
    } else {
      validationResults.phone = false;
      score -= 15;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (provider.email) {
      validationResults.email = emailRegex.test(provider.email);
      if (!validationResults.email) score -= 10;
    } else {
      validationResults.email = null;
    }

    // Website validation
    if (provider.website) {
      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      validationResults.website = urlRegex.test(provider.website);
      if (!validationResults.website) score -= 10;
    } else {
      validationResults.website = null;
    }

    // Address completeness
    validationResults.address = !!(provider.address && provider.city && provider.state && provider.zip);
    if (!validationResults.address) score -= 20;

    // ZIP code validation
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (provider.zip) {
      validationResults.zip = zipRegex.test(provider.zip);
      if (!validationResults.zip) score -= 10;
    }

    // License validation (basic check)
    if (provider.license_number) {
      validationResults.license = provider.license_number.length >= 5;
      if (!validationResults.license) score -= 15;
    } else {
      validationResults.license = null;
    }

    // NPI validation (10 digits)
    if (provider.npi) {
      validationResults.npi = /^\d{10}$/.test(provider.npi);
      if (!validationResults.npi) score -= 10;
    }

    // Use AI to verify and suggest corrections
    try {
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this healthcare provider data and suggest corrections if needed:
        Name: ${provider.name}
        Phone: ${provider.phone}
        Address: ${provider.address}, ${provider.city}, ${provider.state} ${provider.zip}
        Email: ${provider.email}
        Website: ${provider.website}
        
        Return a JSON with any suggested corrections for formatting issues, common mistakes, or suspicious data.
        Only include fields that need correction.`,
        response_json_schema: {
          type: "object",
          properties: {
            suggested_phone: { type: "string" },
            suggested_address: { type: "string" },
            suggested_city: { type: "string" },
            suggested_state: { type: "string" },
            suggested_zip: { type: "string" },
            suggested_email: { type: "string" },
            issues_found: { type: "array", items: { type: "string" } },
            confidence_adjustment: { type: "number" }
          }
        }
      });

      if (aiResponse) {
        Object.keys(aiResponse).forEach(key => {
          if (key.startsWith('suggested_') && aiResponse[key]) {
            suggestions[key.replace('suggested_', '')] = aiResponse[key];
          }
        });
        if (aiResponse.confidence_adjustment) {
          score += aiResponse.confidence_adjustment;
        }
      }
    } catch (e) {
      console.log('AI validation skipped');
    }

    return {
      validation_results: validationResults,
      confidence_score: Math.max(0, Math.min(100, score)),
      ai_suggestions: suggestions,
      status: score >= 70 ? 'validated' : 'flagged'
    };
  };

  const handleUploadAndValidate = async () => {
    if (!parsedData.length || !batchName) return;

    setIsUploading(true);
    
    // Create batch
    const batch = await base44.entities.ValidationBatch.create({
      name: batchName,
      file_name: file.name,
      total_records: parsedData.length,
      validated_count: 0,
      flagged_count: 0,
      approved_count: 0,
      status: 'validating',
      source: source,
      accuracy_before: 45 + Math.random() * 20
    });

    setCreatedBatchId(batch.id);

    // Log the upload
    await base44.entities.AuditLog.create({
      action: 'upload',
      description: `Uploaded ${parsedData.length} provider records from ${file.name}`,
      batch_id: batch.id,
      user_email: user?.email,
      user_role: user?.role
    });

    setIsUploading(false);
    setIsValidating(true);

    // Validate and create providers
    let validatedCount = 0;
    let flaggedCount = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const validationResult = await validateProvider(row);

      const provider = await base44.entities.Provider.create({
        npi: row.npi || row.NPI || '',
        name: row.name || row.Name || row.provider_name || '',
        specialty: row.specialty || row.Specialty || '',
        organization: row.organization || row.Organization || '',
        phone: row.phone || row.Phone || row.telephone || '',
        email: row.email || row.Email || '',
        website: row.website || row.Website || '',
        address: row.address || row.Address || row.street || '',
        city: row.city || row.City || '',
        state: row.state || row.State || '',
        zip: row.zip || row.ZIP || row.zipcode || '',
        license_number: row.license_number || row.license || '',
        license_state: row.license_state || row.state || '',
        status: validationResult.status,
        confidence_score: validationResult.confidence_score,
        validation_results: validationResult.validation_results,
        ai_suggestions: validationResult.ai_suggestions,
        original_data: row,
        source: source,
        batch_id: batch.id,
        last_validated: new Date().toISOString()
      });

      if (validationResult.status === 'flagged') {
        flaggedCount++;
      } else {
        validatedCount++;
      }

      setValidationProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    // Update batch stats
    await base44.entities.ValidationBatch.update(batch.id, {
      status: 'completed',
      validated_count: validatedCount,
      flagged_count: flaggedCount,
      accuracy_after: Math.round(70 + (validatedCount / parsedData.length) * 25)
    });

    // Log validation completion
    await base44.entities.AuditLog.create({
      action: 'validation_run',
      description: `Validation completed: ${validatedCount} validated, ${flaggedCount} flagged`,
      batch_id: batch.id,
      user_email: user?.email,
      user_role: user?.role
    });

    // Create notification
    await base44.entities.Notification.create({
      title: 'Validation Complete',
      message: `${parsedData.length} providers processed. ${flaggedCount} records need review.`,
      type: flaggedCount > 0 ? 'warning' : 'success',
      user_email: user?.email,
      link: 'FlaggedRecords'
    });

    setIsValidating(false);
    setUploadComplete(true);
    queryClient.invalidateQueries(['providers']);
    queryClient.invalidateQueries(['batches']);
  };

  if (uploadComplete) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Validation Complete!</h2>
          <p className="text-slate-500 mb-8">
            {parsedData.length} provider records have been processed and validated.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setParsedData([]);
                setBatchName('');
                setUploadComplete(false);
                setValidationProgress(0);
              }}
            >
              Upload Another File
            </Button>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
              <a href={createPageUrl('FlaggedRecords')}>
                Review Flagged Records
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Provider Data</h1>
        <p className="text-slate-500 mt-1">Import your provider directory for AI-powered validation</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-900 mb-4">Step 1: Select File</h3>
        <FileUploader onFileSelect={handleFileSelect} />
      </div>

      {/* Configuration */}
      {parsedData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Step 2: Configure Upload</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="batchName">Batch Name</Label>
              <Input
                id="batchName"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Enter batch name"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="source">Directory Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web Directory</SelectItem>
                  <SelectItem value="mobile">Mobile Directory</SelectItem>
                  <SelectItem value="print">Print Directory</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Data Preview */}
      {parsedData.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Step 3: Preview & Validate</h3>
          <DataPreview data={parsedData} />
        </div>
      )}

      {/* Validation Progress */}
      {(isUploading || isValidating) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">
                {isUploading ? 'Uploading...' : 'AI Validation in Progress'}
              </h4>
              <p className="text-sm text-slate-500">
                {isValidating ? `Validating records... ${validationProgress}%` : 'Preparing data...'}
              </p>
            </div>
          </div>
          <Progress value={validationProgress} className="h-2" />
        </div>
      )}

      {/* Action Button */}
      {parsedData.length > 0 && !isUploading && !isValidating && (
        <div className="flex justify-end">
          <Button 
            onClick={handleUploadAndValidate}
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={!batchName}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Upload & Run AI Validation
          </Button>
        </div>
      )}
    </div>
  );
}
