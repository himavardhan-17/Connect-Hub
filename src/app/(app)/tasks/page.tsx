"use client";

import { useState, useEffect } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { PageHeader } from "@/components/page-header";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, addDoc } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";

// Types
type Task = { 
  id: string; 
  name: string; 
  eventId: string; 
  deadline: any; 
  status: 'Pending' | 'In Progress' | 'Completed'; 
  assigned_volunteer_ids: string[]; 
};
type Event = { id: string; name: string };
type Volunteer = { id: string; name: string };

export default function TasksPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isRemapDialogOpen, setRemapDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [targetVolunteerId, setTargetVolunteerId] = useState("");
  const [remapReason, setRemapReason] = useState("");

  const [isPraiseOpen, setPraiseOpen] = useState(false);
  const [praiseQuote, setPraiseQuote] = useState("");

  // Personalized motivational quotes
  const motivationalQuotes = [
    (name: string) => `${name}, you just made Connect Club proud today!`,
    (name: string) => `${name}, your consistency makes Connect Club stronger each day.`,
    (name: string) => `At Connect Club, we celebrate the effort you put in, ${name}.`,
    (name: string) => `Keep going, ${name} — Connect Club is growing with you.`,
    (name: string) => `${name}, every step you take uplifts the whole Connect Club family.`,
    (name: string) => `What a brilliant effort, ${name}! Connect Club shines brighter now.`,
    (name: string) => `${name}, your determination is shaping Connect Club’s future.`,
    (name: string) => `Connect Club feels your energy, ${name}, and it’s inspiring.`,
    (name: string) => `Fantastic work, ${name}! This is how Connect Club achieves greatness.`,
    (name: string) => `You did it, ${name}! Connect Club moves forward because of people like you.`,
    (name: string) => `Amazing job, ${name}. Connect Club’s journey is brighter with you.`,
    (name: string) => `${name}, the discipline you show lifts Connect Club higher.`,
    (name: string) => `Outstanding spirit, ${name}. Connect Club applauds your hard work.`,
    (name: string) => `Cheers to you, ${name}! Connect Club celebrates this win.`,
    (name: string) => `Incredible progress, ${name} — you’re making Connect Club stronger.`,
    (name: string) => `With this task done, ${name}, you’ve raised the bar at Connect Club.`,
    (name: string) => `${name}, your effort today builds the Connect Club of tomorrow.`,
    (name: string) => `What a milestone, ${name}! Connect Club grows because of you.`,
    (name: string) => `${name}, the passion you bring is Connect Club’s true strength.`,
    (name: string) => `Spectacular work, ${name}. Connect Club stands taller today.`,
    (name: string) => `Keep shining, ${name}. Connect Club is proud of your spirit.`,
    (name: string) => `${name}, you’ve turned effort into inspiration for Connect Club.`,
    (name: string) => `Well done, ${name}! Connect Club thrives on dedication like yours.`,
    (name: string) => `Connect Club’s story wouldn’t be complete without your impact, ${name}.`,
    (name: string) => `Superb, ${name}! This victory belongs to you and Connect Club.`,
    (name: string) => `${name}, you’ve just set another example for Connect Club.`,
    (name: string) => `Brilliant achievement, ${name}. Connect Club celebrates your success.`,
    (name: string) => `Hats off, ${name}! Your perseverance powers Connect Club forward.`,
    (name: string) => `${name}, this isn’t just a task done — it’s Connect Club history in the making.`,
    (name: string) => `Legendary effort, ${name}. You’ve written another proud page in Connect Club’s journey.`
  ];

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const tasksQuery = query(collection(db, "tasks"), where("assigned_volunteer_ids", "array-contains", user.uid));
        const [tasksSnap, eventsSnap, volunteersSnap] = await Promise.all([
          getDocs(tasksQuery),
          getDocs(collection(db, "events")),
          getDocs(collection(db, "volunteers"))
        ]);
        
        setMyTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
        setVolunteers(volunteersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volunteer)));
      } catch (error) {
        console.error("Error fetching tasks:", error);
        toast({title: "Error", description: "Could not fetch tasks.", variant: "destructive"})
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, toast]);

  const getEventName = (eventId: string) => {
    return events.find((e) => e.id === eventId)?.name;
  };

  const isAssignedToUser = (task: Task) => task.assigned_volunteer_ids.includes(user?.uid || "");

  // Handle marking complete
  const handleMarkAsComplete = async (taskId: string) => {
    try {
      const taskDocRef = doc(db, "tasks", taskId);
      await updateDoc(taskDocRef, { status: "Completed" });
      setMyTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, status: "Completed" } : task
        )
      );

      // 🎉 Fetch current user's name from volunteers collection
      const currentVolunteer = volunteers.find(v => v.id === user?.uid);
      const userName = currentVolunteer?.name || "Volunteer";

      // 🎉 Random praise
      const randomFn = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
      setPraiseQuote(randomFn(userName));
      setPraiseOpen(true);

      toast({
        title: "Task Updated",
        description: "Task marked as complete.",
      });
    } catch(error) {
       console.error("Error completing task:", error);
       toast({title: "Error", description: "Could not update task.", variant: "destructive"})
    }
  };

  const openRemapDialog = (task: Task) => {
    setSelectedTask(task);
    setTargetVolunteerId("");
    setRemapReason("");
    setRemapDialogOpen(true);
  }

  const handleRemapRequest = async () => {
    if (!selectedTask || !targetVolunteerId || !remapReason.trim() || !user) {
        toast({ title: "Error", description: "Please fill out all fields.", variant: "destructive"});
        return;
    }

    const newRequest = {
        taskId: selectedTask.id,
        from_volunteer_id: user.uid,
        to_volunteer_id: targetVolunteerId,
        reason: remapReason,
        status: "Pending",
    }
    
    try {
      await addDoc(collection(db, "remappingRequests"), newRequest);
      toast({
          title: "Request Submitted",
          description: "Your task remapping request has been sent for approval.",
      });
      setRemapDialogOpen(false);
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({title: "Error", description: "Could not submit request.", variant: "destructive"});
    }
  }

  if (loading) return <div>Loading tasks...</div>;
  if (!user) return <div>Please log in to see your tasks.</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader
        title="My Tasks"
        description="Here are all the tasks currently assigned to you."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Assigned Tasks</CardTitle>
          <CardDescription>
            You have {myTasks.length} tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myTasks.length > 0 ? myTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getEventName(task.eventId)}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.deadline?.toDate ? task.deadline.toDate().toLocaleDateString() : task.deadline}
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0" 
                          disabled={!isAssignedToUser(task)}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={task.status === 'Completed' || !isAssignedToUser(task)}
                          onClick={() => handleMarkAsComplete(task.id)}
                        >
                          Mark as Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!isAssignedToUser(task)}
                          onClick={() => openRemapDialog(task)}
                        >
                          Request Remapping
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      You have no tasks assigned.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Remap Request Dialog */}
      <Dialog open={isRemapDialogOpen} onOpenChange={setRemapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Task Remapping</DialogTitle>
            <DialogDescription>
              Transfer responsibility for &quot;{selectedTask?.name}&quot; to another volunteer. 
              The task will only be reassigned upon their approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
                <Label htmlFor="target-volunteer">Transfer To</Label>
                <Select onValueChange={setTargetVolunteerId} value={targetVolunteerId}>
                  <SelectTrigger id="target-volunteer">
                      <SelectValue placeholder="Select a volunteer..." />
                  </SelectTrigger>
                  <SelectContent>
                      {volunteers
                        .filter(v => v.id !== user?.uid)
                        .map(vol => (
                            <SelectItem key={vol.id} value={vol.id}>{vol.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="remap-reason">Reason for Transfer</Label>
              <Textarea 
                id="remap-reason" 
                placeholder="Please provide a reason for this request..." 
                value={remapReason} 
                onChange={e => setRemapReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setRemapDialogOpen(false)} variant="outline">Cancel</Button>
            <Button type="button" onClick={handleRemapRequest}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Praise Dialog */}
      <Dialog open={isPraiseOpen} onOpenChange={setPraiseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Well Done!</DialogTitle>
            <DialogDescription>
              {praiseQuote}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPraiseOpen(false)}>Thanks!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
