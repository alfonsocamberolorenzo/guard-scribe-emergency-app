import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
  unavailable_weekdays: number[];
  max_7h_guards: number | null;
  max_17h_guards: number | null;
}

interface DoctorFormProps {
  doctor?: Doctor;
  onSave: () => void;
  onCancel: () => void;
  allDoctors: Doctor[];
}

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function DoctorForm({ doctor, onSave, onCancel, allDoctors }: DoctorFormProps) {
  const [fullName, setFullName] = useState(doctor?.full_name || "");
  const [alias, setAlias] = useState(doctor?.alias || "");
  const [unavailableWeekdays, setUnavailableWeekdays] = useState<number[]>(
    doctor?.unavailable_weekdays || []
  );
  const [max7hGuards, setMax7hGuards] = useState<string>(
    doctor?.max_7h_guards?.toString() || ""
  );
  const [max17hGuards, setMax17hGuards] = useState<string>(
    doctor?.max_17h_guards?.toString() || ""
  );
  const [incompatibleDoctors, setIncompatibleDoctors] = useState<string[]>([]);
  const [selectedIncompatibleDoctor, setSelectedIncompatibleDoctor] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  // Load existing incompatibilities when editing
  useEffect(() => {
    if (doctor?.id) {
      fetchIncompatibilities();
    }
  }, [doctor?.id]);

  const fetchIncompatibilities = async () => {
    if (!doctor?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("doctor_incompatibilities")
        .select("incompatible_doctor_id")
        .eq("doctor_id", doctor.id);

      if (error) throw error;
      setIncompatibleDoctors(data?.map(item => item.incompatible_doctor_id) || []);
    } catch (error) {
      console.error("Error fetching incompatibilities:", error);
    }
  };

  const handleWeekdayChange = (weekday: number, checked: boolean) => {
    if (checked) {
      setUnavailableWeekdays([...unavailableWeekdays, weekday]);
    } else {
      setUnavailableWeekdays(unavailableWeekdays.filter(w => w !== weekday));
    }
  };

  const addIncompatibleDoctor = () => {
    if (selectedIncompatibleDoctor && !incompatibleDoctors.includes(selectedIncompatibleDoctor)) {
      setIncompatibleDoctors([...incompatibleDoctors, selectedIncompatibleDoctor]);
      setSelectedIncompatibleDoctor("");
    }
  };

  const removeIncompatibleDoctor = (doctorId: string) => {
    setIncompatibleDoctors(incompatibleDoctors.filter(id => id !== doctorId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const doctorData = {
        full_name: fullName,
        alias: alias,
        unavailable_weekdays: unavailableWeekdays,
        max_7h_guards: max7hGuards ? parseInt(max7hGuards) : null,
        max_17h_guards: max17hGuards ? parseInt(max17hGuards) : null,
      };

      let doctorId = doctor?.id;
      
      if (doctor) {
        // Update existing doctor
        const { error } = await supabase
          .from("doctors")
          .update(doctorData)
          .eq("id", doctor.id);

        if (error) throw error;
        doctorId = doctor.id;
      } else {
        // Create new doctor
        const { data: newDoctor, error } = await supabase
          .from("doctors")
          .insert([doctorData])
          .select()
          .single();

        if (error) throw error;
        doctorId = newDoctor.id;
      }

      // Handle incompatibilities
      if (doctorId) {
        // Remove existing incompatibilities
        if (doctor?.id) {
          await supabase
            .from("doctor_incompatibilities")
            .delete()
            .eq("doctor_id", doctor.id);
        }

        // Add new incompatibilities (bidirectional)
        if (incompatibleDoctors.length > 0) {
          const incompatibilityRecords = [];
          
          incompatibleDoctors.forEach(incompatibleId => {
            // Add relationship in both directions
            incompatibilityRecords.push({
              doctor_id: doctorId,
              incompatible_doctor_id: incompatibleId
            });
            incompatibilityRecords.push({
              doctor_id: incompatibleId,
              incompatible_doctor_id: doctorId
            });
          });

          const { error: incompError } = await supabase
            .from("doctor_incompatibilities")
            .insert(incompatibilityRecords);

          if (incompError) throw incompError;
        }
      }

      toast({
        title: "Success",
        description: `Doctor ${doctor ? 'updated' : 'created'} successfully`,
      });

      onSave();
    } catch (error) {
      console.error("Error saving doctor:", error);
      toast({
        title: "Error",
        description: "Failed to save doctor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{doctor ? 'Edit Doctor' : 'Add New Doctor'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="alias">Alias</Label>
              <Input
                id="alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label>Unavailable Weekdays</Label>
            <div className="grid grid-cols-4 gap-3 mt-2">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`weekday-${weekday.value}`}
                    checked={unavailableWeekdays.includes(weekday.value)}
                    onCheckedChange={(checked) =>
                      handleWeekdayChange(weekday.value, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`weekday-${weekday.value}`}
                    className="text-sm font-normal"
                  >
                    {weekday.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max7h">Max 7-hour Guards (leave empty for no limit)</Label>
              <Input
                id="max7h"
                type="number"
                min="0"
                value={max7hGuards}
                onChange={(e) => setMax7hGuards(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="max17h">Max 17-hour Guards (leave empty for no limit)</Label>
              <Input
                id="max17h"
                type="number"
                min="0"
                value={max17hGuards}
                onChange={(e) => setMax17hGuards(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Incompatible Doctors</Label>
            <div className="space-y-3 mt-2">
              <div className="flex gap-2">
                <Select value={selectedIncompatibleDoctor} onValueChange={setSelectedIncompatibleDoctor}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select incompatible doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDoctors
                      .filter(d => d.id !== doctor?.id && !incompatibleDoctors.includes(d.id))
                      .map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.full_name} ({doc.alias})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addIncompatibleDoctor}
                  disabled={!selectedIncompatibleDoctor}
                >
                  Add
                </Button>
              </div>
              
              {incompatibleDoctors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {incompatibleDoctors.map(doctorId => {
                    const incompDoc = allDoctors.find(d => d.id === doctorId);
                    return incompDoc ? (
                      <Badge key={doctorId} variant="secondary" className="flex items-center gap-1">
                        {incompDoc.full_name} ({incompDoc.alias})
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => removeIncompatibleDoctor(doctorId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Doctor"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}