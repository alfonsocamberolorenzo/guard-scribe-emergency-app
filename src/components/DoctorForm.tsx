import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const handleWeekdayChange = (weekday: number, checked: boolean) => {
    if (checked) {
      setUnavailableWeekdays([...unavailableWeekdays, weekday]);
    } else {
      setUnavailableWeekdays(unavailableWeekdays.filter(w => w !== weekday));
    }
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

      if (doctor) {
        // Update existing doctor
        const { error } = await supabase
          .from("doctors")
          .update(doctorData)
          .eq("id", doctor.id);

        if (error) throw error;
      } else {
        // Create new doctor
        const { error } = await supabase
          .from("doctors")
          .insert([doctorData]);

        if (error) throw error;
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