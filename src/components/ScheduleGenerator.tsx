import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  unavailable_weekdays: number[]; // 0..6
  max_7h_guards: number | null;
  max_17h_guards: number | null;
  // Fechas prohibidas (vacaciones aprobadas)
  unavailable_dates?: string[]; // "YYYY-MM-DD"
}

interface GuardDay {
  id: string;
  date: string; // "YYYY-MM-DD"
  is_guard_day: boolean;
}

interface GuardAssignment {
  doctor_id: string;
  date: string; // "YYYY-MM-DD"
  shift_type: string; // '7h' | '17h'
  is_original?: boolean;
}

interface Incompatibility {
  doctor_id: string;
  incompatible_doctor_id: string;
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
      // Doctores
      const { data: doctors, error: doctorsError } = await supabase
        .from("doctors")
        .select("*");
      if (doctorsError) throw doctorsError;

      // Incompatibilidades
      const { data: incompatibilities, error: incompError } = await supabase
        .from("doctor_incompatibilities")
        .select("doctor_id, incompatible_doctor_id");
      if (incompError) throw incompError;

      // Días del mes a cubrir
      const startDate = new Date(selectedYear, selectedMonth - 1, 1, 12);
      const endDate = new Date(selectedYear, selectedMonth, 0, 12);
      const { data: guardDays, error: guardDaysError } = await supabase
        .from("guard_days")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0])
        .eq("is_guard_day", true);
      if (guardDaysError) throw guardDaysError;

      // Histórico (máx. 12 meses) para equilibrio y frontera mes anterior
      const startDateStats = new Date(selectedYear, selectedMonth - 12, 1, 12);
      const endDateStats = new Date(selectedYear, selectedMonth, 0, 12);
      const { data: guardAssignments, error: guardAssignmentsError } = await supabase
        .from("guard_assignments")
        .select("*")
        .gte("date", startDateStats.toISOString().split("T")[0])
        .lte("date", endDateStats.toISOString().split("T")[0])
        .eq("is_original", true);
      if (guardAssignmentsError) throw guardAssignmentsError;

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

      // Vacaciones aprobadas -> fechas prohibidas por doctor
      const { data: leaves, error: leavesError } = await supabase
        .from("leave_requests")
        .select("doctor_id, start_date, end_date, status")
        .eq("status", "approved")
        .lte("start_date", endDate.toISOString().split("T")[0]) // inicio <= fin del mes
        .gte("end_date", startDate.toISOString().split("T")[0]); // fin >= inicio del mes
      if (leavesError) throw leavesError;

      const leaveDatesByDoctor = new Map<string, Set<string>>();
      if (leaves) {
        for (const row of leaves) {
          const s = new Date(row.start_date + "T00:00:00");
          const e = new Date(row.end_date + "T00:00:00");
          const from = new Date(Math.max(s.getTime(), new Date(startDate.toISOString().split("T")[0] + "T00:00:00").getTime()));
          const to = new Date(Math.min(e.getTime(), new Date(endDate.toISOString().split("T")[0] + "T00:00:00").getTime()));
          for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            const iso = d.toISOString().split("T")[0];
            if (!leaveDatesByDoctor.has(row.doctor_id)) leaveDatesByDoctor.set(row.doctor_id, new Set());
            leaveDatesByDoctor.get(row.doctor_id)!.add(iso);
          }
        }
      }

      // Enriquecer doctores con unavailable_dates (vacaciones)
      const doctorsWithLeaves: Doctor[] = (doctors as Doctor[]).map((d) => ({
        ...d,
        unavailable_dates: Array.from(leaveDatesByDoctor.get(d.id) || new Set<string>()),
      }));

      // Crear schedule
      const { data: schedule, error: scheduleError } = await supabase
        .from("guard_schedules")
        .insert({
          month: selectedMonth,
          year: selectedYear,
          status: "draft",
        })
        .select()
        .single();
      if (scheduleError) throw scheduleError;

      // Generar asignaciones (algoritmo justo)
      const assignments = generateAssignments(
        doctorsWithLeaves,
        guardDays as GuardDay[],
        schedule.id,
        guardAssignments as GuardAssignment[],
        (incompatibilities || []) as Incompatibility[],
        { month: selectedMonth, year: selectedYear }
      );

      // Guardar asignaciones
      const { error: assignmentsError } = await supabase
        .from("guard_assignments")
        .insert(assignments);
      if (assignmentsError) throw assignmentsError;

      setGeneratedSchedule({
        schedule,
        assignments,
        guardDays,
        doctors: doctorsWithLeaves,
        guardAssignments,
      });

      toast({
        title: "Schedule Generated",
        description: `Successfully generated schedule for ${
          MONTHS.find((m) => m.value === selectedMonth)?.label
        } ${selectedYear}`,
      });
    } catch (error) {
      console.error("Error generating schedule:", error);
      toast({
        title: "Error",
        description: "Failed to generate schedule",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Generate Guard Schedule v24
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Month</label>
              <Select
                value={selectedMonth?.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
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
              <Select
                value={selectedYear?.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
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
                  <strong>Month:</strong>{" "}
                  {MONTHS.find((m) => m.value === selectedMonth)?.label}
                </div>
                <div>
                  <strong>Year:</strong> {selectedYear}
                </div>
                <div>
                  <strong>Status:</strong> Draft
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Generated {generatedSchedule.assignments.length} guard assignments
                for {generatedSchedule.guardDays.length} guard days.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ======================
// LÓGICA DE ASIGNACIÓN
// ======================

type ShiftType = "7h" | "17h";
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom...4=Jue

function generateAssignments(
  doctors: Doctor[],
  guardDays: GuardDay[],
  scheduleId: string,
  guardAssignments: GuardAssignment[],
  incompatibilities: Incompatibility[],
  monthCtx: { month: number; year: number }
) {
  const SHIFTS: { type: ShiftType; position: 1 | 2 }[] = [
    { type: "7h", position: 1 }, // 7h siempre 1
    { type: "17h", position: 1 }, // 17h (1)
    { type: "17h", position: 2 }, // 17h (2)
  ];

  // Históricos (máx 12 meses) para equilibrio largo + set de fechas previas
  const history = buildHistory(doctors, guardAssignments, monthCtx.year);

  // Cuotas mensuales por tipo (respetando límites)
  const quotas = buildMonthlyQuotas(doctors, guardDays, history);
  const totalQuotaByDoctor = new Map<string, number>(
    doctors.map((d) => [
      d.id,
      (quotas.get(d.id)?.["7h"] || 0) + (quotas.get(d.id)?.["17h"] || 0),
    ])
  );

  // Mapa de incompatibilidades simétrico
  const incompatMap = toIncompatibilityMap(incompatibilities);

  // Contadores del mes
  const monthTypeCount: Record<ShiftType, Record<string, number>> = {
    "7h": {},
    "17h": {},
  };
  const monthTotalCount: Record<string, number> = {};
  const monthDOWCount: Record<DayOfWeek, Record<string, number>> = {
    0: {},
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
    6: {},
  };
  const assignedWeeksByDoctor = new Map<string, Set<number>>();
  // Partimos del histórico para “consecutivos” en frontera de mes
  const assignedDatesByDoctor = new Map<string, Set<string>>(
    Array.from(history.assignedDatesByDoctor.entries()).map(([k, v]) => [
      k,
      new Set(v),
    ])
  );

  for (const d of doctors) {
    monthTypeCount["7h"][d.id] = 0;
    monthTypeCount["17h"][d.id] = 0;
    monthTotalCount[d.id] = 0;
    for (let k = 0 as DayOfWeek; k <= 6; k = ((k + 1) as unknown) as DayOfWeek) {
      monthDOWCount[k][d.id] = 0;
    }
    if (!assignedDatesByDoctor.has(d.id))
      assignedDatesByDoctor.set(d.id, new Set<string>());
    assignedWeeksByDoctor.set(d.id, new Set<number>());
  }

  // Contador por semana: límite 1/semana (hard), 2/semana si no hay alternativa
  const weekCountByDoctor = new Map<number, Map<string, number>>();

  // Agrupar días por semana ISO
  const daysByWeek = groupByISOWeek(guardDays);

  // Frontera con mes anterior: día 1 entre semana
  const day1 = toISO(new Date(monthCtx.year, monthCtx.month - 1, 1, 12));
  const prevDate = getISODateOffset(day1, -1);
  const prevAssignmentsDay = new Set(
    guardAssignments.filter((a) => a.date === prevDate).map((a) => a.doctor_id)
  );

  const schedule: any[] = [];

  for (const [weekNumber, days] of daysByWeek) {
    if (!weekCountByDoctor.has(weekNumber))
      weekCountByDoctor.set(weekNumber, new Map());
    const weekMap = weekCountByDoctor.get(weekNumber)!;

    const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));

    for (const day of sortedDays) {
      if (!day.is_guard_day) continue;
      const iso = day.date;
      const dow = dowOf(iso);
      const todayAssigned = new Set<string>();

      for (const shift of SHIFTS) {
        const alreadyToday = schedule
          .filter((r) => r.date === iso)
          .map((r) => r.doctor_id);

        // A) Intento con 1/semana (hard). Permitimos exceder cuota para no romper 1/semana.
        let eligible = doctors.filter((doc) =>
          isEligible(
            doc,
            iso,
            dow,
            shift.type,
            quotas,
            monthTypeCount,
            assignedDatesByDoctor,
            todayAssigned,
            incompatMap,
            alreadyToday,
            weekNumber,
            assignedWeeksByDoctor,
            isWeekday(dow) && iso === day1 ? prevAssignmentsDay : undefined,
            { weekCap: 1, weekCountByDoctor: weekMap, allowExceedQuota: true }
          )
        );

        // B) Si no hay candidatos, 2/semana (soft)
        if (eligible.length === 0) {
          eligible = doctors.filter((doc) =>
            isEligible(
              doc,
              iso,
              dow,
              shift.type,
              quotas,
              monthTypeCount,
              assignedDatesByDoctor,
              todayAssigned,
              incompatMap,
              alreadyToday,
              weekNumber,
              assignedWeeksByDoctor,
              isWeekday(dow) && iso === day1 ? prevAssignmentsDay : undefined,
              { weekCap: 2, weekCountByDoctor: weekMap, allowExceedQuota: true }
            )
          );
        }

        // C) Último recurso: sin cap semanal, manteniendo hard rules
        if (eligible.length === 0) {
          eligible = doctors.filter((doc) =>
            isEligible(
              doc,
              iso,
              dow,
              shift.type,
              quotas,
              monthTypeCount,
              assignedDatesByDoctor,
              todayAssigned,
              incompatMap,
              alreadyToday,
              undefined,
              undefined,
              isWeekday(dow) && iso === day1 ? prevAssignmentsDay : undefined,
              { allowExceedQuota: true }
            )
          );
        }

        if (eligible.length === 0) continue;

        // Orden: déficit de tipo y total, DOW (con énfasis jueves), y menor carga semanal
        eligible.sort((a, b) =>
          compareCandidates(
            a,
            b,
            iso,
            dow,
            shift.type,
            quotas,
            totalQuotaByDoctor,
            monthTypeCount,
            monthTotalCount,
            monthDOWCount,
            history,
            weekMap,
            weekNumber
          )
        );

        const chosen = eligible[0];

        // Commit (shift_position correcto)
        schedule.push({
          schedule_id: scheduleId,
          doctor_id: chosen.id,
          date: iso,
          shift_type: shift.type,
          shift_position: shift.position, // ✅ 7h→1, 17h→1/2
          is_original: true,
        });

        // Actualizar contadores
        monthTypeCount[shift.type][chosen.id] =
          (monthTypeCount[shift.type][chosen.id] || 0) + 1;
        monthTotalCount[chosen.id] = (monthTotalCount[chosen.id] || 0) + 1;
        monthDOWCount[dow][chosen.id] =
          (monthDOWCount[dow][chosen.id] || 0) + 1;
        todayAssigned.add(chosen.id);
        assignedDatesByDoctor.get(chosen.id)!.add(iso);
        assignedWeeksByDoctor.get(chosen.id)!.add(weekNumber);
        weekMap.set(chosen.id, (weekMap.get(chosen.id) || 0) + 1);
      }
    }
  }

  return schedule;
}

// ---------- Comparador de candidatos (justicia máxima) ----------
function compareCandidates(
  a: Doctor,
  b: Doctor,
  iso: string,
  dow: DayOfWeek,
  type: ShiftType,
  quotas: Map<string, { "7h": number; "17h": number }>,
  totalQuotaByDoctor: Map<string, number>,
  mType: Record<ShiftType, Record<string, number>>,
  mTotal: Record<string, number>,
  mDOW: Record<DayOfWeek, Record<string, number>>,
  hist: ReturnType<typeof buildHistory>,
  weekMap: Map<string, number>,
  weekNumber: number
) {
  const qa = quotas.get(a.id)!;
  const qb = quotas.get(b.id)!;

  const aTypeAssigned = mType[type][a.id] || 0;
  const bTypeAssigned = mType[type][b.id] || 0;
  const aTypeQuota = qa[type] || 0;
  const bTypeQuota = qb[type] || 0;

  // 1) Déficit por tipo (mayor déficit => mejor)
  const aTypeDef = aTypeQuota - aTypeAssigned;
  const bTypeDef = bTypeQuota - bTypeAssigned;
  if (aTypeDef !== bTypeDef) return bTypeDef - aTypeDef;

  // 2) Déficit total mensual
  const aTotQuota = totalQuotaByDoctor.get(a.id) || 0;
  const bTotQuota = totalQuotaByDoctor.get(b.id) || 0;
  const aTotDef = aTotQuota - (mTotal[a.id] || 0);
  const bTotDef = bTotQuota - (mTotal[b.id] || 0);
  if (aTotDef !== bTotDef) return bTotDef - aTotDef;

  // 3) Equilibrio por DOW (corto)
  const aDowShort = mDOW[dow][a.id] || 0;
  const bDowShort = mDOW[dow][b.id] || 0;
  if (aDowShort !== bDowShort) return aDowShort - bDowShort;

  // 4) DOW “largo” del año actual + lo ya asignado este mes (para no distorsionar)
  const aDowLong = (hist.totalsByDOW[dow]?.[a.id] || 0) + (mDOW[dow][a.id] || 0);
  const bDowLong = (hist.totalsByDOW[dow]?.[b.id] || 0) + (mDOW[dow][b.id] || 0);
  if (aDowLong !== bDowLong) return aDowLong - bDowLong;

  // 5) Énfasis jueves
  if (dow === 4) {
    const aThuShort = mDOW[4][a.id] || 0;
    const bThuShort = mDOW[4][b.id] || 0;
    if (aThuShort !== bThuShort) return aThuShort - bThuShort;

    const aThuLong = (hist.totalsByDOW[4]?.[a.id] || 0) + (mDOW[4][a.id] || 0);
    const bThuLong = (hist.totalsByDOW[4]?.[b.id] || 0) + (mDOW[4][b.id] || 0);
    if (aThuLong !== bThuLong) return aThuLong - bThuLong;
  }

  // 6) Menor carga en la semana actual
  const aWeek = weekMap.get(a.id) || 0;
  const bWeek = weekMap.get(b.id) || 0;
  if (aWeek !== bWeek) return aWeek - bWeek;

  // 7) Desempate estable por id
  return a.id.localeCompare(b.id);
}

// ---------- Elegibilidad (hard) ----------
function isEligible(
  doc: Doctor,
  iso: string,
  dow: DayOfWeek,
  type: ShiftType,
  quotas: Map<string, { "7h": number; "17h": number }>,
  monthTypeCount: Record<ShiftType, Record<string, number>>,
  assignedDatesByDoctor: Map<string, Set<string>>,
  assignedToday: Set<string>,
  incompatibleMap: Map<string, Set<string>>,
  alreadyAssignedToday: string[],
  weekNumber?: number,
  assignedWeeksByDoctor?: Map<string, Set<number>>,
  forbiddenPrevDaySet?: Set<string>,
  opts?: {
    weekCap?: number;                      // máximo por semana
    weekCountByDoctor?: Map<string, number>;
    allowExceedQuota?: boolean;
  }
): boolean {
  // no dos turnos el mismo día
  if (assignedToday.has(doc.id)) return false;

  // indisponibilidad: weekdays
  if (doc.unavailable_weekdays?.includes(dow)) return false;

  // indisponibilidad: fechas concretas (vacaciones aprobadas)
  if (doc.unavailable_dates && doc.unavailable_dates.includes(iso)) return false;

  // no consecutivos
  const hadPrev = assignedDatesByDoctor.get(doc.id)?.has(getISODateOffset(iso, -1));
  const hadNext = assignedDatesByDoctor.get(doc.id)?.has(getISODateOffset(iso, 1));
  if (hadPrev || hadNext) return false;

  // frontera mes anterior (día 1 laborable)
  if (forbiddenPrevDaySet && forbiddenPrevDaySet.has(doc.id)) return false;

  // incompatibilidades con ya asignados hoy
  const incos = incompatibleMap.get(doc.id) || new Set<string>();
  for (const other of alreadyAssignedToday) {
    if (incos.has(other)) return false;
  }

  // límite por semana (cap)
  if (opts?.weekCap != null && opts.weekCountByDoctor) {
    const used = opts.weekCountByDoctor.get(doc.id) || 0;
    if (used >= opts.weekCap) return false;
  }

  // cuotas / límites
  const q = quotas.get(doc.id)!;
  const current = monthTypeCount[type][doc.id] || 0;
  if (!opts?.allowExceedQuota && current >= q[type]) return false;

  if (type === "7h" && doc.max_7h_guards != null && current >= doc.max_7h_guards) return false;
  if (type === "17h" && doc.max_17h_guards != null && current >= doc.max_17h_guards) return false;

  return true;
}

// ======================
// SUPPORT / HELPERS
// ======================

function buildHistory(
  doctors: Doctor[],
  histAssignments: GuardAssignment[],
  currentYear: number
) {
  const totalsByType: Record<ShiftType, Record<string, number>> = {
    "7h": {},
    "17h": {},
  };
  // DOW histórico SOLO del año actual (YTD), y como mucho 12 meses (ya lo limita la query)
  const totalsByDOW: Record<DayOfWeek, Record<string, number>> = {
    0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {},
  };
  const assignedDatesByDoctor = new Map<string, Set<string>>();

  for (const d of doctors) {
    totalsByType["7h"][d.id] = 0;
    totalsByType["17h"][d.id] = 0;
    for (let k = 0 as DayOfWeek; k <= 6; k = ((k + 1) as unknown) as DayOfWeek) {
      totalsByDOW[k][d.id] = 0;
    }
    assignedDatesByDoctor.set(d.id, new Set<string>());
  }

  for (const a of histAssignments) {
    // Tipos: usamos el histórico de la query (máx 12 meses)
    if (a.shift_type === "7h" || a.shift_type === "17h") {
      totalsByType[a.shift_type as ShiftType][a.doctor_id] =
        (totalsByType[a.shift_type as ShiftType][a.doctor_id] || 0) + 1;
    }
    // DOW: contar SOLO si pertenece al año actual del mes a generar
    const y = new Date(a.date + "T00:00:00").getFullYear();
    if (y === currentYear) {
      const d = dowOf(a.date) as DayOfWeek;
      totalsByDOW[d][a.doctor_id] = (totalsByDOW[d][a.doctor_id] || 0) + 1;
    }
    // Para consecutivos, mantenemos todas las fechas del histórico de 12m
    assignedDatesByDoctor.get(a.doctor_id)!.add(a.date);
  }

  return { totalsByType, totalsByDOW, assignedDatesByDoctor };
}

function buildMonthlyQuotas(
  doctors: Doctor[],
  guardDays: GuardDay[],
  hist: ReturnType<typeof buildHistory>
) {
  const totalDays = guardDays.filter((d) => d.is_guard_day).length;
  const total7 = totalDays;      // 1x7h/día
  const total17 = totalDays * 2; // 2x17h/día

  const base7 = Math.floor(total7 / doctors.length);
  const base17 = Math.floor(total17 / doctors.length);
  let extra7 = total7 % doctors.length;
  let extra17 = total17 % doctors.length;

  // Reparto de extras favoreciendo a quien menos histórico tenga (tipo)
  const by7 = [...doctors].sort(
    (a, b) => (hist.totalsByType["7h"][a.id] || 0) - (hist.totalsByType["7h"][b.id] || 0)
  );
  const by17 = [...doctors].sort(
    (a, b) => (hist.totalsByType["17h"][a.id] || 0) - (hist.totalsByType["17h"][b.id] || 0)
  );

  const quotas = new Map<string, { "7h": number; "17h": number }>();
  for (const d of doctors) quotas.set(d.id, { "7h": base7, "17h": base17 });

  for (let i = 0; i < extra7; i++) {
    const docId = by7[i % by7.length].id;
    quotas.get(docId)!['7h'] = (quotas.get(docId)!['7h'] || 0) + 1;
  }
  for (let i = 0; i < extra17; i++) {
    const docId = by17[i % by17.length].id;
    quotas.get(docId)!['17h'] = (quotas.get(docId)!['17h'] || 0) + 1;
  }

  // Respetar límites explícitos del doctor si existen
  for (const d of doctors) {
    const q = quotas.get(d.id)!;
    if (d.max_7h_guards != null) q["7h"] = Math.min(q["7h"], d.max_7h_guards);
    if (d.max_17h_guards != null) q["17h"] = Math.min(q["17h"], d.max_17h_guards);
  }

  return quotas;
}

function toIncompatibilityMap(rows: Incompatibility[]) {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.doctor_id)) map.set(r.doctor_id, new Set());
    if (!map.has(r.incompatible_doctor_id)) map.set(r.incompatible_doctor_id, new Set());
    map.get(r.doctor_id)!.add(r.incompatible_doctor_id);
    map.get(r.incompatible_doctor_id)!.add(r.doctor_id);
  }
  return map;
}

function groupByISOWeek(guardDays: GuardDay[]) {
  const map = new Map<number, GuardDay[]>();
  for (const day of guardDays) {
    const w = getWeekNumber(new Date(day.date));
    if (!map.has(w)) map.set(w, []);
    map.get(w)!.push(day);
  }
  // ordena por fecha dentro de la semana para determinismo
  for (const arr of map.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}

function dowOf(iso: string): DayOfWeek {
  return (new Date(iso + "T00:00:00").getDay() as unknown) as DayOfWeek;
}
function isWeekday(dow: DayOfWeek) {
  return dow >= 1 && dow <= 5;
}
function toISO(d: Date) {
  return d.toISOString().split("T")[0];
}

// === Helpers originales (los mantenemos) ===
function getWeekNumber(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISODateOffset(iso: string, offset: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}
