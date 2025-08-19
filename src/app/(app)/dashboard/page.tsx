
"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, ListChecks, CheckCheck, Repeat, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatsCard } from "@/components/stats-card";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Define types locally since mock-data is removed
type Volunteer = { id: string; name: string; email: string; avatar: string; role: 'Admin' | 'Volunteer' };
type Task = { id: string; eventId: string; name: string; status: 'Pending' | 'In Progress' | 'Completed'; assigned_volunteer_ids: string[] };
type Event = { id: string; name: string; date: string; };
type RemappingRequest = { id: string; taskId: string; from_volunteer_id: string; to_volunteer_id: string; };


export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [remappingRequests, setRemappingRequests] = useState<RemappingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today for comparison

        const eventsQuery = query(collection(db, "events"), where("date", ">=", today.toISOString().split('T')[0]));

        const [eventsSnap, tasksSnap, volunteersSnap, requestsSnap] = await Promise.all([
          getDocs(eventsQuery),
          getDocs(collection(db, "tasks")),
          getDocs(collection(db, "volunteers")),
          getDocs(collection(db, "remappingRequests")),
        ]);
        
        setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
        setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        setVolunteers(volunteersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volunteer)));
        setRemappingRequests(requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RemappingRequest)));

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  const getVolunteer = (id: string) => volunteers.find(v => v.id === id);
  const getTask = (id: string) => tasks.find(t => t.id === id);

  if (loading) {
    return <div>Loading Dashboard...</div>
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader title="Dashboard" description="An overview of all volunteer activities." />
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatsCard
          title="Total Events"
          value={String(events.length)}
          description="Number of upcoming and past events"
          icon={CalendarClock}
        />
        <StatsCard
          title="Pending Tasks"
          value={String(tasks.filter(t => t.status === "Pending").length)}
          description="Tasks that need to be started"
          icon={ListChecks}
        />
        <StatsCard
          title="Completed Tasks"
          value={String(tasks.filter(t => t.status === "Completed").length)}
          description="Tasks successfully finished"
          icon={CheckCheck}
        />
        <StatsCard
          title="Active Volunteers"
          value={String(volunteers.length)}
          description="Total number of registered volunteers"
          icon={Users}
        />
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle className="font-headline">Ongoing & Upcoming Events</CardTitle>
              <CardDescription>
                Progress overview of current and upcoming events.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/events">
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {events.map(event => {
              const eventTasks = tasks.filter(t => t.eventId === event.id);
              const completedTasks = eventTasks.filter(t => t.status === 'Completed').length;
              const progress = eventTasks.length > 0 ? (completedTasks / eventTasks.length) * 100 : 0;
              return (
                 <Link href={`/events/${event.id}`} key={event.id} className="block p-4 rounded-lg hover:bg-accent transition-colors">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{event.name}</p>
                      <p className="text-sm text-muted-foreground">{event.date}</p>
                    </div>
                    <Progress value={progress} aria-label={`${progress.toFixed(0)}% complete`}/>
                    <p className="text-xs text-muted-foreground">{completedTasks} of {eventTasks.length} tasks completed.</p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Recent Remapping Requests</CardTitle>
            <CardDescription>
              Recent task transfer requests from volunteers.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remappingRequests.slice(0, 5).map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{getTask(req.taskId)?.name}</TableCell>
                    <TableCell>{getVolunteer(req.from_volunteer_id)?.name}</TableCell>
                    <TableCell>{getVolunteer(req.to_volunteer_id)?.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
