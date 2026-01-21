import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ALL_TIMEZONES, type TimezoneKey } from "@shared/schema";

interface MeetingPlannerModalProps {
  hostZoneKey: TimezoneKey;
  otherZoneKeys: TimezoneKey[];
}

export function MeetingPlannerModal({ hostZoneKey, otherZoneKeys }: MeetingPlannerModalProps) {
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");

  const hostZone = ALL_TIMEZONES[hostZoneKey];

  useEffect(() => {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const hostTime = new Date(utcTime + hostZone.offset * 3600000);

    let defaultDate = hostTime;
    if (hostTime.getHours() >= 18) {
      defaultDate = new Date(hostTime.getTime() + 24 * 3600000);
    }

    const year = defaultDate.getFullYear();
    const month = (defaultDate.getMonth() + 1).toString().padStart(2, "0");
    const day = defaultDate.getDate().toString().padStart(2, "0");

    setMeetingDate(`${year}-${month}-${day}`);
  }, [hostZone.offset]);

  function getMeetingTimeInZone(targetZoneKey: TimezoneKey): { time: string; hour: number } | null {
    if (!meetingDate || !meetingTime) return null;

    const targetZone = ALL_TIMEZONES[targetZoneKey];
    const offsetDiff = targetZone.offset - hostZone.offset;

    const meetingDateTime = new Date(`${meetingDate}T${meetingTime}:00`);
    const targetDateTime = new Date(meetingDateTime.getTime() + offsetDiff * 3600000);

    const targetHours = targetDateTime.getHours();
    const targetMinutes = targetDateTime.getMinutes().toString().padStart(2, "0");
    const formattedHours = targetHours.toString().padStart(2, "0");

    return {
      time: `${formattedHours}:${targetMinutes}`,
      hour: targetHours,
    };
  }

  function getTimeStatus(hour: number): "good" | "bad" {
    if (hour >= 6 && hour < 21) return "good";
    return "bad";
  }

  function getStatusColor(status: "good" | "bad") {
    switch (status) {
      case "good":
        return "bg-green-500";
      case "bad":
        return "bg-red-500";
    }
  }

  function getStatusLabel(status: "good" | "bad") {
    switch (status) {
      case "good":
        return "Good time";
      case "bad":
        return "Night time";
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Plan a meeting"
          data-testid={`button-meeting-planner-${hostZoneKey}`}
        >
          <CalendarClock className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-meeting-planner">
        <DialogHeader>
          <DialogTitle className="font-display font-semibold text-foreground">
            Meeting Time Zone Calculations
          </DialogTitle>
          <DialogDescription>
            Plan meetings across different time zones
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Planning meeting from</p>
            <p className="font-display font-semibold text-lg">
              {hostZone.name} ({hostZone.gmtLabel})
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Date</label>
              <Input 
                type="date" 
                value={meetingDate} 
                onChange={(e) => setMeetingDate(e.target.value)}
                data-testid="input-meeting-date"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Time</label>
              <Input 
                type="time" 
                value={meetingTime} 
                onChange={(e) => setMeetingTime(e.target.value)}
                data-testid="input-meeting-time"
              />
            </div>
          </div>

          {meetingDate && meetingTime && (
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Meeting times for others</p>

              {otherZoneKeys.map((zoneKey) => {
                const zone = ALL_TIMEZONES[zoneKey];
                const meetingInfo = getMeetingTimeInZone(zoneKey);

                if (!meetingInfo) return null;

                const status = getTimeStatus(meetingInfo.hour);

                return (
                  <div 
                    key={zoneKey} 
                    className="flex items-center justify-between py-2"
                    data-testid={`meeting-time-${zoneKey}`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} 
                        title={getStatusLabel(status)} 
                      />
                      <div>
                        <p className="font-medium">{zone.name}</p>
                        <p className="text-xs text-muted-foreground">{zone.gmtLabel}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-semibold text-xl">{meetingInfo.time}</p>
                      <p className="text-xs text-muted-foreground">{getStatusLabel(status)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {meetingDate && meetingTime && (
            <div className="flex gap-4 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>6am - 9pm</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Night time</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
