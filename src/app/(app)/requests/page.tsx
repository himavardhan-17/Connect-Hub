
"use client";

import { useState, useEffect } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ArrowRight, Check, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, where, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

// Define types locally
type RemappingRequest = { id: string; taskId: string; from_volunteer_id: string; to_volunteer_id: string; reason: string; status: "Pending" | "Accepted" | "Rejected"; };
type Volunteer = { id: string; name: string; avatar: string; role: 'Admin' | 'Volunteer' };
type Task = { id: string; name: string; assigned_volunteer_ids: string[] };

export default function RemappingRequestsPage() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<RemappingRequest[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [volunteersSnap, tasksSnap] = await Promise.all([
          getDocs(collection(db, "volunteers")),
          getDocs(collection(db, "tasks")),
        ]);
        
        const volunteersData = volunteersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Volunteer));
        setVolunteers(volunteersData);
        setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));

        let requestsQuery;
        if (isAdmin) {
          // Admins see all requests
          requestsQuery = query(collection(db, "remappingRequests"));
        } else if (user) {
          // Volunteers see requests sent to them
          requestsQuery = query(collection(db, "remappingRequests"), where("to_volunteer_id", "==", user.uid));
        }

        if (requestsQuery) {
            const requestsSnap = await getDocs(requestsQuery);
            setRequests(requestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as RemappingRequest)));
        }

      } catch (error) {
        console.error("Error fetching requests: ", error);
        toast({ title: "Error", description: "Failed to load requests.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast, user, isAdmin]);

  const getVolunteer = (id: string) => volunteers.find((v) => v.id === id);
  const getTask = (id: string) => tasks.find((t) => t.id === id);

  const handleRequestStatus = async (req: RemappingRequest, status: "Accepted" | "Rejected") => {
    try {
      const reqDocRef = doc(db, "remappingRequests", req.id);
      await updateDoc(reqDocRef, { status });

      if (status === 'Accepted') {
        const taskDocRef = doc(db, "tasks", req.taskId);
        const taskSnap = await getDoc(taskDocRef);
        const task = taskSnap.data() as Task;
        
        if(task) {
           const newAssignees = task.assigned_volunteer_ids
            .filter(id => id !== req.from_volunteer_id)
            .concat(req.to_volunteer_id);
           await updateDoc(taskDocRef, { assigned_volunteer_ids: newAssignees });
           // Also update local task state to reflect the change immediately
           setTasks(prev => prev.map(t => t.id === req.taskId ? {...t, assigned_volunteer_ids: newAssignees} : t));
        }
      }

      setRequests(prev => prev.map(r => r.id === req.id ? {...r, status} : r));
      toast({ title: "Success", description: `Request ${status.toLowerCase()}.` });
    } catch (error) {
      console.error(`Error ${status.toLowerCase()} request:`, error);
      toast({ title: "Error", description: "Could not update request.", variant: "destructive" });
    }
  };
  
  if (loading) return <div>Loading requests...</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader
        title="Task Remapping"
        description="Manage requests to transfer tasks between volunteers."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((req) => {
          const fromVol = getVolunteer(req.from_volunteer_id);
          const toVol = getVolunteer(req.to_volunteer_id);
          const task = getTask(req.taskId);

          if (!fromVol || !toVol || !task) return null;

          const canApprove = isAdmin || user?.uid === req.to_volunteer_id;

          return (
            <Card key={req.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="font-headline text-lg">{task.name}</CardTitle>
                    <Badge variant={req.status === 'Pending' ? 'secondary' : req.status === 'Accepted' ? 'success' : 'destructive'}>
                        {req.status}
                    </Badge>
                </div>
                <CardDescription>Request to transfer task</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={fromVol.avatar} alt={fromVol.name} />
                      <AvatarFallback>{fromVol.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{fromVol.name}</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={toVol.avatar} alt={toVol.name} />
                      <AvatarFallback>{toVol.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{toVol.name}</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground border-l-2 pl-3">
                  <span className="font-medium text-foreground">Reason:</span> {req.reason}
                </div>
              </CardContent>
              {req.status === 'Pending' && canApprove && (
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleRequestStatus(req, 'Rejected')}>
                        <X className="mr-2 h-4 w-4" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => handleRequestStatus(req, 'Accepted')}>
                        <Check className="mr-2 h-4 w-4" /> Approve
                    </Button>
              </CardFooter>
              )}
            </Card>
          );
        })}
         {requests.length === 0 && !loading && (
            <div className="col-span-full text-center text-muted-foreground">
                No remapping requests found.
            </div>
        )}
      </div>
    </div>
  );
}
