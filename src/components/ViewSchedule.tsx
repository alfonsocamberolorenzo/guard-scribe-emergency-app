import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Eye, Users, Clock, Edit, Save, X, Table } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO, getDaysInMonth, getDay } from "date-fns";

interface Schedule {
  id: string;
  month: number;
  year: number;
  status: string;
  generated_at: string;
  approved_at?: string;
}

interface Assignment {
  id: string;
  date: string;
  shift_type: string;
  shift_position: number;
  doctor_id: string;
  is_original: boolean;
  original_doctor_id?: string;
  doctor: {
    full_name: string;
    alias: string;
  };
}

interface LeaveRequest {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const ViewSchedule = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const { toast } = useToast();

  useEffect(() => {
    fetchSchedules();
    fetchDoctors();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('guard_schedules')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load schedules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, full_name, alias')
        .order('full_name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchAssignments = async (scheduleId: string) => {
    try {
      // First get assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('guard_assignments')
        .select('id, date, shift_type, shift_position, doctor_id, is_original, original_doctor_id')
        .eq('schedule_id', scheduleId)
        .order('date')
        .order('shift_type');

      if (assignmentsError) throw assignmentsError;

      // Then get doctors info  
      const doctorsData = doctors.length > 0 ? doctors : await fetchDoctorsData();

      // Combine the data
      const assignmentsWithDoctors = assignmentsData?.map(assignment => {
        const doctor = doctorsData?.find(d => d.id === assignment.doctor_id);
        return {
          ...assignment,
          doctor: {
            full_name: doctor?.full_name || 'Unknown',
            alias: doctor?.alias || 'N/A'
          }
        };
      }) || [];

      setAssignments(assignmentsWithDoctors);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule assignments",
        variant: "destructive",
      });
    }
  };

  const fetchDoctorsData = async () => {
    const { data, error } = await supabase
      .from('doctors')
      .select('id, full_name, alias');
    
    if (error) throw error;
    return data || [];
  };

  const fetchLeaveRequests = async (month: number, year: number) => {
    try {
      // Fetch leave requests for the selected month
      const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endOfMonth = new Date(year, month, 0);
      const endOfMonthStr = `${year}-${month.toString().padStart(2, '0')}-${endOfMonth.getDate().toString().padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('leave_requests')
        .select('id, doctor_id, start_date, end_date, status')
        .or(`start_date.lte.${endOfMonthStr},end_date.gte.${startOfMonth}`);

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  const handleScheduleSelect = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    fetchAssignments(schedule.id);
    fetchLeaveRequests(schedule.month, schedule.year);
    setSelectedDate(undefined);
    setEditingAssignment(null);
  };

  const startEditing = (assignment: Assignment) => {
    setEditingAssignment(assignment.id);
    setSelectedDoctorId(assignment.doctor_id);
  };

  const cancelEditing = () => {
    setEditingAssignment(null);
    setSelectedDoctorId("");
  };

  const saveAssignmentChange = async (assignmentId: string) => {
    if (!selectedDoctorId) return;

    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return;

      const updateData: any = {
        doctor_id: selectedDoctorId,
        is_original: selectedSchedule?.status === 'draft' ? true : false,
      };

      // Store original doctor only once
      if (!assignment.original_doctor_id) {
        updateData.original_doctor_id = assignment.doctor_id;
      }

      const { error } = await supabase
        .from('guard_assignments')
        .update(updateData)
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Assignment Updated",
        description: "The guard assignment has been updated successfully",
      });

      // Refresh assignments
      if (selectedSchedule) {
        fetchAssignments(selectedSchedule.id);
      }
      
      setEditingAssignment(null);
      setSelectedDoctorId("");
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive",
      });
    }
  };

  const approveSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('guard_schedules')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: "Schedule Approved",
        description: "The schedule has been approved successfully",
      });

      // Sync with Google Calendar
      try {
        const { error: syncError } = await supabase.functions.invoke('sync-google-calendar', {
          body: { scheduleId }
        });

        if (syncError) {
          console.error('Error syncing with Google Calendar:', syncError);
          toast({
            title: "Warning",
            description: "Schedule approved but Google Calendar sync failed",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Calendar Synced",
            description: "Schedule synchronized with Google Calendar",
          });
        }
      } catch (syncError) {
        console.error('Error calling sync function:', syncError);
      }

      fetchSchedules();
      if (selectedSchedule) {
        setSelectedSchedule({ ...selectedSchedule, status: 'approved' });
      }
    } catch (error) {
      console.error('Error approving schedule:', error);
      toast({
        title: "Error",
        description: "Failed to approve schedule",
        variant: "destructive",
      });
    }
  };

  const getAssignmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.filter(assignment => assignment.date === dateStr);
  };

  const renderTableView = () => {
    if (!selectedSchedule) return null;

    const year = selectedSchedule.year;
    const month = selectedSchedule.month;
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Create array of all days in the month
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateObj = new Date(year, month - 1, day);
      const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayAssignments = assignments.filter(a => a.date === date);
      const weekday = weekdayNames[getDay(dateObj)];
      
      const assignment_7h = dayAssignments.find(a => a.shift_type === '7h');
      const assignment_17h_1 = dayAssignments.find(a => a.shift_type === '17h' && a.shift_position === 1);
      const assignment_17h_2 = dayAssignments.find(a => a.shift_type === '17h' && a.shift_position === 2);
      
      return {
        day,
        weekday,
        date,
        assignment_7h,
        assignment_17h_1,
        assignment_17h_2,
        shift_7h: assignment_7h?.doctor.alias || '-',
        shift_17h_1: assignment_17h_1?.doctor.alias || '-',
        shift_17h_2: assignment_17h_2?.doctor.alias || '-',
        hasLeave_7h: assignment_7h ? getLeaveRequestStatus(assignment_7h.doctor_id, date) : null,
        hasLeave_17h_1: assignment_17h_1 ? getLeaveRequestStatus(assignment_17h_1.doctor_id, date) : null,
        hasLeave_17h_2: assignment_17h_2 ? getLeaveRequestStatus(assignment_17h_2.doctor_id, date) : null,
      };
    });

    const getCellClassName = (leaveStatus: string | null) => {
      if (leaveStatus === 'approved') return 'bg-red-100 text-red-800 border-red-300';
      if (leaveStatus === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      return '';
    };

    const renderEditableCell = (assignment: Assignment | undefined, dayData: any, shiftType: string) => {
      if (!assignment) return '-';
      
      const leaveStatus = shiftType === '7h' ? dayData.hasLeave_7h : 
                         shiftType === '17h_1' ? dayData.hasLeave_17h_1 : dayData.hasLeave_17h_2;
      
      return (
        <div className="flex items-center justify-center gap-1">
          {editingAssignment === assignment.id ? (
            <div className="flex items-center gap-1">
              <Select 
                value={selectedDoctorId} 
                onValueChange={setSelectedDoctorId}
              >
                <SelectTrigger className="w-20 h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {doctors
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))
                    .map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.alias}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                className="h-5 w-5 p-0"
                onClick={() => saveAssignmentChange(assignment.id)}
                disabled={!selectedDoctorId}
              >
                <Save className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-5 w-5 p-0"
                onClick={cancelEditing}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span>
                {assignment.doctor.alias}
                {!assignment.is_original && <span className="text-xs text-orange-600">*</span>}
              </span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-4 w-4 p-0 opacity-50 hover:opacity-100"
                onClick={() => startEditing(assignment)}
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          )}
          {leaveStatus === 'approved' && <span className="block text-xs text-red-600">(Leave)</span>}
          {leaveStatus === 'pending' && <span className="block text-xs text-yellow-600">(Pending)</span>}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <h4 className="font-medium">Monthly Schedule Table</h4>
        <div className="overflow-auto max-h-96 border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="p-2 text-left border-r font-medium">Day</th>
                <th className="p-2 text-center border-r font-medium">7h Shift</th>
                <th className="p-2 text-center border-r font-medium">17h Shift (1)</th>
                <th className="p-2 text-center font-medium">17h Shift (2)</th>
              </tr>
            </thead>
            <tbody>
              {monthDays.map((dayData) => (
                <tr key={dayData.day} className="border-b hover:bg-muted/50">
                  <td className="p-2 border-r font-medium">
                    <div className="flex flex-col">
                      <span>{dayData.day}</span>
                      <span className="text-xs text-muted-foreground">{dayData.weekday}</span>
                    </div>
                  </td>
                  <td className={`p-2 border-r text-center ${getCellClassName(dayData.hasLeave_7h)}`}>
                    {renderEditableCell(dayData.assignment_7h, dayData, '7h')}
                  </td>
                  <td className={`p-2 border-r text-center ${getCellClassName(dayData.hasLeave_17h_1)}`}>
                    {renderEditableCell(dayData.assignment_17h_1, dayData, '17h_1')}
                  </td>
                  <td className={`p-2 text-center ${getCellClassName(dayData.hasLeave_17h_2)}`}>
                    {renderEditableCell(dayData.assignment_17h_2, dayData, '17h_2')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'approved':
        return <Badge variant="default">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLeaveRequestStatus = (doctorId: string, date: string) => {
    const leaveRequest = leaveRequests.find(lr => 
      lr.doctor_id === doctorId && 
      date >= lr.start_date && 
      date <= lr.end_date
    );
    return leaveRequest?.status || null;
  };

  const getAssignmentStatusColor = (assignment: Assignment) => {
    const leaveStatus = getLeaveRequestStatus(assignment.doctor_id, assignment.date);
    if (leaveStatus === 'approved') return 'bg-red-100 border-red-300';
    if (leaveStatus === 'pending') return 'bg-yellow-100 border-yellow-300';
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5" />
        <h2 className="text-2xl font-bold">View Schedules</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedules List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Available Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No schedules generated yet
              </p>
            ) : (
              <div className="space-y-2">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                      selectedSchedule?.id === schedule.id ? 'bg-muted border-primary' : ''
                    }`}
                    onClick={() => handleScheduleSelect(schedule)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {MONTHS[schedule.month - 1]} {schedule.year}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Generated {format(parseISO(schedule.generated_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      {getStatusBadge(schedule.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {selectedSchedule ? 
                  `${MONTHS[selectedSchedule.month - 1]} ${selectedSchedule.year} Schedule` : 
                  'Select a Schedule'
                }
              </span>
              <div className="flex items-center gap-2">
                {selectedSchedule && (
                  <div className="flex items-center gap-1 border rounded-lg p-1">
                    <Button
                      size="sm"
                      variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                      onClick={() => setViewMode('calendar')}
                      className="h-7 px-2"
                    >
                      <CalendarDays className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      onClick={() => setViewMode('table')}
                      className="h-7 px-2"
                    >
                      <Table className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {selectedSchedule && selectedSchedule.status === 'draft' && (
                  <Button 
                    onClick={() => approveSchedule(selectedSchedule.id)}
                    size="sm"
                  >
                    Approve Schedule
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSchedule ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Status:</strong> {getStatusBadge(selectedSchedule.status)}
                  </div>
                  <div>
                    <strong>Total Assignments:</strong> {assignments.length}
                  </div>
                </div>

                {/* Calendar/Table View */}
                {viewMode === 'calendar' ? (
                  <>
                    {/* Calendar View */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Schedule Calendar</h4>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        month={new Date(selectedSchedule.year, selectedSchedule.month - 1)}
                        className="rounded-md border"
                      />
                    </div>

                    {/* Assignments for Selected Date */}
                    {selectedDate && (
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Assignments for {format(selectedDate, 'MMMM dd, yyyy')}
                        </h4>
                        {(() => {
                          const dayAssignments = getAssignmentsForDate(selectedDate);
                          return dayAssignments.length > 0 ? (
                            <div className="space-y-2">
                              {dayAssignments.map((assignment) => {
                                const leaveStatus = getLeaveRequestStatus(assignment.doctor_id, assignment.date);
                                return (
                                <div
                                  key={assignment.id}
                                  className={`flex items-center justify-between p-2 border rounded ${getAssignmentStatusColor(assignment)}`}
                                >
                                  <div className="flex-1">
                                    {editingAssignment === assignment.id ? (
                                      <div className="flex items-center gap-2">
                                        <Select 
                                          value={selectedDoctorId} 
                                          onValueChange={setSelectedDoctorId}
                                        >
                                          <SelectTrigger className="w-48">
                                            <SelectValue placeholder="Select doctor" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {doctors.map((doctor) => (
                                              <SelectItem key={doctor.id} value={doctor.id}>
                                                {doctor.full_name} ({doctor.alias})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button 
                                          size="sm" 
                                          onClick={() => saveAssignmentChange(assignment.id)}
                                          disabled={!selectedDoctorId}
                                        >
                                          <Save className="h-3 w-3" />
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={cancelEditing}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div>
                                          <p className="font-medium">{assignment.doctor.full_name}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {assignment.doctor.alias}
                                            {!assignment.is_original && (
                                              <span className="ml-2 text-xs text-orange-600">(Modified)</span>
                                            )}
                                            {leaveStatus === 'approved' && (
                                              <span className="ml-2 text-xs text-red-600 font-medium">(Leave Approved)</span>
                                            )}
                                            {leaveStatus === 'pending' && (
                                              <span className="ml-2 text-xs text-yellow-600 font-medium">(Leave Pending)</span>
                                            )}
                                          </p>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          onClick={() => startEditing(assignment)}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="outline">
                                    {assignment.shift_type} shift
                                  </Badge>
                                </div>
                              );
                              })}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm">
                              No assignments for this date
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </>
                ) : (
                  renderTableView()
                )}

                {/* All Assignments List - Only show in calendar view */}
                {viewMode === 'calendar' && (
                  <div className="space-y-2">
                    <h4 className="font-medium">All Assignments</h4>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {assignments.map((assignment) => {
                        const leaveStatus = getLeaveRequestStatus(assignment.doctor_id, assignment.date);
                        return (
                        <div
                          key={assignment.id}
                          className={`flex items-center justify-between p-2 text-sm border rounded ${getAssignmentStatusColor(assignment)}`}
                       >
                         <div className="flex-1">
                           {editingAssignment === assignment.id ? (
                             <div className="flex items-center gap-2">
                               <span className="font-medium min-w-16">
                                 {format(parseISO(assignment.date), 'MMM dd')}
                               </span>
                               <Select 
                                 value={selectedDoctorId} 
                                 onValueChange={setSelectedDoctorId}
                               >
                                 <SelectTrigger className="w-40">
                                   <SelectValue placeholder="Select doctor" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {doctors.map((doctor) => (
                                     <SelectItem key={doctor.id} value={doctor.id}>
                                       {doctor.alias}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                               <Button 
                                 size="sm" 
                                 onClick={() => saveAssignmentChange(assignment.id)}
                                 disabled={!selectedDoctorId}
                               >
                                 <Save className="h-3 w-3" />
                               </Button>
                               <Button 
                                 size="sm" 
                                 variant="outline" 
                                 onClick={cancelEditing}
                               >
                                 <X className="h-3 w-3" />
                               </Button>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2">
                               <span className="font-medium min-w-16">
                                 {format(parseISO(assignment.date), 'MMM dd')}
                               </span>
                               <span className="mx-2">-</span>
                                <span>
                                  {assignment.doctor.full_name}
                                  {!assignment.is_original && (
                                    <span className="ml-1 text-xs text-orange-600">(Modified)</span>
                                  )}
                                  {leaveStatus === 'approved' && (
                                    <span className="ml-1 text-xs text-red-600 font-medium">(Leave Approved)</span>
                                  )}
                                  {leaveStatus === 'pending' && (
                                    <span className="ml-1 text-xs text-yellow-600 font-medium">(Leave Pending)</span>
                                  )}
                                </span>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => startEditing(assignment)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {assignment.shift_type}
                          </Badge>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Select a schedule from the left to view details
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};