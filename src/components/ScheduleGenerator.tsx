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
      const startDate = new Date(selectedYear, selectedMonth - 1, 1, 12);
      const endDate = new Date(selectedYear, selectedMonth, 0, 12);
      
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

  type ShiftType = '7h' | '17h';

const generateAssignments = (doctors: Doctor[], guardDays: GuardDay[], scheduleId: string) => {
  const schedule = [];
  const doctorStats = new Map<string, {
    '7h': number,
    '17h': number,
    total: number,
    weekdays: number[],
    thursdays: number,
    lastGuardDate: string | null,
    assignedWeeks: Set<number>
  }>();

  // Inicializar estadísticas
  doctors.forEach(doctor => {
    doctorStats.set(doctor.id, {
      '7h': 0,
      '17h': 0,
      total: 0,
      weekdays: Array(7).fill(0),
      thursdays: 0,
      lastGuardDate: null,
      assignedWeeks: new Set()
    });
  });

  // Agrupar días por semana
  const weeks = new Map<number, GuardDay[]>();
  guardDays.forEach(day => {
    const date = new Date(day.date);
    const week = getWeekNumber(date);
    if (!weeks.has(week)) weeks.set(week, []);
    weeks.get(week)!.push(day);
  });

  const unassignedDays: { date: string, shiftType: ShiftType }[] = [];

  for (const [weekNumber, days] of weeks.entries()) {
    for (const day of days) {
      if (!day.is_guard_day) continue;

      const date = new Date(day.date);
      const dayOfWeek = date.getDay();
      const isoDate = date.toISOString().split('T')[0];

      let shift17hCount = 0;

      for (const shiftType of ['7h', '17h', '17h'] as ShiftType[]) {
        let eligibleDoctors = doctors.filter(doctor => {
          const stats = doctorStats.get(doctor.id)!;
          const lastDate = stats.lastGuardDate ? new Date(stats.lastGuardDate) : null;
          const diffDays = lastDate ? (date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24) : Infinity;

          return (
            !doctor.unavailable_weekdays.includes(dayOfWeek) &&
            (shiftType === '7h' ? stats['7h'] < getMaxPerDoctor(doctors.length, guardDays, '7h', false) : stats['17h'] < getMaxPerDoctor(doctors.length, guardDays, '17h', false)) &&
            diffDays >= 2 &&
            !stats.assignedWeeks.has(weekNumber)
          );
        });

        // Si no hay elegibles, relajar la restricción de una asignación por semana
        if (eligibleDoctors.length === 0) {
          eligibleDoctors = doctors.filter(doctor => {
            const stats = doctorStats.get(doctor.id)!;
            const lastDate = stats.lastGuardDate ? new Date(stats.lastGuardDate) : null;
            const diffDays = lastDate ? (date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24) : Infinity;

            return (
              !doctor.unavailable_weekdays.includes(dayOfWeek) &&
              (shiftType === '7h' ? stats['7h'] < getMaxPerDoctor(doctors.length, guardDays, '7h', true) : stats['17h'] < getMaxPerDoctor(doctors.length, guardDays, '17h', true)) &&
              diffDays >= 2
            );
          });
        }

        // Si aún no hay elegibles, relajar la restricción de días consecutivos
        if (eligibleDoctors.length === 0) {
          eligibleDoctors = doctors.filter(doctor => {
            const stats = doctorStats.get(doctor.id)!;
            return (
              !doctor.unavailable_weekdays.includes(dayOfWeek) &&
              (shiftType === '7h' ? stats['7h'] < getMaxPerDoctor(doctors.length, guardDays, '7h', true) : stats['17h'] < getMaxPerDoctor(doctors.length, guardDays, '17h', true))
            );
          });
        }

        eligibleDoctors.sort((a, b) => {
          const sa = doctorStats.get(a.id)!;
          const sb = doctorStats.get(b.id)!;
          return (
            (sa[shiftType] - sb[shiftType]) ||
            (sa.total - sb.total)
          );
        });

        const selected = eligibleDoctors[0];
        if (selected) {
          const stats = doctorStats.get(selected.id)!;

          const shiftPosition = shiftType === '7h' ? 1 : (shift17hCount === 0 ? 1 : 2);
          if (shiftType === '17h') shift17hCount++;

          schedule.push({
            schedule_id: scheduleId,
            doctor_id: selected.id,
            date: isoDate,
            shift_type: shiftType,
            shift_position: shiftPosition,
            is_original: true
          });

          stats[shiftType]++;
          stats.total++;
          stats.weekdays[dayOfWeek]++;
          if (dayOfWeek === 4) stats.thursdays++;
          stats.lastGuardDate = isoDate;
          stats.assignedWeeks.add(weekNumber);
        } else {
          unassignedDays.push({ date: isoDate, shiftType });
        }
      }
    }
  }

  if (unassignedDays.length > 0) {
    console.warn("Días no asignados:");
    unassignedDays.forEach(d => console.warn('Fecha: ${d.date}, Turno: ${d.shiftType}'));
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
/*
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
    
    const schedule = [];
    const doctorStats = new Map<string, { '7h': number, '17h': number, thursdays: number, lastGuardDate: string | null }>();
    
    // Initialize doctor stats
    doctors.forEach(doctor => {
      doctorStats.set(doctor.id, { '7h': 0, '17h': 0, thursdays: 0, lastGuardDate: null });
    });
    
    // Helper function to check if a doctor is available
    const isDoctorAvailable = (doctor: Doctor, date: string, shiftType: '7h' | '17h'): boolean => {
      const dayOfWeek = new Date(date).getDay();
      const stats = doctorStats.get(doctor.id)!;
    
      if (doctor.unavailable_weekdays.includes(dayOfWeek)) return false;
      if (shiftType === '7h' && doctor.max_7h_guards !== null && stats['7h'] >= doctor.max_7h_guards) return false;
      if (shiftType === '17h' && doctor.max_17h_guards !== null && stats['17h'] >= doctor.max_17h_guards) return false;
      if (stats.lastGuardDate && new Date(date).getTime() - new Date(stats.lastGuardDate).getTime() < 24 * 60 * 60 * 1000) return false;
    
      return true;
    };
    
    // Assign guards
    guardDays.forEach(guardDay => {
      if (guardDay.is_guard_day) {
        const date = guardDay.date;
        const dayOfWeek = new Date(date).getDay();
    
        // Create shifts
        let assigned = false;
        for (let shiftType of ['7h', '17h', '17h'] as ('7h' | '17h')[]) {
          if (shiftType === '7h') assigned = false;
    
          for (let doctor of doctors) {
            if (isDoctorAvailable(doctor, date, shiftType)) {
              const shiftPosition = shiftType === '7h' ? 1 : (assigned ? 2 : 1);
              schedule.push({
                schedule_id: scheduleId,
                doctor_id: doctor.id,
                date: date,
                shift_type: shiftType,
                shift_position: shiftPosition,
                is_original: true
              });
    
              // Update stats
              const stats = doctorStats.get(doctor.id)!;
              stats[shiftType]++;
              if (dayOfWeek === 4) stats.thursdays++;
              stats.lastGuardDate = date;
    
              if (shiftType === '17h') assigned = true;
              break;
            }
          }
        }
      }
    });
    console.log(JSON.stringify(schedule));
    return schedule;
  };
*/
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