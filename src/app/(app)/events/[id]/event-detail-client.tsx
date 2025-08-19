
"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  NotebookPen,
  PlusCircle,
  Users,
  Calendar as CalendarIcon
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
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

// Define types locally
type EventStatus = "Upcoming" | "Completed" | "Postponed";
type Volunteer = { id: string; name: string; email:string; avatar: string; };
type Department = { id: string; name: string; volunteer_ids: string[]; };
type ContributionNote = { volunteer_id: string; note: string };
type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
type Task = { id: string; eventId: string; name: string; description: string; status: TaskStatus; assigned_volunteer_ids: string[]; type: 'Individual' | 'Team'; deadline: string; contribution_notes: ContributionNote[] };
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
        const allTasks = tasksSnap.docs.map(t => ({id: t.id, ...t.data()}) as Task);
        
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

  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim() || !currentEvent) return;
    if (!isAdmin) {
        toast({ title: "Unauthorized", description: "Only admins can add departments.", variant: "destructive" });
        return;
    }
    try {
        const newDeptData = { name: newDepartmentName, volunteer_ids: selectedVolunteers };
        const deptRef = await addDoc(collection(db, "events", currentEvent.id, "departments"), newDeptData);
        const newDepartment: Department = { id: deptRef.id, ...newDeptData };
        setCurrentEvent(prev => prev ? { ...prev, departments: [...prev.departments, newDepartment] } : prev);
        setNewDepartmentName("");
        setSelectedVolunteers([]);
        setManageDeptOpen(false);
        toast({ title: "Success", description: `Department "${newDepartmentName}" created.` });
    } catch (error) {
        console.error("Error adding department:", error);
        toast({ title: "Error", description: "Could not create department.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: EventStatus) => {
    if (!currentEvent || !isAdmin) return;
    if (status === 'Postponed') {
        setPostponeDialogOpen(true);
    } else {
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
  }

  const openContributionDialog = (task: Task) => {
    setSelectedTask(task);
    setContributionDialogOpen(true);
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
        setSelectedTask(updatedTask);
        setContributionVolunteer('');
        setContributionNote('');
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
    setSelectedTask(task);
    setAssignVolunteers(task.assigned_volunteer_ids);
    setAssignTaskOpen(true);
  };

  const handleAssignTask = async () => {
    if (!selectedTask || !isAdmin) return;
    try {
      const taskRef = doc(db, "tasks", selectedTask.id);
      await updateDoc(taskRef, { assigned_volunteer_ids: assignVolunteers });
      setEventTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, assigned_volunteer_ids: assignVolunteers } : t));
      setAssignTaskOpen(false);
      setSelectedTask(null);
      setAssignVolunteers([]);
      toast({ title: "Success", description: "Task assignment updated." });
    } catch (error) {
      console.error("Error assigning task:", error);
      toast({ title: "Error", description: "Could not update task assignment.", variant: "destructive" });
    }
  };
  
  const eventDate = currentEvent.date?.toDate ? currentEvent.date.toDate().toLocaleDateString() : currentEvent.date;
  const statusDate = currentEvent.statusTimestamp?.toDate ? currentEvent.statusTimestamp.toDate().toLocaleString() : 'N/A';

  return (
    <div className="grid flex-1 items-start gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" asChild>
          <Link href="/events">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div className="flex-1">
            <div className="flex items-center gap-4">
                <PageHeader title={currentEvent.name} description={eventDate} />
                 <Badge className={cn("capitalize text-base h-7", statusColors[currentEvent.status])}>
                    {currentEvent.status}
                </Badge>
            </div>
            {currentEvent.statusTimestamp && (
                 <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {statusDate}
                </p>
            )}
        </div>
        <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Update Status
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleStatusChange("Upcoming")}>Upcoming</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("Completed")}>Completed</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("Postponed")}>Postponed</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
             <Dialog open={isPostponeDialogOpen} onOpenChange={setPostponeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Postpone Event</DialogTitle>
                        <DialogDescription>Select a new date for the event.</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center">
                        <Calendar mode="single" selected={postponedDate} onSelect={setPostponedDate} initialFocus />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPostponeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handlePostponeSubmit} disabled={!isAdmin}>Save New Date</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isManageDeptOpen} onOpenChange={setManageDeptOpen}>
              <DialogTrigger asChild>
                {isAdmin && <Button variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Departments
                </Button>}
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Manage Departments</DialogTitle>
                  <DialogDescription>Create and assign volunteers to departments for this event.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="font-semibold text-sm">Existing Departments</Label>
                        <ScrollArea className="h-[150px] rounded-md border p-2">
                            {currentEvent.departments.length > 0 ? currentEvent.departments.map(dept => (
                                <div key={dept.id} className="p-2 rounded-md hover:bg-muted">
                                   <div className="flex justify-between items-center"><p className="font-medium">{dept.name}</p></div>
                                   <div className="flex -space-x-2 mt-1">
                                    {dept.volunteer_ids.map(volId => {
                                      const vol = getVolunteer(volId);
                                      return vol ? (
                                        <Avatar key={vol.id} className="h-6 w-6 border-2 border-background">
                                            <AvatarImage src={vol.avatar} alt={vol.name}/>
                                            <AvatarFallback>{vol.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                      ) : null
                                    })}
                                  </div>
                                </div>
                            )) : <p className="text-sm text-muted-foreground p-2">No departments yet.</p>}
                        </ScrollArea>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-dept" className="font-semibold text-sm">Create New Department</Label>
                        <Input id="new-dept" placeholder="e.g. Catering Team" value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label className="font-semibold text-sm">Assign Volunteers</Label>
                        <ScrollArea className="h-[200px] rounded-md border p-2">
                            <div className="space-y-2">
                            {volunteers.map(volunteer => (
                                <div key={volunteer.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
                                    <Checkbox 
                                        id={`vol-dept-${volunteer.id}`} 
                                        onCheckedChange={(checked) => setSelectedVolunteers(prev => checked ? [...prev, volunteer.id] : prev.filter(id => id !== volunteer.id))}
                                        checked={selectedVolunteers.includes(volunteer.id)}
                                    />
                                    <Avatar className="h-8 w-8"><AvatarImage src={volunteer.avatar} alt={volunteer.name} /><AvatarFallback>{volunteer.name.charAt(0)}</AvatarFallback></Avatar>
                                    <div><Label htmlFor={`vol-dept-${volunteer.id}`} className="font-medium cursor-pointer">{volunteer.name}</Label><p className="text-xs text-muted-foreground">{volunteer.email}</p></div>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={() => setManageDeptOpen(false)} variant="outline">Cancel</Button>
                    <Button type="button" onClick={handleAddDepartment} disabled={!isAdmin}>Add Department</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isAddTaskOpen} onOpenChange={setAddTaskOpen}>
              <DialogTrigger asChild>
                {isAdmin && <Button><PlusCircle className="mr-2 h-4 w-4" />Add Task</Button>}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Task</DialogTitle><DialogDescription>Enter details for a new task for this event.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label htmlFor="task-name">Task Name</Label><Input id="task-name" placeholder="e.g. Set up sound system" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} /></div>
                  <div className="space-y-2"><Label htmlFor="task-desc">Description</Label><Textarea id="task-desc" placeholder="Describe the task..." value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} /></div>
                  <div className="space-y-2"><Label htmlFor="task-type">Task Type</Label><Select onValueChange={(value: 'Individual' | 'Team') => setNewTask({...newTask, type: value})} value={newTask.type}><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent><SelectItem value="Individual">Individual</SelectItem><SelectItem value="Team">Team</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Deadline</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !newTask.deadline && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{newTask.deadline ? format(newTask.deadline, "PPP") : <span>Pick a deadline</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newTask.deadline} onSelect={(date) => setNewTask({...newTask, deadline: date})} initialFocus /></PopoverContent></Popover></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setAddTaskOpen(false)}>Cancel</Button><Button onClick={handleAddTask} disabled={!isAdmin}>Add Task</Button></DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
      </div>
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
         <Card>
          <CardHeader><CardTitle className="font-headline">Event Progress</CardTitle><CardDescription>{currentEvent.description}</CardDescription></CardHeader>
          <CardContent><div className="flex justify-between items-center mb-1"><span className="text-sm font-medium">{completedTasks} of {eventTasks.length} tasks completed</span><span className="text-sm font-bold">{progress.toFixed(0)}%</span></div><Progress value={progress} aria-label={`${progress.toFixed(0)}% complete`} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-headline">Tasks</CardTitle><CardDescription>All tasks associated with this event.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Department</TableHead><TableHead>Assigned To</TableHead><TableHead>Contributions</TableHead><TableHead>Deadline</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {eventTasks.map((task) => {
                  const department = currentEvent.departments.find(d => d.volunteer_ids.some(vid => task.assigned_volunteer_ids.includes(vid)));
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell><Badge variant="outline">{department ? department.name : 'N/A'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex -space-x-2">
                          {task.assigned_volunteer_ids.map((volId) => {
                            const vol = getVolunteer(volId);
                            return vol ? (<Avatar key={vol.id} className="h-8 w-8 border-2 border-background"><AvatarImage src={vol.avatar} alt={vol.name}/><AvatarFallback>{vol.name.charAt(0)}</AvatarFallback></Avatar>) : null
                          })}
                        </div>
                      </TableCell>
                       <TableCell>{task.type === "Team" && isAdmin && (<Button variant="outline" size="sm" onClick={() => openContributionDialog(task)}><NotebookPen className="mr-2 h-4 w-4" /> Notes</Button>)}</TableCell>
                      <TableCell>{new Date(task.deadline).toLocaleDateString()}</TableCell>
                      <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                      <TableCell>{isAdmin && (<Button variant="outline" size="sm" onClick={() => openAssignTaskDialog(task)}>Assign</Button>)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={isContributionDialogOpen} onOpenChange={setContributionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Contribution Notes: {selectedTask?.name}</DialogTitle><DialogDescription>Add and view detailed notes on each volunteer's contribution to this task.</DialogDescription></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-4"><Label className="font-semibold text-sm">Existing Notes</Label>
              <ScrollArea className="h-48 rounded-md border p-2">
                {selectedTask?.contribution_notes && selectedTask.contribution_notes.length > 0 ? (
                  selectedTask.contribution_notes.map((note, index) => {
                    const volunteer = getVolunteer(note.volunteer_id);
                    return (<div key={index} className="p-2 mb-2 rounded-md bg-muted/50"><div className="flex items-center gap-2 mb-1"><Avatar className="h-6 w-6"><AvatarImage src={volunteer?.avatar} alt={volunteer?.name}/><AvatarFallback>{volunteer?.name.charAt(0)}</AvatarFallback></Avatar><p className="font-semibold text-xs">{volunteer?.name}</p></div><p className="text-sm pl-8">{note.note}</p></div>)
                  })
                ) : (<p className="text-sm text-muted-foreground p-2">No contribution notes yet.</p>)}
              </ScrollArea>
            </div>
            <div className="space-y-2"><Label htmlFor="contribution-volunteer" className="font-semibold text-sm">Add New Note</Label>
               <Select onValueChange={setContributionVolunteer} value={contributionVolunteer}><SelectTrigger id="contribution-volunteer"><SelectValue placeholder="Select a volunteer..." /></SelectTrigger><SelectContent>{selectedTask?.assigned_volunteer_ids.map(volId => { const vol = getVolunteer(volId); return vol ? <SelectItem key={vol.id} value={vol.id}>{vol.name}</SelectItem> : null })}</SelectContent></Select>
            </div>
             <div className="space-y-2"><Label htmlFor="contribution-note" className="sr-only">Contribution Note</Label><Textarea id="contribution-note" placeholder="Describe the volunteer's contribution..." value={contributionNote} onChange={e => setContributionNote(e.target.value)}/></div>
          </div>
          <DialogFooter><Button type="button" onClick={() => setContributionDialogOpen(false)} variant="outline">Close</Button><Button type="button" onClick={handleAddContribution} disabled={!isAdmin}>Add Note</Button></DialogFooter>
        </DialogContent>
      </Dialog>
       <Dialog open={isAssignTaskOpen} onOpenChange={setAssignTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Task: {selectedTask?.name}</DialogTitle><DialogDescription>Select volunteers to assign to this task.</DialogDescription></DialogHeader>
          <ScrollArea className="h-[400px] rounded-md border p-2">
            <div className="space-y-2">
            {volunteers.map(volunteer => (
                <div key={volunteer.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
                    <Checkbox 
                        id={`vol-assign-${volunteer.id}`} 
                        onCheckedChange={(checked) => setAssignVolunteers(prev => checked ? [...prev, volunteer.id] : prev.filter(id => id !== volunteer.id))}
                        checked={assignVolunteers.includes(volunteer.id)}
                    />
                    <Avatar className="h-8 w-8"><AvatarImage src={volunteer.avatar} alt={volunteer.name} /><AvatarFallback>{volunteer.name.charAt(0)}</AvatarFallback></Avatar>
                    <div><Label htmlFor={`vol-assign-${volunteer.id}`} className="font-medium cursor-pointer">{volunteer.name}</Label><p className="text-xs text-muted-foreground">{volunteer.email}</p></div>
                </div>
            ))}
            </div>
          </ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setAssignTaskOpen(false)}>Cancel</Button><Button onClick={handleAssignTask} disabled={!isAdmin}>Save Assignment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
