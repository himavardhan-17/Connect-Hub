"use client";

import { useState, useEffect } from "react";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "@/context/auth-context";

type Volunteer = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "Admin" | "Volunteer";
};

export default function VolunteersPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);

  const [newVolunteer, setNewVolunteer] = useState({
    name: "",
    email: "",
    role: "Volunteer" as "Admin" | "Volunteer",
    password: "",
    avatar: "",
  });

  // Fetch volunteers
  useEffect(() => {
    const fetchVolunteers = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "volunteers"));
        const volunteerList = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Volunteer))
          .sort((a, b) => (a.role === "Admin" && b.role !== "Admin" ? -1 : 1));
        setVolunteers(volunteerList);
      } catch (error) {
        console.error("Error fetching volunteers: ", error);
        toast({
          title: "Error",
          description: "Could not fetch volunteers.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchVolunteers();
  }, [toast]);

  // Add new volunteer
  const handleAddVolunteer = async () => {
    if (!newVolunteer.name.trim() || !newVolunteer.email.trim() || !newVolunteer.password.trim()) {
      toast({
        title: "Error",
        description: "Name, email, and password are required.",
        variant: "destructive",
      });
      return;
    }

    if (newVolunteer.avatar && !/^https?:\/\//.test(newVolunteer.avatar)) {
      toast({
        title: "Invalid URL",
        description: "Avatar URL must start with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newVolunteer.email,
        newVolunteer.password
      );
      const user = userCredential.user;

      const newEntryData = {
        name: newVolunteer.name,
        email: newVolunteer.email,
        avatar: newVolunteer.avatar || `https://i.pravatar.cc/150?u=${newVolunteer.email}`,
        role: newVolunteer.role,
      };

      await setDoc(doc(db, "volunteers", user.uid), newEntryData);

      const newEntry: Volunteer = { id: user.uid, ...newEntryData };

      setVolunteers((prev) =>
        [...prev, newEntry].sort((a, b) => (a.role === "Admin" && b.role !== "Admin" ? -1 : 1))
      );
      setNewVolunteer({ name: "", email: "", role: "Volunteer", password: "", avatar: "" });
      setAddDialogOpen(false);
      toast({
        title: "Success",
        description: "New volunteer has been added.",
      });
    } catch (error: any) {
      console.error("Error adding volunteer:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add volunteer.",
        variant: "destructive",
      });
    }
  };

  // Update volunteer
  const handleUpdateVolunteer = async () => {
    if (!editingVolunteer) return;

    try {
      const { id, name, email, avatar, role } = editingVolunteer;
      await setDoc(doc(db, "volunteers", id), { name, email, avatar, role });

      setVolunteers((prev) =>
        prev
          .map((vol) => (vol.id === id ? editingVolunteer : vol))
          .sort((a, b) => (a.role === "Admin" && b.role !== "Admin" ? -1 : 1))
      );

      setEditingVolunteer(null);
      toast({
        title: "Updated",
        description: "Volunteer details updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update volunteer.",
        variant: "destructive",
      });
    }
  };

  // Delete volunteer
  const handleDeleteVolunteer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this volunteer?")) return;
    try {
      await deleteDoc(doc(db, "volunteers", id));
      setVolunteers((prev) => prev.filter((vol) => vol.id !== id));
      toast({
        title: "Deleted",
        description: "Volunteer has been deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete volunteer.",
        variant: "destructive",
      });
    }
  };

  if (loading) return <div>Loading volunteers...</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader
        title="Volunteers"
        description="Manage your organization's volunteers."
      >
        {isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Volunteer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Volunteer</DialogTitle>
                <DialogDescription>
                  Enter the details of the new volunteer. An auth account will be created.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. John Doe"
                    value={newVolunteer.name}
                    onChange={(e) =>
                      setNewVolunteer({ ...newVolunteer, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g. john.doe@example.com"
                    value={newVolunteer.email}
                    onChange={(e) =>
                      setNewVolunteer({ ...newVolunteer, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={newVolunteer.password}
                    onChange={(e) =>
                      setNewVolunteer({ ...newVolunteer, password: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar URL</Label>
                  <Input
                    id="avatar"
                    placeholder="https://example.com/avatar.jpg"
                    value={newVolunteer.avatar}
                    onChange={(e) =>
                      setNewVolunteer({ ...newVolunteer, avatar: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    onValueChange={(value: "Admin" | "Volunteer") =>
                      setNewVolunteer({ ...newVolunteer, role: value })
                    }
                    value={newVolunteer.role}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Volunteer">Volunteer</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddVolunteer}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Volunteer Roster</CardTitle>
          <CardDescription>A list of all registered volunteers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volunteers.map((volunteer) => (
                <TableRow key={volunteer.id}>
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={volunteer.avatar} alt={volunteer.name} />
                      <AvatarFallback>{volunteer.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{volunteer.name}</TableCell>
                  <TableCell>{volunteer.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={volunteer.role === "Admin" ? "destructive" : "secondary"}
                    >
                      {volunteer.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={!isAdmin}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingVolunteer(volunteer)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteVolunteer(volunteer.id)}
                          className="text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Volunteer Dialog */}
      <Dialog open={!!editingVolunteer} onOpenChange={() => setEditingVolunteer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Volunteer</DialogTitle>
            <DialogDescription>Edit the details of the volunteer.</DialogDescription>
          </DialogHeader>
          {editingVolunteer && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingVolunteer.name}
                  onChange={(e) =>
                    setEditingVolunteer({ ...editingVolunteer, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editingVolunteer.email}
                  onChange={(e) =>
                    setEditingVolunteer({ ...editingVolunteer, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Avatar URL</Label>
                <Input
                  value={editingVolunteer.avatar}
                  onChange={(e) =>
                    setEditingVolunteer({ ...editingVolunteer, avatar: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editingVolunteer.role}
                  onValueChange={(value: "Admin" | "Volunteer") =>
                    setEditingVolunteer({ ...editingVolunteer, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Volunteer">Volunteer</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVolunteer(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateVolunteer}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
