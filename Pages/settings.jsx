import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Settings as SettingsIcon, 
  Save,
  Clock,
  Target,
  Database,
  Bell,
  Shield,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const defaultSettings = {
  setting_key: 'main_settings',
  validation_frequency: 'weekly',
  confidence_threshold: 70,
  auto_approve_enabled: false,
  data_sources: [
    { name: 'NPI Registry', enabled: true, priority: 1 },
    { name: 'State License Boards', enabled: true, priority: 2 },
    { name: 'Hospital Websites', enabled: true, priority: 3 },
    { name: 'Public Directories', enabled: true, priority: 4 },
    { name: 'Google Search', enabled: false, priority: 5 },
  ],
  notification_settings: {
    email_on_completion: true,
    email_on_low_confidence: true,
    low_confidence_threshold: 50
  }
};

export default function Settings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
      
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
      }
    };
    loadUser();
  }, []);

  const { data: savedSettings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const results = await base44.entities.SystemSettings.filter({ setting_key: 'main_settings' });
      return results[0] || null;
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        ...defaultSettings,
        ...savedSettings,
        data_sources: savedSettings.data_sources || defaultSettings.data_sources,
        notification_settings: savedSettings.notification_settings || defaultSettings.notification_settings
      });
    }
  }, [savedSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      if (savedSettings?.id) {
        await base44.entities.SystemSettings.update(savedSettings.id, settings);
      } else {
        await base44.entities.SystemSettings.create(settings);
      }

      await base44.entities.AuditLog.create({
        action: 'settings_changed',
        description: 'System settings updated',
        user_email: user?.email,
        user_role: user?.role,
        changes: settings
      });

      queryClient.invalidateQueries(['system-settings']);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
    
    setIsSaving(false);
  };

  const updateDataSource = (index, field, value) => {
    const newSources = [...settings.data_sources];
    newSources[index] = { ...newSources[index], [field]: value };
    setSettings(prev => ({ ...prev, data_sources: newSources }));
  };

  if (user && user.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-slate-500" />
            System Settings
          </h1>
          <p className="text-slate-500 mt-1">
            Configure validation rules and system behavior
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
          {isSaving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Validation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Validation Settings
          </CardTitle>
          <CardDescription>Configure how often and how validation runs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Validation Frequency</Label>
              <Select 
                value={settings.validation_frequency} 
                onValueChange={(v) => setSettings(prev => ({ ...prev, validation_frequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">How often to run automatic validation</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Auto-Approve High Confidence Records</Label>
                <Switch 
                  checked={settings.auto_approve_enabled}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, auto_approve_enabled: v }))}
                />
              </div>
              <p className="text-xs text-slate-500">
                Automatically approve records above the confidence threshold
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Confidence Score Threshold</Label>
                <p className="text-xs text-slate-500">Minimum score to consider a record validated</p>
              </div>
              <span className="text-2xl font-bold text-indigo-600">{settings.confidence_threshold}%</span>
            </div>
            <Slider
              value={[settings.confidence_threshold]}
              onValueChange={([v]) => setSettings(prev => ({ ...prev, confidence_threshold: v }))}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0% (Accept All)</span>
              <span>50% (Moderate)</span>
              <span>100% (Strict)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-400" />
            Data Sources
          </CardTitle>
          <CardDescription>Configure which sources to use for verification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.data_sources.map((source, index) => (
              <div 
                key={source.name}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-medium text-slate-600">
                    {source.priority}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{source.name}</p>
                    <p className="text-xs text-slate-500">Priority {source.priority}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Select 
                    value={source.priority.toString()} 
                    onValueChange={(v) => updateDataSource(index, 'priority', parseInt(v))}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(p => (
                        <SelectItem key={p} value={p.toString()}>Priority {p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Switch 
                    checked={source.enabled}
                    onCheckedChange={(v) => updateDataSource(index, 'enabled', v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-400" />
            Notification Settings
          </CardTitle>
          <CardDescription>Configure when to receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Email on Validation Completion</p>
              <p className="text-sm text-slate-500">Get notified when batch validation completes</p>
            </div>
            <Switch 
              checked={settings.notification_settings.email_on_completion}
              onCheckedChange={(v) => setSettings(prev => ({
                ...prev,
                notification_settings: { ...prev.notification_settings, email_on_completion: v }
              }))}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Alert on Low Confidence Records</p>
              <p className="text-sm text-slate-500">Get notified when records fall below threshold</p>
            </div>
            <Switch 
              checked={settings.notification_settings.email_on_low_confidence}
              onCheckedChange={(v) => setSettings(prev => ({
                ...prev,
                notification_settings: { ...prev.notification_settings, email_on_low_confidence: v }
              }))}
            />
          </div>

          {settings.notification_settings.email_on_low_confidence && (
            <div className="space-y-4 pl-4 border-l-2 border-indigo-200">
              <div className="flex items-center justify-between">
                <Label>Low Confidence Alert Threshold</Label>
                <span className="text-lg font-semibold text-amber-600">
                  {settings.notification_settings.low_confidence_threshold}%
                </span>
              </div>
              <Slider
                value={[settings.notification_settings.low_confidence_threshold]}
                onValueChange={([v]) => setSettings(prev => ({
                  ...prev,
                  notification_settings: { ...prev.notification_settings, low_confidence_threshold: v }
                }))}
                max={100}
                min={0}
                step={5}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-400" />
            Access Control
          </CardTitle>
          <CardDescription>Manage who can access this page</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">Admin Access Only</p>
              <p className="text-sm text-emerald-700">
                Only users with admin role can access and modify these settings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
