"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { Bell, LogOut, Settings, TvMinimal, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";

type AppHeaderProps = { email?: string | null };

const soon = (
  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
    Soon
  </span>
);

export function AppHeader({ email }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const initial = email?.charAt(0).toUpperCase() ?? "N";
  const displayName = email ? email.split("@")[0] : "My Account";
  const isOrders = pathname === "/orders";

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      setSigningOut(false);
      return;
    }

    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="size-9 rounded-xl text-foreground/70 hover:bg-accent hover:text-foreground" />

        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />

        <div className="min-w-0">
          <h1 className="truncate font-(family-name:--font-display) text-lg font-medium leading-none tracking-tight sm:text-xl">
            {isOrders ? "Orders" : "Dashboard"}
          </h1>
          <p className="mt-1 hidden truncate text-xs text-muted-foreground md:block">
            {isOrders ? "Your checkout history" : "Your creative shopping workspace"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label="Notifications (coming soon)"
          title="Notifications (coming soon)"
          className="size-10 rounded-xl"
        >
          <Bell className="size-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open account menu"
            className="rounded-full outline-none transition focus-visible:ring-4 focus-visible:ring-[#D9623B]/25"
          >
            <Avatar className="size-10 cursor-pointer ring-2 ring-transparent transition hover:ring-[#D9623B]/30">
              <AvatarFallback className="bg-[#D9623B]/15 font-semibold text-[#B84A25] dark:text-[#F0A185]">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 rounded-2xl border-border p-1.5 shadow-xl"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-3 p-2.5">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-[#D9623B]/15 font-semibold text-[#B84A25] dark:text-[#F0A185]">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  {email && (
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {email}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="rounded-xl py-2.5 cursor-pointer">
              <Link href="/landing" className="group flex items-center gap-3">
                <TvMinimal />
                <div>
                  <p className="font-medium">Landing Page</p>
                  <p className="text-xs text-[#71717A] group-data-highlighted:text-[#A1A1AA]">
                    Go to the landing page
                  </p>
                </div>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled
              className="rounded-xl py-2.5 cursor-pointer"
            >
              <UserRound />
              Profile
              {soon}
            </DropdownMenuItem>

            <DropdownMenuItem
              disabled
              className="rounded-xl py-2.5 cursor-pointer "
            >
              <Settings />
              Settings
              {soon}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={signingOut}
              onClick={handleSignOut}
              className="rounded-xl py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
