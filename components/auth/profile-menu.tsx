"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, TvMinimal } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

/** The parts of a Supabase user this menu needs (so you can pass `user` straight in). */
type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type ProfileMenuProps = {
  /** Pass a Supabase user (landing navbar)... */
  user?: UserLike | null;
  /** ...or just the pieces (dashboard header). These override `user`. */
  email?: string | null;
  name?: string | null;
  /** Where the menu is shown. It links to the other area. Default: "app". */
  location?: "landing" | "app";
  /** Where to go after signing out. Default: "/" on the landing page, "/sign-in" in the app. */
  signOutRedirect?: string;
};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function getInitials(name: string | null, email: string | null) {
  const source = name ?? email?.split("@")[0] ?? "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);

  const letters =
    parts.length > 1
      ? parts[0][0] + parts[1][0]
      : (parts[0]?.slice(0, 2) ?? "");

  return (letters || "N").toUpperCase();
}

export function ProfileMenu({
  user,
  email: emailProp,
  name: nameProp,
  location = "app",
  signOutRedirect,
}: ProfileMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const email = emailProp ?? user?.email ?? null;
  const name =
    asString(nameProp) ??
    asString(user?.user_metadata?.full_name) ??
    asString(user?.user_metadata?.name);

  const displayName = name ?? (email ? email.split("@")[0] : "My account");
  const initials = getInitials(name, email);

  // The menu links to the *other* area of the app.
  const switchLink =
    location === "landing"
      ? {
          href: "/dashboard",
          label: "Dashboard",
          description: "Open your workspace",
          Icon: LayoutDashboard,
        }
      : {
          href: "/landing",
          label: "Landing page",
          description: "Go to the home page",
          Icon: TvMinimal,
        };

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Failed to sign out:", error.message);
      setSigningOut(false);
      return;
    }

    router.replace(
      signOutRedirect ?? (location === "landing" ? "/" : "/sign-in"),
    );
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="rounded-full outline-none transition focus-visible:ring-4 focus-visible:ring-[#D9623B]/25"
      >
        <Avatar className="size-10 cursor-pointer ring-2 ring-transparent transition hover:ring-[#D9623B]/30">
          <AvatarFallback className="bg-[#D9623B]/15 font-semibold text-[#B84A25] dark:text-[#F0A185]">
            {initials}
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
                {initials}
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

        {/* onClick (not a nested <Link>) so the whole row is clickable */}
        <DropdownMenuItem
          onClick={() => router.push(switchLink.href)}
          className="cursor-pointer gap-3 rounded-xl py-2.5"
        >
          <switchLink.Icon />
          <div>
            <p className="font-medium">{switchLink.label}</p>
            <p className="text-xs text-muted-foreground">
              {switchLink.description}
            </p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={signingOut}
          onClick={handleSignOut}
          className="cursor-pointer rounded-xl py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
