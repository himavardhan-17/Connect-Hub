"use client";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
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
import { Textarea } from "@/components/ui/textarea";

type Announcement = {
  id: string;
  title: string;
  content: string;
  date: any;
  author: string;
};

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const { isAdmin, volunteer } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
  });

  // Format Firestore timestamp or JS Date safely
  const formatDate = (date: any) => {
    if (!date) return "";
    return date.toDate
      ? date.toDate().toLocaleDateString()
      : new Date(date).toLocaleDateString();
  };

  // Fetch all announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "announcements"),
          orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(q);
        const announcementsList = querySnapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Announcement)
        );
        setAnnouncements(announcementsList);
      } catch (error) {
        console.error("Error fetching announcements: ", error);
        toast({
          title: "Error",
          description: "Could not fetch announcements.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [toast]);

  // Create new announcement
  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast({
        title: "Error",
        description: "Please fill out all fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const announcementData = {
        ...newAnnouncement,
        author: volunteer?.name || "Unknown",
        date: serverTimestamp(),
      };
      const docRef = await addDoc(
        collection(db, "announcements"),
        announcementData
      );

      // Show immediately with local date
      const displayData = {
        ...announcementData,
        id: docRef.id,
        date: new Date(),
      };

      setAnnouncements((prev) => [displayData as Announcement, ...prev]);
      setCreateDialogOpen(false);
      setNewAnnouncement({ title: "", content: "" });
      toast({
        title: "Success",
        description: "New announcement has been posted.",
      });
    } catch (error) {
      console.error("Error creating announcement:", error);
      toast({
        title: "Error",
        description: "Could not post announcement.",
        variant: "destructive",
      });
    }
  };

  // Delete announcement
  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast({
        title: "Deleted",
        description: "Announcement has been removed.",
      });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast({
        title: "Error",
        description: "Could not delete announcement.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-10">Loading announcements...</div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <PageHeader
        title="Announcements"
        description="Latest news and updates for all volunteers."
      >
        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Announcement</DialogTitle>
                <DialogDescription>
                  Enter the details for the new announcement.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="announcement-title">Title</Label>
                  <Input
                    id="announcement-title"
                    placeholder="e.g. Weekly Meeting Reminder"
                    value={newAnnouncement.title}
                    onChange={(e) =>
                      setNewAnnouncement({
                        ...newAnnouncement,
                        title: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-content">Content</Label>
                  <Textarea
                    id="announcement-content"
                    placeholder="Write your announcement here..."
                    value={newAnnouncement.content}
                    onChange={(e) =>
                      setNewAnnouncement({
                        ...newAnnouncement,
                        content: e.target.value,
                      })
                    }
                    rows={5}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateAnnouncement}>
                  Post Announcement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No announcements yet.
          </p>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-headline">
                    {announcement.title}
                  </CardTitle>
                  <CardDescription>
                    Posted on {formatDate(announcement.date)} by{" "}
                    {announcement.author}
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                  >
                    Delete
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {announcement.content}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
