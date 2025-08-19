
"use client";

import Link from "next/link";
import { PlusCircle, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";


// Define types locally
type EventStatus = "Upcoming" | "Completed" | "Postponed";
type Event = { id: string; name: string; date: string; description: string; status: EventStatus; };
type Task = { id: string; eventId: string; status: 'Pending' | 'In Progress' | 'Completed'; assigned_volunteer_ids: string[] };
type Volunteer = { id: string; name: string; avatar: string; };

const statusColors: Record<EventStatus, string> = {
  Upcoming: "bg-blue-500/20 text-blue-700 hover:bg-blue-500/30",
  Completed: "bg-green-500/20 text-green-700 hover:bg-green-500/30",
  Postponed: "bg-orange-500/20 text-orange-700 hover:bg-orange-500/30",
}

export default function EventsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: "", description: "", date: undefined as Date | undefined });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today for comparison

        const eventsQuery = query(collection(db, "events"), where("date", ">=", today.toISOString().split('T')[0]));

        const [eventsSnap, tasksSnap, volunteersSnap] = await Promise.all([
          getDocs(eventsQuery),
          getDocs(collection(db, "tasks")),
          getDocs(collection(db, "volunteers")),
        ]);
        
        setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        setVolunteers(volunteersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volunteer)));
      } catch (error) {
        console.error("Error fetching events data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateEvent = async () => {
    if (!newEvent.name.trim() || !newEvent.description.trim() || !newEvent.date) {
        toast({ title: "Error", description: "Please fill out all fields.", variant: "destructive" });
        return;
    }

    try {
        const eventData = {
            name: newEvent.name,
            description: newEvent.description,
            date: format(newEvent.date, "yyyy-MM-dd"),
            status: "Upcoming" as EventStatus,
            statusTimestamp: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, "events"), eventData);
        setEvents(prev => [{ id: docRef.id, ...eventData }, ...prev]);
        setCreateDialogOpen(false);
        setNewEvent({ name: "", description: "", date: undefined });
        toast({ title: "Success", description: "New event has been created." });
    } catch (error) {
        console.error("Error creating event:", error);
        toast({ title: "Error", description: "Could not create event.", variant: "destructive" });
    }
  };

  if (loading) return <div>Loading events...</div>

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader
        title="Events"
        description="Manage your organization's events and track their progress."
      >
        {isAdmin && <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Event
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Event</DialogTitle>
                    <DialogDescription>Enter the details for the new event.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="event-name">Event Name</Label>
                        <Input id="event-name" placeholder="e.g. Annual Charity Gala" value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="event-desc">Description</Label>
                        <Textarea id="event-desc" placeholder="Describe the event..." value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                         <Label>Event Date</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !newEvent.date && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newEvent.date ? format(newEvent.date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={newEvent.date}
                                onSelect={(date) => setNewEvent({ ...newEvent, date: date as Date })}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateEvent}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>}
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const eventTasks = tasks.filter((task) => task.eventId === event.id);
          const completedTasks = eventTasks.filter(
            (task) => task.status === "Completed"
          ).length;
          const progress =
            eventTasks.length > 0
              ? (completedTasks / eventTasks.length) * 100
              : 0;

          const assignedVolunteers = new Set(eventTasks.flatMap(task => task.assigned_volunteer_ids));

          return (
            <Card key={event.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="font-headline">{event.name}</CardTitle>
                        <CardDescription>{new Date(event.date).toLocaleDateString()}</CardDescription>
                    </div>
                    <Badge className={cn("border-transparent capitalize", statusColors[event.status])}>{event.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground mb-4">
                  {event.description}
                </p>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">{completedTasks} / {eventTasks.length} tasks</span>
                  </div>
                  <Progress value={progress} aria-label={`${progress.toFixed(0)}% complete`} />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                 <div className="flex -space-x-2 overflow-hidden">
                    {Array.from(assignedVolunteers).slice(0, 4).map(volId => {
                      const vol = volunteers.find(v => v.id === volId);
                      return vol ? (
                        <Avatar key={vol.id} className="h-8 w-8 border-2 border-background">
                            <AvatarImage src={vol.avatar} alt={vol.name} />
                            <AvatarFallback>{vol.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      ) : null
                    })}
                    {assignedVolunteers.size > 4 && <Avatar className="h-8 w-8 border-2 border-background"><AvatarFallback>+{assignedVolunteers.size - 4}</AvatarFallback></Avatar>}
                 </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/events/${event.id}`}>View Details</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
