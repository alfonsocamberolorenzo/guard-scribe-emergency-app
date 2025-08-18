import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { DoctorForm } from "@/components/DoctorForm";
import { DoctorList } from "@/components/DoctorList";
import { CalendarConfig } from "@/components/CalendarConfig";
import { ScheduleGenerator } from "@/components/ScheduleGenerator";
import { ViewSchedule } from "@/components/ViewSchedule";
import { LeaveRequests } from "@/components/LeaveRequests";
import { Statistics } from "@/components/Statistics";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { UserManagement } from "@/components/UserManagement";
import { Loader2 } from "lucide-react";

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
  unavailable_weekdays: number[];
  max_7h_guards: number | null;
  max_17h_guards: number | null;
}

const Index = () => {
  const { isAuthenticated, isLoading, isEditor, isViewer } = useAuth();
  const navigate = useNavigate();
  
  // Default view based on user role
  const getDefaultView = () => {
    if (isEditor) return 'doctors';
    if (isViewer) return 'view-schedule';
    return 'view-schedule';
  };

  const [currentView, setCurrentView] = useState(getDefaultView());
  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | undefined>();
  const [allDoctorsList, setAllDoctorsList] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Update default view when auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentView(getDefaultView());
    }
  }, [isAuthenticated, isEditor, isViewer]);

  // Redirect to auth page if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  const handleAddDoctor = (allDoctors: Doctor[]) => {
    setEditingDoctor(undefined);
    setShowForm(true);
    setAllDoctorsList(allDoctors);
  };

  const handleEditDoctor = (doctor: Doctor, allDoctors: Doctor[]) => {
    setEditingDoctor(doctor);
    setShowForm(true);
    setAllDoctorsList(allDoctors);
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingDoctor(undefined);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDoctor(undefined);
  };

  const handleViewChange = (view: string) => {
    // Restrict access based on user role
    const allowedViews = isEditor 
      ? ['doctors', 'calendar-config', 'schedule-generator', 'view-schedule', 'leave-requests', 'statistics', 'user-management']
      : ['view-schedule', 'statistics'];
    
    if (allowedViews.includes(view)) {
      setCurrentView(view);
      // Reset form state when switching views
      setShowForm(false);
      setEditingDoctor(undefined);
    }
  };

  const renderContent = () => {
    // Editor-only sections
    if (!isEditor && ['doctors', 'calendar-config', 'schedule-generator', 'leave-requests', 'user-management'].includes(currentView)) {
      return (
        <div className="p-6 text-center">
          <p className="text-muted-foreground">You don't have permission to access this section.</p>
        </div>
      );
    }

    switch (currentView) {
      case 'doctors':
        if (showForm) {
          return (
            <div className="flex justify-center">
              <DoctorForm
                doctor={editingDoctor}
                onSave={handleSave}
                onCancel={handleCancel}
                allDoctors={allDoctorsList}
              />
            </div>
          );
        }
        return (
          <DoctorList
            onAddDoctor={handleAddDoctor}
            onEditDoctor={handleEditDoctor}
            refreshTrigger={refreshTrigger}
          />
        );
      
      case 'calendar-config':
        return <CalendarConfig />;
      
      case 'schedule-generator':
        return <ScheduleGenerator />;
      
      case 'view-schedule':
        return <ViewSchedule />;
      
      case 'leave-requests':
        return <LeaveRequests />;
      
      case 'statistics':
        return <Statistics />;
      
      case 'user-management':
        return <UserManagement />;
      
      default:
        return (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">Select a section from the menu above.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation currentView={currentView} onViewChange={handleViewChange} />
      <div className="container mx-auto py-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default Index;
