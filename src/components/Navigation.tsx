import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Calendar, CalendarCheck, FileText, Settings, BarChart3, LogOut, User, ChevronDown, Shield, Clock, Cog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSelector } from "@/components/LanguageSelector";

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const { profile, isEditor, signOut } = useAuth();
  const { t } = useTranslation();
  
  // Menu groups configuration
  const menuGroups = [
    {
      id: 'guards',
      label: t.navigation.guards,
      icon: Shield,
      items: [
        { id: 'schedule-generator', label: t.navigation.scheduleGeneration, icon: CalendarCheck },
        { id: 'statistics', label: t.navigation.statistics, icon: BarChart3 },
      ]
    },
    {
      id: 'configuration',
      label: t.navigation.configuration,
      icon: Cog,
      items: [
        { id: 'calendar-config', label: t.navigation.calendarConfig, icon: Calendar },
        { id: 'doctors', label: t.navigation.doctorManagement, icon: Users },
        { id: 'user-management', label: t.navigation.userManagement, icon: User },
      ]
    }
  ];

  // First level items
  const viewScheduleItem = {
    id: 'view-schedule',
    label: t.navigation.viewSchedule,
    icon: FileText
  };

  // Single level item for absences
  const absencesItem = {
    id: 'leave-requests',
    label: t.navigation.absences,
    icon: Clock
  };

  // Filter menu groups based on user role
  const getVisibleMenuGroups = () => {
    if (!isEditor) {
      // Viewers only see the guards group with limited items
      return [{
        ...menuGroups[0],
        items: menuGroups[0].items.filter(item => 
          item.id === 'statistics'
        )
      }];
    }
    return menuGroups;
  };

  const visibleMenuGroups = getVisibleMenuGroups();

  return (
    <nav className="bg-card border-b border-border p-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Medical Guard Management</h1>
          <div className="flex items-center gap-3">
            <LanguageSelector />
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
              {t.navigation.logout}
            </Button>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* View Schedule - First Level Item */}
          <Button
            variant={currentView === viewScheduleItem.id ? "default" : "outline"}
            onClick={() => onViewChange(viewScheduleItem.id)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {viewScheduleItem.label}
          </Button>
          {/* Absences - Single Level Item (only for editors) */}
          {isEditor && (
            <Button
              variant={currentView === absencesItem.id ? "default" : "outline"}
              onClick={() => onViewChange(absencesItem.id)}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              {absencesItem.label}
            </Button>
            {/* Grouped Menu Items */}
            {visibleMenuGroups.map((group) => {
              const GroupIcon = group.icon;
              const hasActiveItem = group.items.some(item => currentView === item.id);
              
              return (
                <DropdownMenu key={group.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={hasActiveItem ? "default" : "outline"}
                      className="flex items-center gap-2"
                    >
                      <GroupIcon className="h-4 w-4" />
                      {group.label}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() => onViewChange(item.id)}
                          className={currentView === item.id ? "bg-accent" : ""}
                        >
                          <ItemIcon className="h-4 w-4 mr-2" />
                          {item.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          )}
        </div>
      </div>
    </nav>
  );
}