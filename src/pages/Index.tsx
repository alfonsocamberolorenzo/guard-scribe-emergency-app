import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { DoctorForm } from "@/components/DoctorForm";
import { DoctorList } from "@/components/DoctorList";
import { CalendarConfig } from "@/components/CalendarConfig";
import { ScheduleGenerator } from "@/components/ScheduleGenerator";
import { ViewSchedule } from "@/components/ViewSchedule";
import { LeaveRequests } from "@/components/LeaveRequests";
import { Statistics } from "@/components/Statistics";

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
  unavailable_weekdays: number[];
  max_7h_guards: number | null;
  max_17h_guards: number | null;
}

const Index = () => {
  const [currentView, setCurrentView] = useState('doctors');
  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | undefined>();
  const [allDoctorsList, setAllDoctorsList] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    setCurrentView(view);
    // Reset form state when switching views
    setShowForm(false);
    setEditingDoctor(undefined);
  };

  const renderContent = () => {
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
      
      default:
        return null;
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
