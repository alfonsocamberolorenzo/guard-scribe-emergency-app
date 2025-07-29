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

interface GuardAssignment {
  doctor_id: string,
  date: string,
  shift_type: string
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
      
      // Fetch doctor incompatibilities
      const { data: incompatibilities, error: incompError } = await supabase
        .from('doctor_incompatibilities')
        .select('doctor_id, incompatible_doctor_id');

      if (doctorsError) throw doctorsError;
      if (incompError) throw incompError;

      // Fetch guard days for the selected month
      const startDate = new Date(selectedYear, selectedMonth - 1, 1, 12);
      const endDate = new Date(selectedYear, selectedMonth, 0, 12);
      
      const { data: guardDays, error: guardDaysError } = await supabase
        .from('guard_days')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .eq('is_guard_day', true);
      
      const startDateStats = new Date(selectedYear, selectedMonth - 12, 1, 12);
      const endDateStats = new Date(selectedYear, selectedMonth, 0, 12);
        const { data: guardAssignments, error: guardAssignmentsError } = await supabase
        .from('guard_assignments')
        .select('*')
        .gte('date', startDateStats.toISOString().split('T')[0])
        .lte('date', endDateStats.toISOString().split('T')[0])
        .eq('is_original', true);

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
      const assignments = generateAssignments(doctors, guardDays, schedule.id, guardAssignments, incompatibilities || []);

      // Save assignments to database
      const { error: assignmentsError } = await supabase
        .from('guard_assignments')
        .insert(assignments);

      if (assignmentsError) throw assignmentsError;

      setGeneratedSchedule({
        schedule,
        assignments,
        guardDays,
        doctors,
        guardAssignments
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

  type ShiftType = '7h' | '17h';

const generateAssignments = (doctors: Doctor[], guardDays: GuardDay[], scheduleId: string, guardAssignments: GuardAssignment[], incompatibilities: any[]) => {

const schedule = [];
const doctorStats = new Map();
const unassignedDays = [];

for (const day of guardDays) {
    if (!day.is_guard_day) continue;
    const date = new Date(day.date);
    const isoDate = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const weekNumber = getWeekNumber(date);
    const assignedOnDate = new Set();
    let shift17hCount = 0;

    for (const shiftType of ['7h', '17h', '17h']) {
        let assigned = false;
        for (const doctor of doctors) {
            const stats = doctorStats.get(doctor.id) || { '7h': 0, '17h': 0, total: 0, assignedWeeks: new Set() };
            if (doctor.unavailable_weekdays.includes(dayOfWeek)) continue;
            if (shiftType === '7h' and stats['7h'] >= getMaxPerDoctor(doctors.length, guardDays, '7h', true)) continue;
            if (shiftType === '17h' and stats['17h'] >= getMaxPerDoctor(doctors.length, guardDays, '17h', true)) continue;
            if (stats.assignedWeeks.has(weekNumber)) continue;
            if (assignedOnDate.has(doctor.id)) continue;

            schedule.push({
                schedule_id: scheduleId,
                doctor_id: doctor.id,
                date: isoDate,
                shift_type: shiftType,
                shift_position: shiftType === '7h' ? 1 : (shift17hCount === 0 ? 1 : 2),
                is_original: true
            });

            stats[shiftType]++;
            stats.total++;
            stats.assignedWeeks.add(weekNumber);
            doctorStats.set(doctor.id, stats);
            assignedOnDate.add(doctor.id);
            if (shiftType === '17h') shift17hCount++;
            assigned = True;
            console.log(`Asignado ${shiftType} a ${doctor.alias} en ${isoDate}`);
            break;
        }
        if (!assigned) {
            unassignedDays.push({ date: isoDate, shiftType });
            console.warn(`No asignado: ${shiftType} en ${isoDate}`);
        }
    }
}

return schedule;
};

function getWeekNumber(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMaxPerDoctor(numDoctors: number, guardDays: GuardDay[], shiftType: ShiftType, relaxed: boolean): number {
  const totalShifts = guardDays.filter(d => d.is_guard_day).length * (shiftType === '7h' ? 1 : 2);
  return relaxed ? Math.ceil(totalShifts / numDoctors) : Math.floor(totalShifts / numDoctors)
}
  
return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Generate Guard Schedule v5
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