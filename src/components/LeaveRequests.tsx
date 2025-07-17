import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, FileText, Check, X, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
}

interface LeaveRequest {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  requested_at: string;
  reviewed_at?: string;
  notes?: string;
  doctor: {
    full_name: string;
    alias: string;
  };
}

export const LeaveRequests = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    doctor_id: '',
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch doctors
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, full_name, alias')
        .order('full_name');

      if (doctorsError) throw doctorsError;

      // Fetch leave requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('leave_requests')
        .select(`
          *,
          doctor:doctors(full_name, alias)
        `)
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;

      setDoctors(doctorsData || []);
      setLeaveRequests(requestsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.doctor_id || !formData.start_date || !formData.end_date) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.end_date < formData.start_date) {
      toast({
        title: "Invalid Dates",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          doctor_id: formData.doctor_id,
          start_date: format(formData.start_date, 'yyyy-MM-dd'),
          end_date: format(formData.end_date, 'yyyy-MM-dd'),
          reason: formData.reason,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Leave request has been submitted successfully",
      });

      setShowForm(false);
      setFormData({
        doctor_id: '',
        start_date: undefined,
        end_date: undefined,
        reason: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          notes
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Request Updated",
        description: `Leave request has been ${status}`,
      });

      fetchData();
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>;
      case 'approved':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600">
          <Check className="h-3 w-3" />
          Approved
        </Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <X className="h-3 w-3" />
          Rejected
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Leave Requests</h2>
        </div>
        
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Doctor</label>
                <Select value={formData.doctor_id} onValueChange={(value) => setFormData(prev => ({ ...prev, doctor_id: value }))}>
                  <SelectTrigger>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.start_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_date ? format(formData.start_date, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.start_date}
                        onSelect={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.end_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.end_date ? format(formData.end_date, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.end_date}
                        onSelect={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Reason</label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Enter reason for leave..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {leaveRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No leave requests submitted yet</p>
            </CardContent>
          </Card>
        ) : (
          leaveRequests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{request.doctor.full_name}</h4>
                      <span className="text-sm text-muted-foreground">({request.doctor.alias})</span>
                      {getStatusBadge(request.status)}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span>
                          <strong>From:</strong> {format(parseISO(request.start_date), 'MMM dd, yyyy')}
                        </span>
                        <span>
                          <strong>To:</strong> {format(parseISO(request.end_date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="mt-1">
                        <strong>Requested:</strong> {format(parseISO(request.requested_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>

                    {request.reason && (
                      <div className="text-sm">
                        <strong>Reason:</strong> {request.reason}
                      </div>
                    )}

                    {request.notes && (
                      <div className="text-sm">
                        <strong>Notes:</strong> {request.notes}
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateRequestStatus(request.id, 'approved')}
                        className="flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateRequestStatus(request.id, 'rejected')}
                        className="flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};