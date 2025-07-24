import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, CalendarCheck, FileText, Settings, BarChart3 } from "lucide-react";

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const menuItems = [
    { id: 'doctors', label: 'Doctors', icon: Users },
    { id: 'calendar-config', label: 'Calendar Config', icon: Calendar },
    { id: 'schedule-generator', label: 'Generate Schedule', icon: CalendarCheck },
    { id: 'view-schedule', label: 'View Schedule', icon: FileText },
    { id: 'leave-requests', label: 'Leave Requests', icon: Settings },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  ];

  return (
    <nav className="bg-card border-b border-border p-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Medical Guard Management</h1>
          <Badge variant="secondary">Emergency Service Department</Badge>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={currentView === item.id ? "default" : "outline"}
                onClick={() => onViewChange(item.id)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}