import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
  unavailable_weekdays: number[];
  max_7h_guards: number | null;
  max_17h_guards: number | null;
}

interface DoctorListProps {
  onAddDoctor: (allDoctors: Doctor[]) => void;
  onEditDoctor: (doctor: Doctor, allDoctors: Doctor[]) => void;
  refreshTrigger: number;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DoctorList({ onAddDoctor, onEditDoctor, refreshTrigger }: DoctorListProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [incompatibilities, setIncompatibilities] = useState<Map<string, string[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setDoctors(data || []);
      
      // Fetch incompatibilities
      await fetchIncompatibilities(data || []);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      toast({
        title: "Error",
        description: "Failed to fetch doctors",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIncompatibilities = async (doctorsList: Doctor[]) => {
    try {
      const { data, error } = await supabase
        .from("doctor_incompatibilities")
        .select("doctor_id, incompatible_doctor_id");

      if (error) throw error;

      const incompMap = new Map<string, string[]>();
      data?.forEach(item => {
        const existing = incompMap.get(item.doctor_id) || [];
        incompMap.set(item.doctor_id, [...existing, item.incompatible_doctor_id]);
      });

      setIncompatibilities(incompMap);
    } catch (error) {
      console.error("Error fetching incompatibilities:", error);
    }
  };

  const handleDelete = async (doctor: Doctor) => {
    if (!confirm(`Are you sure you want to delete ${doctor.full_name}?`)) return;

    try {
      const { error } = await supabase
        .from("doctors")
        .delete()
        .eq("id", doctor.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Doctor deleted successfully",
      });

      fetchDoctors();
    } catch (error) {
      console.error("Error deleting doctor:", error);
      toast({
        title: "Error",
        description: "Failed to delete doctor",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [refreshTrigger]);

  if (isLoading) {
    return <div className="text-center py-8">Loading doctors...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Doctors ({doctors.length})</h2>
        <Button onClick={() => onAddDoctor(doctors)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Doctor
        </Button>
      </div>

      {doctors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No doctors added yet. Add your first doctor to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {doctors.map((doctor) => (
            <Card key={doctor.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{doctor.full_name}</h3>
                      <Badge variant="secondary">{doctor.alias}</Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {doctor.unavailable_weekdays.length > 0 && (
                        <div>
                          <span className="font-medium">Unavailable days: </span>
                          {doctor.unavailable_weekdays.map(day => WEEKDAY_NAMES[day]).join(", ")}
                        </div>
                      )}
                      
                      <div className="flex gap-4">
                        <span>
                          <span className="font-medium">7h limit: </span>
                          {doctor.max_7h_guards ?? "No limit"}
                        </span>
                        <span>
                          <span className="font-medium">17h limit: </span>
                          {doctor.max_17h_guards ?? "No limit"}
                        </span>
                      </div>

                      {incompatibilities.get(doctor.id)?.length && (
                        <div>
                          <span className="font-medium">Incompatible with: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {incompatibilities.get(doctor.id)?.map(incompId => {
                              const incompDoc = doctors.find(d => d.id === incompId);
                              return incompDoc ? (
                                <Badge key={incompId} variant="outline" className="text-xs">
                                  {incompDoc.alias}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditDoctor(doctor, doctors)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doctor)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}