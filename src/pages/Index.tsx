import { useState } from "react";
import { DoctorForm } from "@/components/DoctorForm";
import { DoctorList } from "@/components/DoctorList";

interface Doctor {
  id: string;
  full_name: string;
  alias: string;
  unavailable_weekdays: number[];
  max_7h_guards: number | null;
  max_17h_guards: number | null;
}

const Index = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Medical Guard Management</h1>
          <p className="text-muted-foreground">Manage doctors and guard schedules for the emergency service department</p>
        </div>

        {showForm ? (
          <div className="flex justify-center">
            <DoctorForm
              doctor={editingDoctor}
              onSave={handleSave}
              onCancel={handleCancel}
              allDoctors={[]}
            />
          </div>
        ) : (
          <DoctorList
            onAddDoctor={handleAddDoctor}
            onEditDoctor={handleEditDoctor}
            refreshTrigger={refreshTrigger}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
