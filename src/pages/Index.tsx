import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { DoctorForm } from "@/components/DoctorForm";
import { DoctorList } from "@/components/DoctorList";
import { CalendarConfig } from "@/components/CalendarConfig";

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAddDoctor = () => {
    setEditingDoctor(undefined);
    setShowForm(true);
  };

  const handleEditDoctor = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setShowForm(true);
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
                allDoctors={[]}
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
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">Schedule Generator</h2>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        );
      
      case 'view-schedule':
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">View Schedule</h2>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        );
      
      case 'leave-requests':
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">Leave Requests</h2>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        );
      
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
