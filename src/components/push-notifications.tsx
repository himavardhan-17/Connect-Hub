"use client";

import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export function PushNotifications() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  const requestPermission = () => {
    Notification.requestPermission().then((permission) => {
      setPermission(permission);
      if (permission === "granted") {
        toast({
          title: "Notifications Enabled",
          description: "You will now receive push notifications.",
        });
        // You would typically send the subscription to your server here
        // For demonstration, we'll just show a local notification
        new Notification("TaskFlow Connect", {
          body: "You're all set up for notifications!",
          icon: "/logo.png",
        });
      } else {
        toast({
          title: "Notifications Blocked",
          description: "You can enable notifications in your browser settings.",
          variant: "destructive",
        });
      }
    });
  };

  if (permission === "granted") {
    return (
       <Button variant="ghost" size="icon" className="rounded-full text-primary">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications Enabled</span>
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="icon" className="rounded-full" onClick={requestPermission}>
      <Bell className="h-5 w-5" />
      <span className="sr-only">Enable Notifications</span>
    </Button>
  );
}
