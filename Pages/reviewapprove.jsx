import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle, 
  XCircle, 
  Edit2, 
  Save,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Phone,
  Mail,
  Globe,
  MapPin,
  FileText,
  Building,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import ConfidenceGauge from '@/components/providers/ConfidenceGauge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ReviewApprove() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialProviderId = urlParams.get('providerId');
  
  const [user, setUser] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [reviewNotes, setReviewNotes] = useState('');
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: flaggedProviders = [], isLoading } = useQuery({
    queryKey: ['flagged-providers-review'],
    queryFn: () => base44.entities.Provider.filter({ status: 'flagged' }, 'confidence_score', 500),
  });

  useEffect(() => {
    if (initialProviderId && flaggedProviders.length > 0) {
      const index = flaggedProviders.findIndex(p => p.id === initialProviderId);
      if (index !== -1) {
        setCurrentIndex(index);
        setSelectedProvider(flaggedProviders[index]);
      }
    } else if (flaggedProviders.length > 0 && !selectedProvider) {
      setSelectedProvider(flaggedProviders[0]);
    }
  }, [flaggedProviders, initialProviderId]);

  useEffect(() => {
    if (selectedProvider) {
      setEditedData({ ...selectedProvider });
      setReviewNotes('');
      setIsEditing(false);
    }
  }, [selectedProvider]);

  const handleApprove = async () => {
    await base44.entities.Provider.update(selectedProvider.id, {
      ...editedData,
      status: 'approved',
      reviewed_by: user?.email,
      review_notes: reviewNotes
    });

    await base44.entities.AuditLog.create({
      action: 'record_approved',
      description: `Approved provider: ${selectedProvider.name}`,
      provider_id: selectedProvider.id,
      user_email: user?.email,
      user_role: user?.role,
      changes: { from: 'flagged', to: 'approved' }
    });

    toast.success('Provider approved successfully');
    queryClient.invalidateQueries(['flagged-providers-review']);
    moveToNext();
  };

  const handleReject = async () => {
    await base44.entities.Provider.update(selectedProvider.id, {
      status: 'rejected',
      reviewed_by: user?.email,
      review_notes: reviewNotes
    });

    await base44.entities.AuditLog.create({
      action: 'record_rejected',
      description: `Rejected provider: ${selectedProvider.name}`,
      provider_id: selectedProvider.id,
      user_email: user?.email,
      user_role: user?.role,
      changes: { from: 'flagged', to: 'rejected' }
    });

    toast.success('Provider rejected');
    queryClient.invalidateQueries(['flagged-providers-review']);
    moveToNext();
  };

  const handleSaveEdit = async () => {
    await base44.entities.Provider.update(selectedProvider.id, editedData);

    await base44.entities.AuditLog.create({
      action: 'record_edited',
      description: `Edited provider: ${selectedProvider.name}`,
      provider_id: selectedProvider.id,
      user_email: user?.email,
      user_role: user?.role,
      changes: { edited_fields: Object.keys(editedData) }
    });

    toast.success('Changes saved');
    setIsEditing(false);
    queryClient.invalidateQueries(['flagged-providers-review']);
  };

  const applySuggestion = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
    setIsEditing(true);
  };

  const moveToNext = () => {
    if (currentIndex < flaggedProviders.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedProvider(flaggedProviders[currentIndex + 1]);
    }
  };

  const moveToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setSelectedProvider(flaggedProviders[currentIndex - 1]);
    }
  };

  const getFieldStatus = (field) => {
    return selectedProvider?.validation_results?.[field];
  };

  const FieldInput = ({ label, field, icon: Icon, suggestion }) => {
    const status = getFieldStatus(field);
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          {label}
          {status === false && (
            <Badge className="bg-red-100 text-red-700 border-0 text-xs">Issue Detected</Badge>
          )}
          {status === true && (
            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Valid</Badge>
          )}
        </Label>
        <div className="flex gap-2">
          <Input
            value={editedData[field] || ''}
            onChange={(e) => setEditedData(prev => ({ ...prev, [field]: e.target.value }))}
            disabled={!isEditing}
            className={cn(
              status === false && "border-red-300 bg-red-50",
              status === true && "border-emerald-300 bg-emerald-50"
            )}
          />
          {suggestion && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => applySuggestion(field, suggestion)}
              className="text-amber-600 border-amber-300 hover:bg-amber-50 whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Use Suggestion
            </Button>
          )}
        </div>
        {suggestion && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            AI suggests: {suggestion}
          </p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (flaggedProviders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">All Caught Up!</h2>
          <p className="text-slate-500">
            There are no flagged records that need review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review & Approve</h1>
          <p className="text-slate-500 mt-1">
            Reviewing {currentIndex + 1} of {flaggedProviders.length} flagged records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={moveToPrev} disabled={currentIndex === 0}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button variant="outline" onClick={moveToNext} disabled={currentIndex >= flaggedProviders.length - 1}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {selectedProvider && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-400" />
                  Provider Information
                </CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleSaveEdit} className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider Name</Label>
                    <Input
                      value={editedData.name || ''}
                      onChange={(e) => setEditedData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NPI</Label>
                    <Input
                      value={editedData.npi || ''}
                      onChange={(e) => setEditedData(prev => ({ ...prev, npi: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <Separator />

                <FieldInput 
                  label="Phone Number" 
                  field="phone" 
                  icon={Phone}
                  suggestion={selectedProvider.ai_suggestions?.phone}
                />

                <FieldInput 
                  label="Email Address" 
                  field="email" 
                  icon={Mail}
                  suggestion={selectedProvider.ai_suggestions?.email}
                />

                <FieldInput 
                  label="Website" 
                  field="website" 
                  icon={Globe}
                  suggestion={selectedProvider.ai_suggestions?.website}
                />

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldInput 
                    label="Street Address" 
                    field="address" 
                    icon={MapPin}
                    suggestion={selectedProvider.ai_suggestions?.address}
                  />
                  <FieldInput 
                    label="City" 
                    field="city" 
                    icon={MapPin}
                    suggestion={selectedProvider.ai_suggestions?.city}
                  />
                  <FieldInput 
                    label="State" 
                    field="state" 
                    icon={MapPin}
                    suggestion={selectedProvider.ai_suggestions?.state}
                  />
                  <FieldInput 
                    label="ZIP Code" 
                    field="zip" 
                    icon={MapPin}
                    suggestion={selectedProvider.ai_suggestions?.zip}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldInput 
                    label="License Number" 
                    field="license_number" 
                    icon={FileText}
                  />
                  <FieldInput 
                    label="Specialty" 
                    field="specialty" 
                    icon={Building}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Review Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Review Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add notes about this review..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Confidence Score */}
            <Card>
              <CardHeader>
                <CardTitle>Confidence Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-4">
                <ConfidenceGauge score={selectedProvider.confidence_score || 0} size="lg" />
                <p className="text-sm text-slate-500 mt-4 text-center">
                  {selectedProvider.confidence_score >= 80 
                    ? 'High confidence - likely accurate'
                    : selectedProvider.confidence_score >= 60
                    ? 'Medium confidence - review recommended'
                    : 'Low confidence - manual review required'}
                </p>
              </CardContent>
            </Card>

            {/* Validation Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Validation Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(selectedProvider.validation_results || {}).map(([field, valid]) => (
                    <div key={field} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 capitalize">{field.replace('_', ' ')}</span>
                      {valid === true ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0">Valid</Badge>
                      ) : valid === false ? (
                        <Badge className="bg-red-100 text-red-700 border-0">Invalid</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 border-0">N/A</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleApprove}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Record
              </Button>
              <Button 
                variant="outline"
                onClick={handleReject}
                className="w-full text-red-600 border-red-300 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
