import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
}

interface GuardStatistics {
  doctor_id: string;
  doctor_name: string;
  doctor_alias: string;
  shift_7h_monday: number;
  shift_7h_tuesday: number;
  shift_7h_wednesday: number;
  shift_7h_thursday: number;
  shift_7h_friday: number;
  shift_7h_saturday: number;
  shift_7h_sunday: number;
  shift_17h_monday: number;
  shift_17h_tuesday: number;
  shift_17h_wednesday: number;
  shift_17h_thursday: number;
  shift_17h_friday: number;
  shift_17h_saturday: number;
  shift_17h_sunday: number;
  total_7h: number;
  total_17h: number;
  total_guards: number;
}

export function Statistics() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [statistics, setStatistics] = useState<GuardStatistics[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  // Set up real-time subscription for guard assignments
  useEffect(() => {
    const channel = supabase
      .channel('guard-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'guard_assignments'
        },
        () => {
          // Auto-refresh statistics when guard assignments change
          if (startDate && endDate && selectedDoctors.length > 0) {
            fetchStatistics();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startDate, endDate, selectedDoctors]);

  // Auto-generate statistics when filters change
  useEffect(() => {
    if (startDate && endDate && selectedDoctors.length > 0) {
      fetchStatistics();
    }
  }, [startDate, endDate, selectedDoctors]);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, full_name, alias')
        .order('full_name');

      if (error) throw error;
      setDoctors(data || []);
      setSelectedDoctors(data?.map(d => d.id) || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchStatistics = async () => {
    if (!startDate || !endDate || selectedDoctors.length === 0) return;

    setLoading(true);
    try {
      const { data: assignments, error } = await supabase
        .from('guard_assignments')
        .select(`
          doctor_id,
          date,
          shift_type,
          doctors!inner(full_name, alias)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .in('doctor_id', selectedDoctors)
        .eq('is_original', true); // Only include original assignments

      if (error) throw error;

      // Process the data to create statistics
      const statsMap = new Map<string, GuardStatistics>();

      assignments?.forEach((assignment: any) => {
        const doctorId = assignment.doctor_id;
        const assignmentDate = new Date(assignment.date);
        const dayOfWeek = assignmentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const shiftType = assignment.shift_type;

        if (!statsMap.has(doctorId)) {
          statsMap.set(doctorId, {
            doctor_id: doctorId,
            doctor_name: assignment.doctors.full_name,
            doctor_alias: assignment.doctors.alias,
            shift_7h_monday: 0,
            shift_7h_tuesday: 0,
            shift_7h_wednesday: 0,
            shift_7h_thursday: 0,
            shift_7h_friday: 0,
            shift_7h_saturday: 0,
            shift_7h_sunday: 0,
            shift_17h_monday: 0,
            shift_17h_tuesday: 0,
            shift_17h_wednesday: 0,
            shift_17h_thursday: 0,
            shift_17h_friday: 0,
            shift_17h_saturday: 0,
            shift_17h_sunday: 0,
            total_7h: 0,
            total_17h: 0,
            total_guards: 0,
          });
        }

        const stats = statsMap.get(doctorId)!;
        
        // Map day of week to the corresponding field
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        if (shiftType === '7h') {
          (stats as any)[`shift_7h_${dayName}`]++;
          stats.total_7h++;
        } else if (shiftType === '17h') {
          (stats as any)[`shift_17h_${dayName}`]++;
          stats.total_17h++;
        }
        
        stats.total_guards++;
      });

      setStatistics(Array.from(statsMap.values()).sort((a, b) => a.doctor_name.localeCompare(b.doctor_name)));
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSelection = (doctorId: string, checked: boolean) => {
    if (checked) {
      setSelectedDoctors([...selectedDoctors, doctorId]);
    } else {
      setSelectedDoctors(selectedDoctors.filter(id => id !== doctorId));
    }
  };

  const selectAllDoctors = () => {
    setSelectedDoctors(doctors.map(d => d.id));
  };

  const deselectAllDoctors = () => {
    setSelectedDoctors([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Guard Assignment Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick an end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Doctor Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Doctor Selection</Label>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={selectAllDoctors}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllDoctors}>
                  Deselect All
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-48 overflow-y-auto border rounded-md p-4">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={doctor.id}
                    checked={selectedDoctors.includes(doctor.id)}
                    onCheckedChange={(checked) => 
                      handleDoctorSelection(doctor.id, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={doctor.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {doctor.alias}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={fetchStatistics} 
            disabled={!startDate || !endDate || selectedDoctors.length === 0 || loading}
            className="w-full"
          >
            {loading ? "Updating Statistics..." : "Refresh Statistics"}
          </Button>
          
          {startDate && endDate && selectedDoctors.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Statistics update automatically when schedules are modified
            </p>
          )}
        </CardContent>
      </Card>

      {/* Statistics Table */}
      {statistics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Guard Assignment Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="border-r">Doctor</TableHead>
                    <TableHead colSpan={7} className="text-center border-r">7h Shifts</TableHead>
                    <TableHead colSpan={7} className="text-center border-r">17h Shifts</TableHead>
                    <TableHead colSpan={3} className="text-center">Totals</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-xs">Mon</TableHead>
                    <TableHead className="text-xs">Tue</TableHead>
                    <TableHead className="text-xs">Wed</TableHead>
                    <TableHead className="text-xs">Thu</TableHead>
                    <TableHead className="text-xs">Fri</TableHead>
                    <TableHead className="text-xs">Sat</TableHead>
                    <TableHead className="text-xs border-r">Sun</TableHead>
                    <TableHead className="text-xs">Mon</TableHead>
                    <TableHead className="text-xs">Tue</TableHead>
                    <TableHead className="text-xs">Wed</TableHead>
                    <TableHead className="text-xs">Thu</TableHead>
                    <TableHead className="text-xs">Fri</TableHead>
                    <TableHead className="text-xs">Sat</TableHead>
                    <TableHead className="text-xs border-r">Sun</TableHead>
                    <TableHead className="text-xs">7h</TableHead>
                    <TableHead className="text-xs">17h</TableHead>
                    <TableHead className="text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statistics.map((stat) => (
                    <TableRow key={stat.doctor_id}>
                      <TableCell className="font-medium border-r">
                        {stat.doctor_alias}
                      </TableCell>
                      <TableCell className="text-center">{stat.shift_7h_monday}</TableCell>
                      <TableCell className="text-center">{stat.shift_7h_tuesday}</TableCell>
                      <TableCell className="text-center">{stat.shift_7h_wednesday}</TableCell>
                      <TableCell className="text-center">{stat.shift_7h_thursday}</TableCell>
                      <TableCell className="text-center">{stat.shift_7h_friday}</TableCell>
                      <TableCell className="text-center">{stat.shift_7h_saturday}</TableCell>
                      <TableCell className="text-center border-r">{stat.shift_7h_sunday}</TableCell>
                      <TableCell className="text-center">{stat.shift_17h_monday}</TableCell>
                      <TableCell className="text-center">{stat.shift_17h_tuesday}</TableCell>
                      <TableCell className="text-center">{stat.shift_17h_wednesday}</TableCell>
                      <TableCell className="text-center">{stat.shift_17h_thursday}</TableCell>
                      <TableCell className="text-center">{stat.shift_17h_friday}</TableCell>
                      <TableCell className="text-center">{stat.shift_17h_saturday}</TableCell>
                      <TableCell className="text-center border-r">{stat.shift_17h_sunday}</TableCell>
                      <TableCell className="text-center font-medium">{stat.total_7h}</TableCell>
                      <TableCell className="text-center font-medium">{stat.total_17h}</TableCell>
                      <TableCell className="text-center font-bold">{stat.total_guards}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}