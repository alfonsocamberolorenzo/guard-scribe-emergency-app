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
  const doctorStats = new Map<string, {
    '7h': number,
    '17h': number,
    total: number,
    weekdays: number[],
    thursdays: number,
    lastGuardDate: string | null,
    assignedWeeks: Set<number>,
    '7h_init': number,
    '17h_init': number,
  }>();

  // Inicializar estadísticas
  doctors.forEach(doctor => {
    //TODO init historical stats
    const doctorHistoricalStats = guardAssignments.filter(e => e.doctor_id == doctor.id);
    let weekdays = Array(7).fill(0);
    doctorHistoricalStats.forEach(item => {
      weekdays[new Date(item.date).getDay()]++;
    });
    const lastGuardDate = doctorHistoricalStats.length > 0 ? doctorHistoricalStats.reduce((max, obj) => {
      return new Date(obj.date) > new Date (max.date) ? obj : max;
    }).date : null;
    doctorStats.set(doctor.id, {
      '7h': doctorHistoricalStats.filter(e => e.shift_type == '7h').length,
      '17h': doctorHistoricalStats.filter(e => e.shift_type == '17h').length,
      total: 0,
      weekdays: weekdays,
      thursdays: weekdays[3],
      lastGuardDate: lastGuardDate,
      assignedWeeks: new Set(),
      '7h_init': doctorHistoricalStats.filter(e => e.shift_type == '7h').length,
      '17h_init': doctorHistoricalStats.filter(e => e.shift_type == '17h').length
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

  // Build bidirectional incompatibility map
  const incompatibilityMap = new Map<string, Set<string>>();
  incompatibilities.forEach(item => {
    // Add both directions of the incompatibility
    if (!incompatibilityMap.has(item.doctor_id)) {
      incompatibilityMap.set(item.doctor_id, new Set());
    }
    if (!incompatibilityMap.has(item.incompatible_doctor_id)) {
      incompatibilityMap.set(item.incompatible_doctor_id, new Set());
    }
    
    incompatibilityMap.get(item.doctor_id)!.add(item.incompatible_doctor_id);
    incompatibilityMap.get(item.incompatible_doctor_id)!.add(item.doctor_id);
  });

  const unassignedDays: { date: string, shiftType: ShiftType }[] = [];

  for (const [weekNumber, days] of weeks.entries()) {
    for (const day of days) {
      if (!day.is_guard_day) continue;

      const date = new Date(day.date);
      const dayOfWeek = date.getDay();
      const isoDate = date.toISOString().split('T')[0];

      // Track doctors assigned on this date to check incompatibilities
      const assignedOnDate = new Set<string>();
      let shift17hCount = 0;

      for (const shiftType of ['7h', '17h', '17h'] as ShiftType[]) {
        let eligibleDoctors = doctors.filter(doctor => {
          const stats = doctorStats.get(doctor.id)!;
          const lastDate = stats.lastGuardDate ? new Date(stats.lastGuardDate) : null;
          const diffDays = lastDate ? (date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24) : Infinity;

          // Check if doctor is incompatible with already assigned doctors on this date
          const hasIncompatibleAssignment = Array.from(assignedOnDate).some(assignedId => 
            incompatibilityMap.get(doctor.id)?.has(assignedId)
          );

          return (
            !doctor.unavailable_weekdays.includes(dayOfWeek) &&
            (shiftType === '7h' ? stats['7h'] - stats['7h_init'] < getMaxPerDoctor(doctors.length, guardDays, '7h', false) : stats['17h'] - stats['17h_init'] < getMaxPerDoctor(doctors.length, guardDays, '17h', false)) &&
            diffDays >= 2 &&
            !stats.assignedWeeks.has(weekNumber) &&
            !hasIncompatibleAssignment
          );
        });

        // Si no hay elegibles, relajar la restricción de una asignación por semana
        if (eligibleDoctors.length === 0) {
          eligibleDoctors = doctors.filter(doctor => {
            const stats = doctorStats.get(doctor.id)!;
            const lastDate = stats.lastGuardDate ? new Date(stats.lastGuardDate) : null;
            const diffDays = lastDate ? (date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24) : Infinity;

            // Check incompatibilities even when relaxing week restriction
            const hasIncompatibleAssignment = Array.from(assignedOnDate).some(assignedId => 
              incompatibilityMap.get(doctor.id)?.has(assignedId)
            );

            return (
              !doctor.unavailable_weekdays.includes(dayOfWeek) &&
              (shiftType === '7h' ? stats['7h'] - stats['7h_init'] < getMaxPerDoctor(doctors.length, guardDays, '7h', true) : stats['17h'] - stats['17h_init'] < getMaxPerDoctor(doctors.length, guardDays, '17h', true)) &&
              diffDays >= 2 &&
              !hasIncompatibleAssignment
            );
          });
        }

        // Si aún no hay elegibles, relajar la restricción de días consecutivos
        if (eligibleDoctors.length === 0) {
          eligibleDoctors = doctors.filter(doctor => {
            const stats = doctorStats.get(doctor.id)!;
            
            // Still check incompatibilities even when relaxing day restrictions
            const hasIncompatibleAssignment = Array.from(assignedOnDate).some(assignedId => 
              incompatibilityMap.get(doctor.id)?.has(assignedId)
            );

            return (
              !doctor.unavailable_weekdays.includes(dayOfWeek) &&
              (shiftType === '7h' ? stats['7h'] - stats['7h_init'] < getMaxPerDoctor(doctors.length, guardDays, '7h', true) : stats['17h'] - stats['17h_init'] < getMaxPerDoctor(doctors.length, guardDays, '17h', true)) &&
              !hasIncompatibleAssignment
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
          
          // Track that this doctor is assigned on this date
          assignedOnDate.add(selected.id);
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

  

  // === TERCERA RONDA: Reasignación para balancear carga ===
  if (unassignedDays.length > 0) {
    const reassigned = [];

    for (const { date, shiftType } of unassignedDays) {
      const isoDate = date;
      const weekNumber = getWeekNumber(new Date(date));
      const dayOfWeek = new Date(date).getDay();

      // Buscar médicos con guardias ese día
      const assignedThatDay = schedule.filter(a => a.date === isoDate).map(a => a.doctor_id);
      const assignedThatWeek = schedule.filter(a => getWeekNumber(new Date(a.date)) === weekNumber).map(a => a.doctor_id);

      // Buscar médicos con guardias en otras semanas
      const candidates = doctors.filter(d => {
        const stats = doctorStats.get(d.id)!;
        return !d.unavailable_weekdays.includes(dayOfWeek) &&
               (shiftType === '7h' ? stats['7h'] - stats['7h_init'] < getMaxPerDoctor(doctors.length, guardDays, '7h', true)
                                   : stats['17h'] - stats['17h_init'] < getMaxPerDoctor(doctors.length, guardDays, '17h', true));
      });

      // Ordenar por menor carga total
      candidates.sort((a, b) => {
        const sa = doctorStats.get(a.id)!;
        const sb = doctorStats.get(b.id)!;
        return sa.total - sb.total;
      });

      for (const candidate of candidates) {
        const stats = doctorStats.get(candidate.id)!;

        // Buscar si tiene guardia en otra semana que pueda moverse
        const movable = schedule.find(a =>
          a.doctor_id === candidate.id &&
          getWeekNumber(new Date(a.date)) !== weekNumber &&
          a.shift_type === shiftType
        );

        if (movable) {
          // Reasignar la guardia original
          movable.doctor_id = "__REASSIGNED__";
          reassigned.push({ ...movable });

          // Asignar nueva guardia
          schedule.push({
            schedule_id: scheduleId,
            doctor_id: candidate.id,
            date: isoDate,
            shift_type: shiftType,
            shift_position: shiftType === '7h' ? 1 : 2,
            is_original: false
          });

          stats[shiftType]++;
          stats.total++;
          stats.assignedWeeks.add(weekNumber);
          break;
        }
      }
    }

    // Eliminar las guardias marcadas como "__REASSIGNED__"
    for (const r of reassigned) {
      const index = schedule.findIndex(a => a.date === r.date && a.doctor_id === "__REASSIGNED__" && a.shift_type === r.shift_type);
      if (index !== -1) schedule.splice(index, 1);
    }
  }

  // === CUARTA RONDA: Permitir doble guardia semanal (una de 7h y otra de 17h) ===
  if (unassignedDays.length > 0) {
    for (const { date, shiftType } of unassignedDays) {
      const isoDate = date;
      const weekNumber = getWeekNumber(new Date(date));
      const dayOfWeek = new Date(date).getDay();

      const candidates = doctors.filter(d => {
        const stats = doctorStats.get(d.id)!;
        const hasSameWeek = Array.from(schedule).some(a =>
          a.doctor_id === d.id &&
          getWeekNumber(new Date(a.date)) === weekNumber
        );

        const has7h = Array.from(schedule).some(a =>
          a.doctor_id === d.id &&
          getWeekNumber(new Date(a.date)) === weekNumber &&
          a.shift_type === '7h'
        );

        const has17h = Array.from(schedule).some(a =>
          a.doctor_id === d.id &&
          getWeekNumber(new Date(a.date)) === weekNumber &&
          a.shift_type === '17h'
        );

        const allowDouble = (shiftType === '7h' && !has7h) || (shiftType === '17h' && !has17h);

        return !d.unavailable_weekdays.includes(dayOfWeek) &&
               allowDouble &&
               (shiftType === '7h' ? stats['7h'] - stats['7h_init'] < getMaxPerDoctor(doctors.length, guardDays, '7h', true)
                                   : stats['17h'] - stats['17h_init'] < getMaxPerDoctor(doctors.length, guardDays, '17h', true));
      });

      candidates.sort((a, b) => {
        const sa = doctorStats.get(a.id)!;
        const sb = doctorStats.get(b.id)!;
        return sa.total - sb.total;
      });

      const selected = candidates[0];
      if (selected) {
        const stats = doctorStats.get(selected.id)!;
        schedule.push({
          schedule_id: scheduleId,
          doctor_id: selected.id,
          date: isoDate,
          shift_type: shiftType,
          shift_position: shiftType === '7h' ? 1 : 2,
          is_original: false
        });
        stats[shiftType]++;
        stats.total++;
        stats.assignedWeeks.add(weekNumber);
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