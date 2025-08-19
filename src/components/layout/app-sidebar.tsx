"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  LayoutGrid,
  ListChecks,
  Repeat,
  User,
  Megaphone,
  Video,
  Users,
  Archive,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/events", icon: CalendarClock, label: "Events" },
  { href: "/events/past", icon: Archive, label: "Past Events" },
  { href: "/tasks", icon: ListChecks, label: "My Tasks" },
  { href: "/announcements", icon: Megaphone, label: "Announcements" },
  { href: "/meetings", icon: Video, label: "Meetings" },
  { href: "/requests", icon: Repeat, label: "Requests" },
  { href: "/volunteers", icon: Users, label: "Volunteers" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function AppSidebar({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();

  const navContent = (
    <nav
      className={cn(
        "flex flex-col items-center gap-4 px-2",
        isMobile && "items-start gap-2"
      )}
    >
      {navItems.map((item) => {
        const isActive =
          (item.href !== "/dashboard" && pathname.startsWith(item.href)) ||
          pathname === item.href;
        const linkClasses = cn(
          "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
          { "bg-accent text-accent-foreground": isActive },
          isMobile && "w-full justify-start gap-2 p-2 h-auto"
        );
        const iconClasses = cn("h-5 w-5", isMobile && "h-4 w-4");

        const linkContent = (
          <>
            <item.icon className={iconClasses} />
            <span className={cn("sr-only", isMobile && "not-sr-only")}>
              {item.label}
            </span>
          </>
        );

        return isMobile ? (
          <Link key={item.href} href={item.href} className={linkClasses}>
            {linkContent}
          </Link>
        ) : (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link href={item.href} className={linkClasses}>
                {linkContent}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex",
          isMobile && "static z-auto flex w-full border-r-0"
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center justify-center border-b px-4",
            isMobile && "justify-start"
          )}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <div className="flex h-18 w-18 items-center justify-center rounded-full ">
              <img
                src="/connect.ico"
                alt="TaskFlow Logo"
                className="h-26 w-26"
              />
            </div>
            <span
              className={cn(
                "sr-only",
                isMobile && "not-sr-only font-headline text-lg"
              )}
            >
              TaskFlow
            </span>
          </Link>
        </div>
        <div className={cn("flex-1", isMobile ? "p-2" : "mt-4")}>
          {navContent}
        </div>
      </aside>
    </TooltipProvider>
  );
}
