"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Clock,
  Globe,
  MapPin,
  PlusCircle,
  Video,
  Calendar as CalendarIcon, // icon only
  Users,
  Users2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"; // ✅ shadcn date picker
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

// ---------- Types ----------
type AudienceMode = "all" | "teams" | "specific";

type Meeting = {
  id: string;
  title: string;
  date: any; // Firestore Timestamp | Date | string
  time: string; // "HH:mm"
  location: string;
  type: "Online" | "Offline";
  // attendees holds:
  // - ["all"] for everyone
  // - ["team:<TEAM_NAME>", ...] for teams
  // - [<volunteerId>, ...] for specific people
  attendees: string[];
};

type Volunteer = {
  id: string; // ideally equals auth uid
  name: string;
  email: string;
  avatar?: string;
  team?: string; // used for team audience mode
};

// ---------- Page ----------
export default function MeetingsPage() {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);

  // derive current user's team (from volunteers collection)
  const currentUserVolunteer = useMemo(
    () => allVolunteers.find((v) => v.id === user?.uid),
    [allVolunteers, user?.uid]
  );
  const currentUserTeam = currentUserVolunteer?.team;

  // ------- Create Meeting Dialog State -------
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState<{
    title: string;
    date: Date | undefined;
    time: string;
    location: string;
    type: "Online" | "Offline";
    audienceMode: AudienceMode;
    selectedTeams: string[];
    attendees: string[]; // for specific volunteers mode
  }>({
    title: "",
    date: undefined,
    time: "",
    location: "",
    type: "Online",
    audienceMode: "all",
    selectedTeams: [],
    attendees: [],
  });

  // Unique teams from volunteers
  const allTeams = useMemo(() => {
    const set = new Set<string>();
    for (const v of allVolunteers) {
      if (v.team && v.team.trim()) set.add(v.team.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allVolunteers]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const meetingsQuery = query(collection(db, "meetings"), orderBy("date", "desc"));
        const [meetingsSnap, volunteersSnap] = await Promise.all([
          getDocs(meetingsQuery),
          getDocs(collection(db, "volunteers")),
        ]);

        const volunteers = volunteersSnap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            name: data.name || "Unnamed",
            email: data.email || "",
            avatar: data.avatar || "",
            team: data.team || undefined,
          } as Volunteer;
        });
        setAllVolunteers(volunteers);

        // normalize attendees as array
        const allMeetings = meetingsSnap.docs.map((doc) => {
          const data = doc.data() as any;
          const attendees: string[] = Array.isArray(data.attendees)
            ? data.attendees
            : typeof data.attendees === "string"
              ? [data.attendees] // legacy "all"
              : ["all"];

          return {
            id: doc.id,
            title: data.title ?? "",
            date: data.date ?? null,
            time: data.time ?? "",
            location: data.location ?? "",
            type: data.type === "Offline" ? "Offline" : "Online",
            attendees,
          } as Meeting;
        });

        // visibility filter for non-admins
        const visibleMeetings = isAdmin
          ? allMeetings
          : allMeetings.filter((m) => {
              if (!user?.uid) return false;
              if (Array.isArray(m.attendees) && m.attendees.includes("all")) return true;
              if (Array.isArray(m.attendees) && m.attendees.includes(user.uid)) return true;
              // team token check: "team:<TEAM_NAME>"
              if (currentUserTeam) {
                const teamToken = `team:${currentUserTeam}`;
                if (m.attendees.some((t) => typeof t === "string" && t.toLowerCase() === teamToken.toLowerCase())) {
                  return true;
                }
              }
              return false;
            });

        setMeetings(visibleMeetings);
      } catch (error) {
        console.error("Error fetching meeting data:", error);
        toast({ title: "Error", description: "Could not fetch meetings.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, user, isAdmin, currentUserTeam]);

  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim() || !newMeeting.date || !newMeeting.time.trim() || !newMeeting.location.trim()) {
      toast({ title: "Error", description: "Please fill out all required fields.", variant: "destructive" });
      return;
    }

    // Build attendees payload by audienceMode
    let attendeesPayload: string[] = [];
    if (newMeeting.audienceMode === "all") {
      attendeesPayload = ["all"];
    } else if (newMeeting.audienceMode === "teams") {
      if (newMeeting.selectedTeams.length === 0) {
        toast({ title: "Select teams", description: "Choose at least one team or switch to All.", variant: "destructive" });
        return;
      }
      attendeesPayload = newMeeting.selectedTeams.map((t) => `team:${t}`);
    } else {
      // specific volunteers
      if (newMeeting.attendees.length === 0) {
        toast({ title: "Select attendees", description: "Pick at least one volunteer, or use All/Teams.", variant: "destructive" });
        return;
      }
      attendeesPayload = [...newMeeting.attendees];
    }

    try {
      // Store meeting date as Firestore Timestamp for reliable ordering
      const ts = Timestamp.fromDate(newMeeting.date);

      const meetingDoc = {
        title: newMeeting.title.trim(),
        date: ts,
        time: newMeeting.time,
        location: newMeeting.location.trim(),
        type: newMeeting.type,
        attendees: attendeesPayload,
        // createdAt: serverTimestamp(), // optional if you need
      };

      const docRef = await addDoc(collection(db, "meetings"), meetingDoc);

      // Local optimistic update
      const localMeeting: Meeting = { id: docRef.id, ...meetingDoc } as any;

      setMeetings((prev) =>
        [localMeeting, ...prev].sort((a, b) => {
          const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const db = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return db.getTime() - da.getTime();
        })
      );

      setCreateDialogOpen(false);
      setNewMeeting({
        title: "",
        date: undefined,
        time: "",
        location: "",
        type: "Online",
        audienceMode: "all",
        selectedTeams: [],
        attendees: [],
      });
      toast({ title: "Success", description: "New meeting has been scheduled." });
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast({ title: "Error", description: "Could not schedule meeting.", variant: "destructive" });
    }
  };

  const toggleVolunteer = (volId: string, checked: boolean) => {
    setNewMeeting((prev) => ({
      ...prev,
      attendees: checked ? [...prev.attendees, volId] : prev.attendees.filter((id) => id !== volId),
    }));
  };

  const toggleTeam = (team: string, checked: boolean) => {
    setNewMeeting((prev) => ({
      ...prev,
      selectedTeams: checked ? [...prev.selectedTeams, team] : prev.selectedTeams.filter((t) => t !== team),
    }));
  };

  if (loading) return <div className="p-6">Loading meetings...</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader title="Meetings" description="Upcoming and past meetings for volunteers.">
        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Schedule Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Schedule New Meeting</DialogTitle>
                <DialogDescription>Enter the details for the new meeting.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="meeting-title">Title</Label>
                  <Input
                    id="meeting-title"
                    placeholder="e.g. Q3 Planning Session"
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  />
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !newMeeting.date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newMeeting.date ? format(newMeeting.date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newMeeting.date}
                          onSelect={(date) => setNewMeeting({ ...newMeeting, date: date as Date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meeting-time">Time</Label>
                    <Input
                      id="meeting-time"
                      type="time"
                      value={newMeeting.time}
                      onChange={(e) => setNewMeeting({ ...newMeeting, time: e.target.value })}
                    />
                  </div>
                </div>

                {/* Type + Location */}
                <div className="space-y-2">
                  <Label htmlFor="meeting-type">Type</Label>
                  <Select
                    onValueChange={(value: "Online" | "Offline") => setNewMeeting({ ...newMeeting, type: value })}
                    value={newMeeting.type}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="Offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meeting-location">{newMeeting.type === "Online" ? "Meeting URL" : "Location Address"}</Label>
                  <Input
                    id="meeting-location"
                    placeholder={newMeeting.type === "Online" ? "https://meet.google.com/..." : "123 Main St, Anytown"}
                    value={newMeeting.location}
                    onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                  />
                </div>

                {/* Audience Mode */}
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select
                    value={newMeeting.audienceMode}
                    onValueChange={(v: AudienceMode) =>
                      setNewMeeting((prev) => ({ ...prev, audienceMode: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose who can attend" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all"><Users className="mr-2 h-4 w-4 inline" /> All Volunteers</SelectItem>
                      <SelectItem value="teams"><Users2 className="mr-2 h-4 w-4 inline" /> Specific Team(s)</SelectItem>
                      <SelectItem value="specific"><Users className="mr-2 h-4 w-4 inline" /> Selected Volunteers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Teams Picker */}
                {newMeeting.audienceMode === "teams" && (
                  <div className="space-y-2">
                    <Label>Teams</Label>
                    <p className="text-xs text-muted-foreground">Choose one or more teams.</p>
                    <ScrollArea className="h-[180px] rounded-md border p-2">
                      <div className="space-y-2">
                        {allTeams.length === 0 && <div className="text-sm text-muted-foreground">No teams found in volunteers.</div>}
                        {allTeams.map((team) => (
                          <div key={team} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
                            <Checkbox
                              id={`team-${team}`}
                              checked={newMeeting.selectedTeams.includes(team)}
                              onCheckedChange={(checked) => toggleTeam(team, !!checked)}
                            />
                            <Label htmlFor={`team-${team}`} className="cursor-pointer">{team}</Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Volunteers Picker */}
                {newMeeting.audienceMode === "specific" && (
                  <div className="space-y-2">
                    <Label>Attendees</Label>
                    <p className="text-xs text-muted-foreground">Pick specific volunteers for this meeting.</p>
                    <ScrollArea className="h-[220px] rounded-md border p-2">
                      <div className="space-y-2">
                        {allVolunteers.map((vol) => (
                          <div key={vol.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
                            <Checkbox
                              id={`vol-${vol.id}`}
                              checked={newMeeting.attendees.includes(vol.id)}
                              onCheckedChange={(checked) => toggleVolunteer(vol.id, !!checked)}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={vol.avatar || ""} alt={vol.name} />
                              <AvatarFallback>{vol.name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <Label htmlFor={`vol-${vol.id}`} className="font-medium cursor-pointer">
                                {vol.name} {vol.team ? <span className="text-xs text-muted-foreground">• {vol.team}</span> : null}
                              </Label>
                              <p className="text-xs text-muted-foreground">{vol.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateMeeting}>Schedule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      {/* Meetings Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meeting) => {
          // Resolve display date
          const d: Date = meeting.date?.toDate ? meeting.date.toDate() : new Date(meeting.date);

          // Determine audience summary
          const isAll = Array.isArray(meeting.attendees) && meeting.attendees.includes("all");
          const teamsInTokens = Array.isArray(meeting.attendees)
            ? meeting.attendees.filter((t) => typeof t === "string" && t.startsWith("team:")).map((t) => t.replace(/^team:/, ""))
            : [];

          const specificVolIds = Array.isArray(meeting.attendees)
            ? meeting.attendees.filter((t) => typeof t === "string" && !t.startsWith("team:") && t !== "all")
            : [];

          // For teams mode, resolve members belonging to those teams (cap avatars)
          const teamMembers = teamsInTokens.length
            ? allVolunteers.filter((v) => v.team && teamsInTokens.includes(v.team))
            : [];

          return (
            <Card key={meeting.id}>
              <CardHeader>
                <CardTitle className="font-headline">{meeting.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                  <Badge variant={meeting.type === "Online" ? "success" : "secondary"}>
                    {meeting.type === "Online" ? <Video className="mr-1 h-3 w-3" /> : <MapPin className="mr-1 h-3 w-3" />}
                    {meeting.type}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>{format(d, "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{meeting.time}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  {meeting.type === "Online" ? <Globe className="mr-2 h-4 w-4" /> : <MapPin className="mr-2 h-4 w-4" />}
                  <span className="truncate">{meeting.location}</span>
                </div>

                {/* Audience render */}
                <div>
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">Attendees</p>

                  {isAll ? (
                    <Badge variant="outline">All Volunteers</Badge>
                  ) : teamsInTokens.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm">
                        Teams:{" "}
                        <span className="font-medium">
                          {teamsInTokens.join(", ")}
                        </span>
                      </div>
                      <div className="flex -space-x-2 overflow-hidden">
                        {teamMembers.slice(0, 6).map((vol) => (
                          <Avatar key={vol.id} className="h-8 w-8 border-2 border-background">
                            <AvatarImage src={vol.avatar || ""} alt={vol.name} />
                            <AvatarFallback>{vol.name?.charAt(0) || "U"}</AvatarFallback>
                          </Avatar>
                        ))}
                        {teamMembers.length > 6 && (
                          <div className="h-8 w-8 rounded-full border-2 border-background bg-muted text-xs flex items-center justify-center">
                            +{teamMembers.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex -space-x-2 overflow-hidden">
                      {Array.isArray(specificVolIds) &&
                        specificVolIds.map((volId) => {
                          const vol = allVolunteers.find((v) => v.id === volId);
                          return vol ? (
                            <Avatar key={vol.id} className="h-8 w-8 border-2 border-background">
                              <AvatarImage src={vol.avatar || ""} alt={vol.name} />
                              <AvatarFallback>{vol.name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                          ) : null;
                        })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
