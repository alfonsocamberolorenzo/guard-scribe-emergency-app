import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, CalendarCheck, FileText, Settings, BarChart3, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const { profile, isEditor, signOut } = useAuth();
  
  const editorMenuItems = [
    { id: 'doctors', label: 'Doctors', icon: Users },
    { id: 'calendar-config', label: 'Calendar Config', icon: Calendar },
    { id: 'schedule-generator', label: 'Generate Schedule', icon: CalendarCheck },
    { id: 'view-schedule', label: 'View Schedule', icon: FileText },
    { id: 'leave-requests', label: 'Leave Requests', icon: Settings },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'user-management', label: 'User Management', icon: User },
  ];

  const viewerMenuItems = [
    { id: 'view-schedule', label: 'View Schedule', icon: FileText },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  ];

  const menuItems = isEditor ? editorMenuItems : viewerMenuItems;

  return (
    <nav className="bg-card border-b border-border p-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Medical Guard Management</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm">{profile?.full_name || 'User'}</span>
              <Badge variant={isEditor ? "default" : "secondary"}>
                {profile?.role || 'viewer'}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
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