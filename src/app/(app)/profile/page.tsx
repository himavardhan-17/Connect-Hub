
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

// Define types locally
type Task = { id: string, eventId: string, status: 'Pending' | 'In Progress' | 'Completed', assigned_volunteer_ids: string[] };
type Event = { id: string, name: string, date: any, description: string };

export default function ProfilePage() {
  const { toast } = useToast();
  const { volunteer, user, isAdmin, loading: authLoading } = useAuth();
  
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [participatedEvents, setParticipatedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        if (!authLoading) setLoading(false);
        return;
      };

      setLoading(true);
      try {
        // Fetch user's tasks
        const tasksQuery = query(collection(db, "tasks"), where("assigned_volunteer_ids", "array-contains", user.uid));
        const tasksSnap = await getDocs(tasksQuery);
        const tasksData = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setMyTasks(tasksData);

        // Fetch participated events
        if (tasksData.length > 0) {
            const participatedEventIds = [...new Set(tasksData.map((t) => t.eventId))];
            if (participatedEventIds.length > 0) {
                const eventsQuery = query(collection(db, "events"), where("__name__", "in", participatedEventIds));
                const eventsSnap = await getDocs(eventsQuery);
                const eventsData = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
                setParticipatedEvents(eventsData);
            }
        }
      } catch (error) {
        console.error("Error fetching profile data: ", error);
        toast({ title: "Error", description: "Failed to load profile data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading, toast]);

  if(authLoading || loading) return <div>Loading profile...</div>
  if(!volunteer) return <div>Could not find user profile.</div>

  const completedTasksCount = myTasks.filter((t) => t.status === "Completed").length;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader
        title="My Profile"
        description="View and manage your personal information and contributions."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="items-center text-center">
              <Avatar className="h-24 w-24 mb-4 border-4 border-primary/20">
                <AvatarImage src={volunteer.avatar} data-ai-hint="person" />
                <AvatarFallback>{volunteer.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <CardTitle className="text-2xl font-headline">{volunteer.name}</CardTitle>
              <CardDescription>{volunteer.email}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button disabled={!isAdmin}>Edit Profile</Button>
            </CardContent>
          </Card>
           <Card className="mt-4">
            <CardHeader>
                <CardTitle className="font-headline">Statistics</CardTitle>
            </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Completed Tasks</span>
                    <span className="font-bold text-lg">{completedTasksCount}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Events Participated</span>
                    <span className="font-bold text-lg">{participatedEvents.length}</span>
                </div>
             </CardContent>
           </Card>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Event History</CardTitle>
              <CardDescription>
                A log of all events you've participated in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {participatedEvents.map((event, index) => (
                  <li key={event.id}>
                    <div>
                      <h3 className="font-semibold">{event.name}</h3>
                      <p className="text-sm text-muted-foreground">{event.date?.toDate ? event.date.toDate().toLocaleDateString() : event.date}</p>
                      <p className="text-sm mt-1">{event.description}</p>
                    </div>
                    {index < participatedEvents.length - 1 && <Separator className="mt-4"/>}
                  </li>
                ))}
                {participatedEvents.length === 0 && (
                    <p className="text-muted-foreground text-sm">You haven&apos;t participated in any events yet.</p>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
