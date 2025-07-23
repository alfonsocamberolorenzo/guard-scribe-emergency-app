import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, FileText, Check, X, Clock, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  has_substitute?: boolean;
  substitute_name?: string;
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
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<LeaveRequest | null>(null);
  const [formData, setFormData] = useState({
    doctor_id: '',
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    reason: '',
    customReason: '',
    has_substitute: false,
    substitute_name: ''
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

  const leaveReasons = [
    "Vacaciones",
    "Libre disposición", 
    "Enfermedad de familiar",
    "Enfermedad sin ILT",
    "ILT",
    "Formación",
    "Otros"
  ];

  const startEdit = (request: LeaveRequest) => {
    setEditingRequest(request);
    const isCustomReason = !leaveReasons.slice(0, -1).includes(request.reason || '');
    setFormData({
      doctor_id: request.doctor_id,
      start_date: parseISO(request.start_date),
      end_date: parseISO(request.end_date),
      reason: isCustomReason ? 'Otros' : (request.reason || ''),
      customReason: isCustomReason ? (request.reason || '') : '',
      has_substitute: request.has_substitute || false,
      substitute_name: request.substitute_name || ''
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingRequest(null);
    setFormData({
      doctor_id: '',
      start_date: undefined,
      end_date: undefined,
      reason: '',
      customReason: '',
      has_substitute: false,
      substitute_name: ''
    });
    setShowForm(false);
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
      const requestData = {
        doctor_id: formData.doctor_id,
        start_date: format(formData.start_date, 'yyyy-MM-dd'),
        end_date: format(formData.end_date, 'yyyy-MM-dd'),
        reason: formData.reason === 'Otros' ? formData.customReason : formData.reason,
        has_substitute: formData.has_substitute,
        substitute_name: formData.has_substitute ? formData.substitute_name : null,
        status: editingRequest ? editingRequest.status : 'pending'
      };

      let error;
      
      if (editingRequest) {
        ({ error } = await supabase
          .from('leave_requests')
          .update(requestData)
          .eq('id', editingRequest.id));
      } else {
        ({ error } = await supabase
          .from('leave_requests')
          .insert({ ...requestData, status: 'pending' }));
      }

      if (error) throw error;

      toast({
        title: editingRequest ? "Request Updated" : "Request Submitted",
        description: editingRequest 
          ? "Leave request has been updated successfully"
          : "Leave request has been submitted successfully",
      });

      setShowForm(false);
      setEditingRequest(null);
      setFormData({
        doctor_id: '',
        start_date: undefined,
        end_date: undefined,
        reason: '',
        customReason: '',
        has_substitute: false,
        substitute_name: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: "Error",
        description: editingRequest 
          ? "Failed to update leave request"
          : "Failed to submit leave request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRequest) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', deleteRequest.id);

      if (error) throw error;

      toast({
        title: "Request Deleted",
        description: "Leave request has been deleted successfully",
      });

      setDeleteRequest(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast({
        title: "Error",
        description: "Failed to delete leave request",
        variant: "destructive",
      });
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
        
        <Dialog open={showForm} onOpenChange={(open) => {
          if (!open) {
            cancelEdit();
          } else {
            setShowForm(true);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRequest ? 'Edit Leave Request' : 'Submit Leave Request'}
              </DialogTitle>
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
                <Select value={formData.reason} onValueChange={(value) => setFormData(prev => ({ ...prev, reason: value, customReason: value === 'Otros' ? prev.customReason : '' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.reason === 'Otros' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Specify other reason</label>
                  <Textarea
                    value={formData.customReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                    placeholder="Enter custom reason..."
                    rows={3}
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="has_substitute"
                    checked={formData.has_substitute}
                    onCheckedChange={(checked) => setFormData(prev => ({ 
                      ...prev, 
                      has_substitute: checked as boolean,
                      substitute_name: checked ? prev.substitute_name : ''
                    }))}
                  />
                  <label htmlFor="has_substitute" className="text-sm font-medium">
                    Do you have a substitute?
                  </label>
                </div>

                {formData.has_substitute && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Substitute Name</label>
                    <Input
                      value={formData.substitute_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, substitute_name: e.target.value }))}
                      placeholder="Enter substitute name..."
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={cancelEdit} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? (editingRequest ? "Updating..." : "Submitting...") : (editingRequest ? "Update Request" : "Submit Request")}
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

                    {request.has_substitute && request.substitute_name && (
                      <div className="text-sm">
                        <strong>Substitute:</strong> {request.substitute_name}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {/* Edit and Delete buttons for all requests */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(request)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteRequest(request)}
                      className="flex items-center gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>

                    {/* Approve/Reject buttons only for pending requests */}
                    {request.status === 'pending' && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteRequest} onOpenChange={() => setDeleteRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave request for {deleteRequest?.doctor.full_name}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};