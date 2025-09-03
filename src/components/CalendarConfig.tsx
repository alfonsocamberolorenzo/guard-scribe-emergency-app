import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GuardDay {
  id: string;
  date: string;
  is_guard_day: boolean;
  is_working_day: boolean;
}

export function CalendarConfig() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [guardDays, setGuardDays] = useState<GuardDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const years = Array.from({ length: 11 }, (_, i) => 2020 + i);
  const months = [
    { value: 1, label: "Enero" }, { value: 2, label: "Febrero" }, { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" }, { value: 5, label: "Mayo" }, { value: 6, label: "Junio" },
    { value: 7, label: "Julio" }, { value: 8, label: "Agosto" }, { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" }, { value: 11, label: "Noviembre" }, { value: 12, label: "Diciembre" }
  ];

  const fetchGuardDays = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1, 12);
      const endDate = new Date(selectedYear, selectedMonth, 0, 12);
      
      const { data, error } = await supabase
        .from("guard_days")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0])
        .order("date");

      if (error) throw error;

      // Create all days of the month, only use database value if it exists
      const daysInMonth = endDate.getDate();
      const allDays: GuardDay[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const existingDay = data?.find(d => d.date === dateStr);
        
        allDays.push({
          id: existingDay?.id || '',
          date: dateStr,
          is_guard_day: existingDay ? existingDay.is_guard_day : true,
          is_working_day: existingDay ? existingDay.is_working_day : true
        });
      }
      
      setGuardDays(allDays);
      setHasChanges(false);
    } catch (error) {
      console.error("Error fetching guard days:", error);
      toast({
        title: "Error",
        description: "Failed to fetch guard days",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGuardDay = (date: string) => {
    setGuardDays(prev => 
      prev.map(day => 
        day.date === date 
          ? { ...day, is_guard_day: day.is_guard_day === day.is_working_day ? false : true, is_working_day: !(day.is_working_day &&day.is_guard_day) }
          : day
      )
    );
    setHasChanges(true);
  };

  const saveChanges = async () => {
    setIsLoading(true);
    try {
      const upsertData = guardDays.map(day => ({
        date: day.date,
        is_guard_day: day.is_guard_day,
        is_working_day: day.is_working_day
      }));

      const { error } = await supabase
        .from("guard_days")
        .upsert(upsertData, { onConflict: 'date' });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Guard days configuration saved successfully",
      });

      // Reset changes flag first, then fetch fresh data
      setHasChanges(false);
      await fetchGuardDays(); // Refresh to get accurate state from database
    } catch (error) {
      console.error("Error saving guard days:", error);
      toast({
        title: "Error",
        description: "Failed to save guard days configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetMonth = () => {
    setGuardDays(prev => prev.map(day => ({ ...day, is_guard_day: true, is_working_day: true })));
    setHasChanges(true);
  };

  useEffect(() => {
    fetchGuardDays();
  }, [selectedYear, selectedMonth]);

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const guardDaysCount = guardDays.filter(day => day.is_guard_day).length;
  const workingDaysCount = guardDays.filter(day => day.is_working_day).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Guard Calendar Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div>
                <label className="text-sm font-medium mb-2 block">Year</label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Month</label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="ml-auto flex gap-2">
                <Badge variant="secondary">{guardDaysCount} guard days</Badge>
                <Badge variant="secondary">{workingDaysCount} working days</Badge>
                {hasChanges && (
                  <Badge variant="destructive">Unsaved changes</Badge>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Loading calendar...</div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2">
                  {guardDays.map((day) => (
                    <Button
                      key={day.date}
                      variant={day.is_working_day ? "outline" : "default"}
                      className={`h-16 flex flex-col items-center justify-center relative ${
                        day.is_guard_day
                          ? "after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[5px] after:bg-green-500"
                          : ""
                      }`}
                      onClick={() => toggleGuardDay(day.date)}
                    >
                      <span className="text-xs font-medium">
                        {getDayName(day.date)}
                      </span>
                      <span className="text-sm">
                        {new Date(day.date).getDate()}
                      </span>
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={resetMonth}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Month
                  </Button>
                  <Button onClick={saveChanges} disabled={!hasChanges || isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>Línea verde: guardia del equipo de AP.</p>
                  <p>Día en blanco: día laborable.</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}