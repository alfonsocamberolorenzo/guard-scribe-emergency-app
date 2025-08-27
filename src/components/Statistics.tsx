import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, CalendarIcon, Eye, EyeOff } from "lucide-react";
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
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

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
          doctors!guard_assignments_doctor_id_fkey(full_name, alias)
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

  const handleSort = (key: string) => {
    const direction = sortConfig && sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const getSortedStatistics = () => {
    if (!sortConfig) return statistics;
    
    return [...statistics].sort((a, b) => {
      const aValue = (a as any)[sortConfig.key];
      const bValue = (b as any)[sortConfig.key];
      
      if (sortConfig.direction === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };

  const getColorForValue = (value: number, columnKey: string) => {
    if (statistics.length === 0) return '';
    
    const columnValues = statistics.map(stat => (stat as any)[columnKey]).filter(val => val > 0);
    if (columnValues.length === 0) return '';
    
    const min = Math.min(...columnValues);
    const max = Math.max(...columnValues);
    
    if (min === max) return '';
    
    // Normalize value between 0 and 1
    const normalized = (value - min) / (max - min);
    
    // Create color gradient from red to yellow to green
    let red, green, blue = 0;
    
    if (normalized < 0.5) {
      // Red to Yellow (first half)
      red = 255;
      green = Math.round(255 * (normalized * 2));
    } else {
      // Yellow to Green (second half)
      red = Math.round(255 * (2 - normalized * 2));
      green = 255;
    }
    
    return `rgb(${red}, ${green}, ${blue}, 0.3)`;
  };

  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return '↕️';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const toggleColumnVisibility = (columnGroup: string) => {
    const newHiddenColumns = new Set(hiddenColumns);
    if (hiddenColumns.has(columnGroup)) {
      newHiddenColumns.delete(columnGroup);
    } else {
      newHiddenColumns.add(columnGroup);
    }
    setHiddenColumns(newHiddenColumns);
  };

  const isColumnGroupVisible = (columnGroup: string) => !hiddenColumns.has(columnGroup);

  const isIndividualColumnVisible = (column: string) => !hiddenColumns.has(column);

  const dayColumns = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Guard Assignment Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Column Visibility Controls */}
          <div className="space-y-4">
            <Label>Column Visibility</Label>
            
            {/* Group Controls */}
            <div className="flex flex-wrap gap-2 border-b pb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleColumnVisibility('7h')}
                className="flex items-center gap-1"
              >
                {isColumnGroupVisible('7h') ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                All 7h Shifts
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleColumnVisibility('17h')}
                className="flex items-center gap-1"
              >
                {isColumnGroupVisible('17h') ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                All 17h Shifts
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleColumnVisibility('totals')}
                className="flex items-center gap-1"
              >
                {isColumnGroupVisible('totals') ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                All Totals
              </Button>
            </div>

            {/* Individual 7h Column Controls */}
            <div>
              <div className="text-sm font-medium mb-2">7h Shift Days:</div>
              <div className="flex flex-wrap gap-1">
                {dayColumns.map((day) => (
                  <Button
                    key={`7h_${day}`}
                    variant="outline"
                    size="sm"
                    onClick={() => toggleColumnVisibility(`shift_7h_${day}`)}
                    className="flex items-center gap-1 text-xs"
                  >
                    {isIndividualColumnVisible(`shift_7h_${day}`) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Individual 17h Column Controls */}
            <div>
              <div className="text-sm font-medium mb-2">17h Shift Days:</div>
              <div className="flex flex-wrap gap-1">
                {dayColumns.map((day) => (
                  <Button
                    key={`17h_${day}`}
                    variant="outline"
                    size="sm"
                    onClick={() => toggleColumnVisibility(`shift_17h_${day}`)}
                    className="flex items-center gap-1 text-xs"
                  >
                    {isIndividualColumnVisible(`shift_17h_${day}`) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Individual Total Column Controls */}
            <div>
              <div className="text-sm font-medium mb-2">Total Columns:</div>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleColumnVisibility('total_7h')}
                  className="flex items-center gap-1 text-xs"
                >
                  {isIndividualColumnVisible('total_7h') ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  7h Total
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleColumnVisibility('total_17h')}
                  className="flex items-center gap-1 text-xs"
                >
                  {isIndividualColumnVisible('total_17h') ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  17h Total
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleColumnVisibility('total_guards')}
                  className="flex items-center gap-1 text-xs"
                >
                  {isIndividualColumnVisible('total_guards') ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Grand Total
                </Button>
              </div>
            </div>
          </div>
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

          {/* Date Range Shortcuts */}
          <div className="space-y-2">
            <Label>Quick Date Ranges</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setStartDate(firstDay);
                  setEndDate(lastDay);
                }}
              >
                Current Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), 0, 1);
                  const lastDay = new Date(now.getFullYear(), 11, 31);
                  setStartDate(firstDay);
                  setEndDate(lastDay);
                }}
              >
                Current Year
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
                  const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                  setStartDate(twelveMonthsAgo);
                  setEndDate(lastMonth);
                }}
              >
                Last 12 Months
              </Button>
            </div>
            
            {/* Quarter Shortcuts */}
            <div className="space-y-2">
              <Label className="text-sm">Current Year Quarters</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    setStartDate(new Date(year, 0, 1)); // January 1
                    setEndDate(new Date(year, 2, 31)); // March 31
                  }}
                >
                  Q1 (Jan-Mar)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    setStartDate(new Date(year, 3, 1)); // April 1
                    setEndDate(new Date(year, 5, 30)); // June 30
                  }}
                >
                  Q2 (Apr-Jun)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    setStartDate(new Date(year, 6, 1)); // July 1
                    setEndDate(new Date(year, 8, 30)); // September 30
                  }}
                >
                  Q3 (Jul-Sep)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    setStartDate(new Date(year, 9, 1)); // October 1
                    setEndDate(new Date(year, 11, 31)); // December 31
                  }}
                >
                  Q4 (Oct-Dec)
                </Button>
              </div>
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
                    {(isColumnGroupVisible('7h') || dayColumns.some(day => isIndividualColumnVisible(`shift_7h_${day}`))) && 
                      <TableHead colSpan={dayColumns.filter(day => isIndividualColumnVisible(`shift_7h_${day}`)).length} className="text-center border-r">7h Shifts</TableHead>}
                    {(isColumnGroupVisible('17h') || dayColumns.some(day => isIndividualColumnVisible(`shift_17h_${day}`))) && 
                      <TableHead colSpan={dayColumns.filter(day => isIndividualColumnVisible(`shift_17h_${day}`)).length} className="text-center border-r">17h Shifts</TableHead>}
                    {(isColumnGroupVisible('totals') || ['total_7h', 'total_17h', 'total_guards'].some(col => isIndividualColumnVisible(col))) && 
                      <TableHead colSpan={['total_7h', 'total_17h', 'total_guards'].filter(col => isIndividualColumnVisible(col)).length} className="text-center">Totals</TableHead>}
                  </TableRow>
                  <TableRow>
                    {(isColumnGroupVisible('7h') || dayColumns.some(day => isIndividualColumnVisible(`shift_7h_${day}`))) && (
                      <>
                        {isIndividualColumnVisible('shift_7h_monday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_7h_monday')}
                          >
                            Mon {getSortIcon('shift_7h_monday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_7h_tuesday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_7h_tuesday')}
                          >
                            Tue {getSortIcon('shift_7h_tuesday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_7h_wednesday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_7h_wednesday')}
                          >
                            Wed {getSortIcon('shift_7h_wednesday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_7h_thursday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_7h_thursday')}
                          >
                            Thu {getSortIcon('shift_7h_thursday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_7h_friday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_7h_friday')}
                          >
                            Fri {getSortIcon('shift_7h_friday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_7h_saturday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_7h_saturday')}
                          >
                            Sat {getSortIcon('shift_7h_saturday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_7h_sunday') && (
                          <TableHead 
                            className="text-xs border-r cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_7h_sunday')}
                          >
                            Sun {getSortIcon('shift_7h_sunday')}
                          </TableHead>
                        )}
                      </>
                    )}
                    {(isColumnGroupVisible('17h') || dayColumns.some(day => isIndividualColumnVisible(`shift_17h_${day}`))) && (
                      <>
                        {isIndividualColumnVisible('shift_17h_monday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_17h_monday')}
                          >
                            Mon {getSortIcon('shift_17h_monday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_17h_tuesday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_17h_tuesday')}
                          >
                            Tue {getSortIcon('shift_17h_tuesday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_17h_wednesday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_17h_wednesday')}
                          >
                            Wed {getSortIcon('shift_17h_wednesday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_17h_thursday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_17h_thursday')}
                          >
                            Thu {getSortIcon('shift_17h_thursday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_17h_friday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_17h_friday')}
                          >
                            Fri {getSortIcon('shift_17h_friday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_17h_saturday') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_17h_saturday')}
                          >
                            Sat {getSortIcon('shift_17h_saturday')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('shift_17h_sunday') && (
                          <TableHead 
                            className="text-xs border-r cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('shift_17h_sunday')}
                          >
                            Sun {getSortIcon('shift_17h_sunday')}
                          </TableHead>
                        )}
                      </>
                    )}
                    {(isColumnGroupVisible('totals') || ['total_7h', 'total_17h', 'total_guards'].some(col => isIndividualColumnVisible(col))) && (
                      <>
                        {isIndividualColumnVisible('total_7h') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('total_7h')}
                          >
                            7h {getSortIcon('total_7h')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('total_17h') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('total_17h')}
                          >
                            17h {getSortIcon('total_17h')}
                          </TableHead>
                        )}
                        {isIndividualColumnVisible('total_guards') && (
                          <TableHead 
                            className="text-xs cursor-pointer hover:bg-muted/50" 
                            onClick={() => handleSort('total_guards')}
                          >
                            Total {getSortIcon('total_guards')}
                          </TableHead>
                        )}
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedStatistics().map((stat) => (
                    <TableRow key={stat.doctor_id}>
                      <TableCell className="font-medium border-r">
                        {stat.doctor_alias}
                      </TableCell>
                      {(isColumnGroupVisible('7h') || dayColumns.some(day => isIndividualColumnVisible(`shift_7h_${day}`))) && (
                        <>
                          {isIndividualColumnVisible('shift_7h_monday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_7h_monday, 'shift_7h_monday') }}
                            >
                              {stat.shift_7h_monday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_7h_tuesday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_7h_tuesday, 'shift_7h_tuesday') }}
                            >
                              {stat.shift_7h_tuesday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_7h_wednesday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_7h_wednesday, 'shift_7h_wednesday') }}
                            >
                              {stat.shift_7h_wednesday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_7h_thursday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_7h_thursday, 'shift_7h_thursday') }}
                            >
                              {stat.shift_7h_thursday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_7h_friday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_7h_friday, 'shift_7h_friday') }}
                            >
                              {stat.shift_7h_friday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_7h_saturday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_7h_saturday, 'shift_7h_saturday') }}
                            >
                              {stat.shift_7h_saturday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_7h_sunday') && (
                            <TableCell 
                              className="text-center border-r" 
                              style={{ backgroundColor: getColorForValue(stat.shift_7h_sunday, 'shift_7h_sunday') }}
                            >
                              {stat.shift_7h_sunday}
                            </TableCell>
                          )}
                        </>
                      )}
                      {(isColumnGroupVisible('17h') || dayColumns.some(day => isIndividualColumnVisible(`shift_17h_${day}`))) && (
                        <>
                          {isIndividualColumnVisible('shift_17h_monday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_17h_monday, 'shift_17h_monday') }}
                            >
                              {stat.shift_17h_monday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_17h_tuesday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_17h_tuesday, 'shift_17h_tuesday') }}
                            >
                              {stat.shift_17h_tuesday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_17h_wednesday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_17h_wednesday, 'shift_17h_wednesday') }}
                            >
                              {stat.shift_17h_wednesday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_17h_thursday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_17h_thursday, 'shift_17h_thursday') }}
                            >
                              {stat.shift_17h_thursday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_17h_friday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_17h_friday, 'shift_17h_friday') }}
                            >
                              {stat.shift_17h_friday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_17h_saturday') && (
                            <TableCell 
                              className="text-center" 
                              style={{ backgroundColor: getColorForValue(stat.shift_17h_saturday, 'shift_17h_saturday') }}
                            >
                              {stat.shift_17h_saturday}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('shift_17h_sunday') && (
                            <TableCell 
                              className="text-center border-r" 
                              style={{ backgroundColor: getColorForValue(stat.shift_17h_sunday, 'shift_17h_sunday') }}
                            >
                              {stat.shift_17h_sunday}
                            </TableCell>
                          )}
                        </>
                      )}
                      {(isColumnGroupVisible('totals') || ['total_7h', 'total_17h', 'total_guards'].some(col => isIndividualColumnVisible(col))) && (
                        <>
                          {isIndividualColumnVisible('total_7h') && (
                            <TableCell 
                              className="text-center font-medium" 
                              style={{ backgroundColor: getColorForValue(stat.total_7h, 'total_7h') }}
                            >
                              {stat.total_7h}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('total_17h') && (
                            <TableCell 
                              className="text-center font-medium" 
                              style={{ backgroundColor: getColorForValue(stat.total_17h, 'total_17h') }}
                            >
                              {stat.total_17h}
                            </TableCell>
                          )}
                          {isIndividualColumnVisible('total_guards') && (
                            <TableCell 
                              className="text-center font-bold" 
                              style={{ backgroundColor: getColorForValue(stat.total_guards, 'total_guards') }}
                            >
                              {stat.total_guards}
                            </TableCell>
                          )}
                        </>
                      )}
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