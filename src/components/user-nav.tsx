
"use client";

import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";


export function UserNav() {
  const { volunteer, user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!volunteer || !user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9 border-2 border-primary/50">
            <AvatarImage data-ai-hint="person" src={volunteer.avatar} alt={volunteer.name} />
            <AvatarFallback>{volunteer.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none font-headline">{volunteer.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {volunteer.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/profile" passHref>
          <DropdownMenuItem>
            Profile
          </DropdownMenuItem>
        </Link>
        <DropdownMenuItem disabled>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            Log out
          </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
