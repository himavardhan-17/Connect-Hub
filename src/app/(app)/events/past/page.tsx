
"use client";

import Link from "next/link";
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
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";


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

export default function PastEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString().split('T')[0];

        const eventsQuery = query(collection(db, "events"), where("date", "<", todayISO));
        
        const [eventsSnap, tasksSnap, volunteersSnap] = await Promise.all([
          getDocs(eventsQuery),
          getDocs(collection(db, "tasks")),
          getDocs(collection(db, "volunteers")),
        ]);
        
        setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
        setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        setVolunteers(volunteersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volunteer)));
      } catch (error) {
        console.error("Error fetching past events data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Loading past events...</div>

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader
        title="Past Events"
        description="An archive of all previously held events."
      />
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
         {events.length === 0 && !loading && (
            <div className="col-span-full text-center text-muted-foreground">
                No past events found.
            </div>
        )}
      </div>
    </div>
  );
}
