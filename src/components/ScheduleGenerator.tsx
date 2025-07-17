import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarDays, Users } from "lucide-react";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR + i);

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
  unavailable_weekdays: number[];
  max_7h_guards: number | null;
  max_17h_guards: number | null;
}

interface GuardDay {
  id: string;
  date: string;
  is_guard_day: boolean;
}

export const ScheduleGenerator = () => {
  const [selectedMonth, setSelectedMonth] = useState<number>();
  const [selectedYear, setSelectedYear] = useState<number>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchedule, setGeneratedSchedule] = useState<any>(null);
  const { toast } = useToast();

  const generateSchedule = async () => {
    if (!selectedMonth || !selectedYear) {
      toast({
        title: "Missing Information",
        description: "Please select both month and year",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Fetch doctors
      const { data: doctors, error: doctorsError } = await supabase
        .from('doctors')
        .select('*');

      if (doctorsError) throw doctorsError;

      // Fetch guard days for the selected month
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      
      const { data: guardDays, error: guardDaysError } = await supabase
        .from('guard_days')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .eq('is_guard_day', true);

      if (guardDaysError) throw guardDaysError;

      if (!doctors?.length) {
        toast({
          title: "No Doctors",
          description: "Please add doctors before generating a schedule",
          variant: "destructive",
        });
        return;
      }

      if (!guardDays?.length) {
        toast({
          title: "No Guard Days",
          description: "Please configure guard days for this month first",
          variant: "destructive",
        });
        return;
      }

      // Create guard schedule record
      const { data: schedule, error: scheduleError } = await supabase
        .from('guard_schedules')
        .insert({
          month: selectedMonth,
          year: selectedYear,
          status: 'draft'
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // Generate assignments using a round-robin approach
      const assignments = generateAssignments(doctors, guardDays, schedule.id);

      // Save assignments to database
      const { error: assignmentsError } = await supabase
        .from('guard_assignments')
        .insert(assignments);

      if (assignmentsError) throw assignmentsError;

      setGeneratedSchedule({
        schedule,
        assignments,
        guardDays,
        doctors
      });

      toast({
        title: "Schedule Generated",
        description: `Successfully generated schedule for ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`,
      });

    } catch (error) {
      console.error('Error generating schedule:', error);
      toast({
        title: "Error",
        description: "Failed to generate schedule",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAssignments = (doctors: Doctor[], guardDays: GuardDay[], scheduleId: string) => {
    const assignments = [];
    let doctorIndex = 0;

    for (const guardDay of guardDays) {
      const date = new Date(guardDay.date);
      const weekday = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Find available doctors for this weekday
      const availableDoctors = doctors.filter(doctor => 
        !doctor.unavailable_weekdays?.includes(weekday)
      );

      if (availableDoctors.length === 0) {
        // If no doctors are available, skip this day or use any doctor
        continue;
      }

      // Assign doctors using round-robin
      const assignedDoctor = availableDoctors[doctorIndex % availableDoctors.length];
      
      // Create assignments for both shifts (7h and 17h)
      assignments.push({
        schedule_id: scheduleId,
        doctor_id: assignedDoctor.id,
        date: guardDay.date,
        shift_type: '7h',
        shift_position: 1,
        is_original: true
      });

      assignments.push({
        schedule_id: scheduleId,
        doctor_id: availableDoctors[(doctorIndex + 1) % availableDoctors.length]?.id || assignedDoctor.id,
        date: guardDay.date,
        shift_type: '17h',
        shift_position: 1,
        is_original: true
      });

      doctorIndex++;
    }

    return assignments;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Generate Guard Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Month</label>
              <Select value={selectedMonth?.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Year</label>
              <Select value={selectedYear?.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={generateSchedule} 
            disabled={!selectedMonth || !selectedYear || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Schedule...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Generate Schedule
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedSchedule && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Month:</strong> {MONTHS.find(m => m.value === selectedMonth)?.label}
                </div>
                <div>
                  <strong>Year:</strong> {selectedYear}
                </div>
                <div>
                  <strong>Status:</strong> Draft
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Generated {generatedSchedule.assignments.length} guard assignments for {generatedSchedule.guardDays.length} guard days.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};