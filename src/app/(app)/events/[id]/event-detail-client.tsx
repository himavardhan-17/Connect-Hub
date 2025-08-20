"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  NotebookPen,
  PlusCircle,
  Users,
  Calendar as CalendarIcon,
  Trash2
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { PageHeader } from "@/components/page-header";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, updateDoc, addDoc, serverTimestamp, query, where, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";

type EventStatus = "Upcoming" | "Completed" | "Postponed";
type Volunteer = { id: string; name: string; email:string; avatar: string; };
type Department = { id: string; name: string; volunteer_ids: string[]; };
type ContributionNote = { volunteer_id: string; note: string };
type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
type Task = { id: string; eventId: string; name: string; description: string; status: TaskStatus; assigned_volunteer_ids: string[]; type: 'Individual' | 'Team'; deadline: string; contribution_notes: ContributionNote[]; volunteerCompletion?: Record<string, boolean> };
type Event = { id: string; name: string; date: any; description: string; departments: Department[]; status: EventStatus; statusTimestamp?: any; };

const statusColors: Record<EventStatus, string> = {
  Upcoming: "bg-blue-500/20 text-blue-700 hover:bg-blue-500/30",
  Completed: "bg-green-500/20 text-green-700 hover:bg-green-500/30",
  Postponed: "bg-orange-500/20 text-orange-700 hover:bg-orange-500/30",
}

export function EventDetailClient({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [eventTasks, setEventTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isManageDeptOpen, setManageDeptOpen] = useState(false);
  const [isPostponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [isContributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [isAssignTaskOpen, setAssignTaskOpen] = useState(false);

  // Form states
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [postponedDate, setPostponedDate] = useState<Date | undefined>(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [contributionVolunteer, setContributionVolunteer] = useState('');
  const [contributionNote, setContributionNote] = useState('');
  const [newTask, setNewTask] = useState({ name: '', description: '', type: 'Individual' as 'Individual' | 'Team', deadline: undefined as Date | undefined, assigned_volunteer_ids: [] as string[] });
  const [assignVolunteers, setAssignVolunteers] = useState<string[]>([]);

  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) return;
      setLoading(true);
      try {
        const eventDocRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventDocRef);

        if (eventSnap.exists()) {
          const eventData = { id: eventSnap.id, ...eventSnap.data() } as Event;
          const deptsSnap = await getDocs(collection(eventDocRef, "departments"));
          eventData.departments = deptsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Department);
          setCurrentEvent(eventData);
        }

        const tasksQuery = query(collection(db, "tasks"), where("eventId", "==", eventId));
        const tasksSnap = await getDocs(tasksQuery);
        const allTasks = tasksSnap.docs.map(t => {
          const data = t.data();
          return ({id: t.id, ...data, volunteerCompletion: data.volunteerCompletion || {}} as Task);
        });
        
        for (const task of allTasks) {
            const notesSnap = await getDocs(collection(db, "tasks", task.id, "contribution_notes"));
            task.contribution_notes = notesSnap.docs.map(n => n.data() as ContributionNote);
        }
        setEventTasks(allTasks);

        const volunteersSnap = await getDocs(collection(db, "volunteers"));
        setVolunteers(volunteersSnap.docs.map(v => ({id: v.id, ...v.data()} as Volunteer)));

      } catch (error) {
        console.error("Error fetching event details:", error);
        toast({title: "Error", description: "Could not load event details.", variant: "destructive"})
      } finally {
        setLoading(false);
      }
    };
    fetchEventData();
  }, [eventId, toast]);

  if (loading) return <div>Loading event details...</div>;
  if (!currentEvent) return <div>Event not found</div>;

  const completedTasks = eventTasks.filter((task) => task.status === "Completed").length;
  const progress = eventTasks.length > 0 ? (completedTasks / eventTasks.length) * 100 : 0;
  const getVolunteer = (id: string) => volunteers.find((v) => v.id === id);

  // --- Handlers ---
  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim() || !currentEvent) return;
    if (!isAdmin) return toast({ title: "Unauthorized", description: "Only admins can add departments.", variant: "destructive" });
    try {
        const newDeptData = { name: newDepartmentName, volunteer_ids: selectedVolunteers };
        const deptRef = await addDoc(collection(db, "events", currentEvent.id, "departments"), newDeptData);
        const newDepartment: Department = { id: deptRef.id, ...newDeptData };
        setCurrentEvent(prev => prev ? { ...prev, departments: [...prev.departments, newDepartment] } : prev);
        setNewDepartmentName(""); setSelectedVolunteers([]); setManageDeptOpen(false);
        toast({ title: "Success", description: `Department "${newDepartmentName}" created.` });
    } catch (error) {
        console.error("Error adding department:", error);
        toast({ title: "Error", description: "Could not create department.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: EventStatus) => {
    if (!currentEvent || !isAdmin) return;
    if (status === 'Postponed') setPostponeDialogOpen(true);
    else {
      try {
        const eventDocRef = doc(db, "events", currentEvent.id);
        await updateDoc(eventDocRef, { status, statusTimestamp: serverTimestamp() });
        setCurrentEvent(prev => prev ? { ...prev, status, statusTimestamp: new Date() } : prev);
        toast({ title: "Event Status Updated", description: `Event marked as ${status}.`});
      } catch (error) {
        console.error("Error updating status: ", error);
        toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
      }
    }
  };

  const handlePostponeSubmit = async () => {
    if (!postponedDate || !currentEvent || !isAdmin) return;
    try {
        const eventDocRef = doc(db, "events", currentEvent.id);
        const newDate = format(postponedDate, "yyyy-MM-dd");
        await updateDoc(eventDocRef, { status: 'Postponed', date: newDate, statusTimestamp: serverTimestamp() });
        setCurrentEvent(prev => prev ? { ...prev, status: 'Postponed', date: newDate, statusTimestamp: new Date() } : prev);
        toast({ title: "Event Postponed", description: `Event rescheduled to ${format(postponedDate, "PPP")}.`});
        setPostponeDialogOpen(false);
    } catch (error) {
        console.error("Error postponing event: ", error);
        toast({ title: "Error", description: "Could not postpone event.", variant: "destructive" });
    }
  };

  const openContributionDialog = (task: Task) => {
    setSelectedTask(task); setContributionDialogOpen(true);
  };

  const handleAddContribution = async () => {
    if (!selectedTask || !contributionVolunteer || !contributionNote.trim() || !isAdmin) {
      toast({ title: "Error", description: "Please select a volunteer and enter a note.", variant: "destructive" });
      return;
    }
    try {
        const noteData = { volunteer_id: contributionVolunteer, note: contributionNote };
        await addDoc(collection(db, "tasks", selectedTask.id, "contribution_notes"), noteData);
        const updatedTask = { ...selectedTask, contribution_notes: [...selectedTask.contribution_notes, noteData] };
        setEventTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        setSelectedTask(updatedTask); setContributionVolunteer(''); setContributionNote('');
        toast({ title: "Success", description: "Contribution note added." });
    } catch (error) {
        console.error("Error adding contribution: ", error);
        toast({ title: "Error", description: "Could not add note.", variant: "destructive" });
    }
  };

  const handleAddTask = async () => {
    if (!newTask.name || !newTask.deadline || !currentEvent || !isAdmin) {
      toast({ title: "Error", description: "Task name and deadline are required.", variant: "destructive" });
      return;
    }
    try {
      const taskData = {
        ...newTask,
        deadline: format(newTask.deadline, "yyyy-MM-dd"),
        eventId: currentEvent.id,
        status: "Pending" as TaskStatus,
        contribution_notes: [],
        volunteerCompletion: {},
      };
      const docRef = await addDoc(collection(db, "tasks"), taskData);
      setEventTasks(prev => [...prev, { id: docRef.id, ...taskData }]);
      setAddTaskOpen(false);
      setNewTask({ name: '', description: '', type: 'Individual', deadline: undefined, assigned_volunteer_ids: [] });
      toast({ title: "Success", description: "New task added." });
    } catch (error) {
      console.error("Error adding task:", error);
      toast({ title: "Error", description: "Could not add task.", variant: "destructive" });
    }
  };

  const openAssignTaskDialog = (task: Task) => {
    setSelectedTask(task); setAssignVolunteers(task.assigned_volunteer_ids); setAssignTaskOpen(true);
  };

  const handleAssignTask = async () => {
    if (!selectedTask || !isAdmin) return;
    try {
      const taskRef = doc(db, "tasks", selectedTask.id);
      await updateDoc(taskRef, { assigned_volunteer_ids: assignVolunteers });
      const updatedTask = { ...selectedTask, assigned_volunteer_ids: assignVolunteers };
      if (updatedTask.type === 'Team') {
        const initialCompletion: Record<string, boolean> = {};
        assignVolunteers.forEach(vol => { initialCompletion[vol] = false; });
        updatedTask.volunteerCompletion = initialCompletion;
        await updateDoc(taskRef, { volunteerCompletion: initialCompletion });
      }
      setEventTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      setAssignTaskOpen(false); setSelectedTask(null); setAssignVolunteers([]);
      toast({ title: "Success", description: "Task assignment updated." });
    } catch (error) {
      console.error("Error assigning task:", error);
      toast({ title: "Error", description: "Could not update task assignment.", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!isAdmin) return;
    try {
      const notesSnap = await getDocs(collection(db, "tasks", taskId, "contribution_notes"));
      const batch = writeBatch(db);
      notesSnap.docs.forEach(docSnap => batch.delete(doc(db, "tasks", taskId, "contribution_notes", docSnap.id)));
      batch.delete(doc(db, "tasks", taskId));
      await batch.commit();
      setEventTasks(prev => prev.filter(t => t.id !== taskId));
      toast({ title: "Success", description: "Task deleted successfully." });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "Could not delete task.", variant: "destructive" });
    }
  };

  const markVolunteerPresent = async (taskId: string, volunteerId: string) => {
    const task = eventTasks.find(t => t.id === taskId);
    if (!task || task.type !== "Team") return;

    const updatedCompletion = { ...task.volunteerCompletion, [volunteerId]: true };
    const allPresent = Object.values(updatedCompletion).every(v => v === true);
    const taskRef = doc(db, "tasks", taskId);

    try {
      await updateDoc(taskRef, { volunteerCompletion: updatedCompletion, status: allPresent ? "Completed" : task.status });
      setEventTasks(prev => prev.map(t => t.id === taskId ? { ...t, volunteerCompletion: updatedCompletion, status: allPresent ? "Completed" : t.status } : t));
      if (allPresent) toast({ title: "Team Task Completed", description: `${task.name} is now marked as completed.` });
    } catch (error) {
      console.error("Error updating volunteer presence:", error);
      toast({ title: "Error", description: "Could not update presence.", variant: "destructive" });
    }
  };

  const eventDate = currentEvent.date?.toDate ? currentEvent.date.toDate().toLocaleDateString() : currentEvent.date;
  const statusDate = currentEvent.statusTimestamp?.toDate ? currentEvent.statusTimestamp.toDate().toLocaleString() : 'N/A';

  return (
    <div className="grid flex-1 items-start gap-4 md:gap-8">
      {/* Header and Admin Buttons */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" asChild>
          <Link href="/events"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Back</span></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <PageHeader title={currentEvent.name} description={eventDate} />
            <Badge className={cn("capitalize text-base h-7", statusColors[currentEvent.status])}>{currentEvent.status}</Badge>
          </div>
          {currentEvent.statusTimestamp && (
            <p className="text-xs text-muted-foreground mt-1">Last updated: {statusDate}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Update Status <ChevronDown className="h-3 w-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleStatusChange("Upcoming")}>Upcoming</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("Completed")}>Completed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("Postponed")}>Postponed</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setAddTaskOpen(true)}>Add Task</Button>
            <Button variant="outline" size="sm" onClick={() => setManageDeptOpen(true)}>Manage Departments</Button>
          </div>
        )}
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>Task completion status</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3 rounded-full" />
          <p className="mt-2 text-sm">{completedTasks}/{eventTasks.length} tasks completed</p>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <ScrollArea className="max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Assigned Volunteers</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventTasks.map(task => (
              <TableRow key={task.id}>
                <TableCell>{task.name}</TableCell>
                <TableCell>{task.description}</TableCell>
                <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                <TableCell>{task.deadline}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {task.assigned_volunteer_ids.map(id => (
                    <Avatar key={id}><AvatarImage src={getVolunteer(id)?.avatar} /><AvatarFallback>{getVolunteer(id)?.name?.[0]}</AvatarFallback></Avatar>
                  ))}
                </TableCell>
                <TableCell className="flex gap-2">
                  {isAdmin && <Button variant="outline" size="sm" onClick={() => openAssignTaskDialog(task)}>Assign</Button>}
                  <Button variant="outline" size="sm" onClick={() => openContributionDialog(task)}>Add Note</Button>
                  {isAdmin && <Button variant="destructive" size="sm" onClick={() => handleDeleteTask(task.id)}>Delete</Button>}
                  {task.type === 'Team' && !isAdmin && task.assigned_volunteer_ids.includes("YOUR_USER_ID") && (
                    <Button size="sm" onClick={() => markVolunteerPresent(task.id, "YOUR_USER_ID")}>Mark Present</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Dialogs: Add Task, Assign Task, Contribution Notes, Postpone, Manage Departments */}
      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add New Task</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>Task Name</Label>
            <Input value={newTask.name} onChange={(e) => setNewTask(prev => ({...prev, name: e.target.value}))} />
            <Label>Description</Label>
            <Textarea value={newTask.description} onChange={(e) => setNewTask(prev => ({...prev, description: e.target.value}))} />
            <Label>Deadline</Label>
            <Calendar mode="single" selected={newTask.deadline} onSelect={(date) => setNewTask(prev => ({...prev, deadline: date ?? undefined}))} />
            <Label>Task Type</Label>
            <Select onValueChange={(val) => setNewTask(prev => ({...prev, type: val as "Individual" | "Team"}))}>
              <SelectTrigger><SelectValue placeholder="Select Task Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Individual">Individual</SelectItem>
                <SelectItem value="Team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleAddTask}>Add Task</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task Dialog */}
      <Dialog open={isAssignTaskOpen} onOpenChange={setAssignTaskOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Assign Task</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>Select Volunteers</Label>
            <Select onValueChange={(val) => setAssignVolunteers(val.split(","))} defaultValue={assignVolunteers.join(",")}>
              <SelectTrigger><SelectValue placeholder="Select Volunteers" /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {volunteers.map(vol => <SelectItem key={vol.id} value={vol.id}>{vol.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleAssignTask}>Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribution Note Dialog */}
      <Dialog open={isContributionDialogOpen} onOpenChange={setContributionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add Contribution Note</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>Select Volunteer</Label>
            <Select onValueChange={(val) => setContributionVolunteer(val)}>
              <SelectTrigger><SelectValue placeholder="Select Volunteer" /></SelectTrigger>
              <SelectContent>{volunteers.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Note</Label>
            <Textarea value={contributionNote} onChange={(e) => setContributionNote(e.target.value)} />
          </div>
          <DialogFooter><Button onClick={handleAddContribution}>Add Note</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Postpone Dialog */}
      <Dialog open={isPostponeDialogOpen} onOpenChange={setPostponeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Postpone Event</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>Select New Date</Label>
            <Calendar mode="single" selected={postponedDate} onSelect={setPostponedDate} />
          </div>
          <DialogFooter><Button onClick={handlePostponeSubmit}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Departments Dialog */}
      <Dialog open={isManageDeptOpen} onOpenChange={setManageDeptOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Manage Departments</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>New Department Name</Label>
            <Input value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} />
            <Label>Select Volunteers</Label>
            <Select onValueChange={(val) => setSelectedVolunteers(val.split(","))} defaultValue={selectedVolunteers.join(",")}>
              <SelectTrigger><SelectValue placeholder="Select Volunteers" /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {volunteers.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleAddDepartment}>Add Department</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
