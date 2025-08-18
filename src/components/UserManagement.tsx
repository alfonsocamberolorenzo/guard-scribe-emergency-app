import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Edit, Save, X } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  associated_doctor_id: string | null;
  full_name: string | null;
  created_at: string;
}

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
}

export function UserManagement() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ role: string; doctorId: string | null }>({ role: '', doctorId: null });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch doctors
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, full_name, alias')
        .order('full_name');

      if (doctorsError) throw doctorsError;

      setProfiles(profilesData || []);
      setDoctors(doctorsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (profile: UserProfile) => {
    setEditingProfile(profile.id);
    setEditData({
      role: profile.role,
      doctorId: profile.associated_doctor_id,
    });
  };

  const cancelEditing = () => {
    setEditingProfile(null);
    setEditData({ role: '', doctorId: null });
  };

  const saveProfile = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editData.role as 'editor' | 'viewer',
          associated_doctor_id: editData.doctorId,
        })
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User profile updated successfully",
      });

      setEditingProfile(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getAssociatedDoctorName = (doctorId: string | null) => {
    if (!doctorId) return 'None';
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? `${doctor.full_name} (${doctor.alias})` : 'Unknown Doctor';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={fetchData} variant="outline">
          Refresh
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Alert>
          <User className="h-4 w-4" />
          <AlertDescription>
            No users found. Users will appear here after they register for the application.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">{profile.full_name || 'Unnamed User'}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Joined {new Date(profile.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={profile.role === 'editor' ? 'default' : 'secondary'}>
                      {profile.role}
                    </Badge>
                    {editingProfile !== profile.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(profile)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingProfile === profile.id ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={editData.role}
                        onValueChange={(value) => setEditData({ ...editData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editData.role === 'viewer' && (
                      <div>
                        <Label htmlFor="doctor">Associated Doctor</Label>
                        <Select
                          value={editData.doctorId || ''}
                          onValueChange={(value) => setEditData({ ...editData, doctorId: value || null })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                {doctor.full_name} ({doctor.alias})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveProfile(profile.id)}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Associated Doctor:</span>
                      <span className="text-sm">{getAssociatedDoctorName(profile.associated_doctor_id)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}