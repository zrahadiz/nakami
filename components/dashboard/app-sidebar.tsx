"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Armchair,
  Bookmark,
  Gamepad2,
  LayoutGrid,
  LogOut,
  Monitor,
  Plus,
  ReceiptText,
  Settings,
  ShoppingBag,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

import { createClient } from "@/lib/supabase/client";
import { getThreads } from "@/lib/api/threads";
import type { Thread } from "@/lib/api/threads";

const mainNav = [
  { label: "My Boards", icon: LayoutGrid, href: null },
  { label: "Orders", icon: ReceiptText, href: "/orders" },
  { label: "Saved Items", icon: Bookmark, href: null },
  { label: "Bundles", icon: ShoppingBag, href: null },
];

const inspiration = [
  { label: "Living Spaces", icon: Armchair, color: "text-[#7A8B6F]" },
  { label: "Gaming Setups", icon: Gamepad2, color: "text-[#8B6CFF]" },
  {
    label: "Home Office",
    icon: Monitor,
    color: "text-[#2F3E5C] dark:text-[#9AA8C9]",
  },
];

// Shared look for menu rows: roomy touch targets, rounded, persimmon marker when active.
const rowClass =
  "relative h-10 rounded-xl px-3 text-[14px] " +
  "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium " +
  "data-[active=true]:before:absolute data-[active=true]:before:-left-2 data-[active=true]:before:top-1/2 " +
  "data-[active=true]:before:h-5 data-[active=true]:before:w-[3px] data-[active=true]:before:-translate-y-1/2 " +
  "data-[active=true]:before:rounded-full data-[active=true]:before:bg-[#D9623B]";

const groupLabelClass =
  "px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/45";

const soonBadge =
  "right-2 rounded-full bg-sidebar-accent px-2 text-[10px] font-medium text-sidebar-foreground/55";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null,
  );
  const [signingOut, setSigningOut] = useState(false);

  // Navigate and close the mobile drawer.
  function go(path: string) {
    router.push(path);
    setOpenMobile(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Failed to sign out:", error);
      setSigningOut(false);
      return;
    }

    router.replace("/sign-in");
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;

    async function loadThreads() {
      try {
        const data = await getThreads();

        if (!cancelled) {
          setThreads(data);
        }
      } catch (error) {
        console.error("Failed to load sidebar threads:", error);
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    }

    loadThreads();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!u || cancelled) return;
        setUser({
          name:
            (u.user_metadata?.full_name as string | undefined) ||
            u.email?.split("@")[0] ||
            "You",
          email: u.email ?? "",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-5 px-4 pb-3 pt-5">
        <button
          onClick={() => go("/dashboard")}
          aria-label="Nakami home"
          className="flex items-center gap-2.5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"
        >
          <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[#1E1B18] dark:bg-[#F2EDE3]">
            <span className="font-(family-name:--font-display) text-lg font-medium leading-none text-[#F6F2EA] dark:text-[#1E1B18]">
              N
            </span>
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#D9623B]" />
          </span>

          <span className="flex items-baseline gap-2">
            <span className="font-(family-name:--font-display) text-[22px] font-medium tracking-tight">
              Nakami
            </span>
            <span className="text-xs text-sidebar-foreground/40">中身</span>
          </span>
        </button>

        <button
          onClick={() => go("/dashboard")}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#D9623B] text-[15px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(217,98,59,0.9)] outline-none transition hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/30 active:scale-[0.99]"
        >
          <Plus className="size-4" />
          New board
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* MAIN NAVIGATION */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map(({ label, icon: Icon, href }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    isActive={href ? pathname === href : undefined}
                    onClick={href ? () => go(href) : undefined}
                    disabled={!href}
                    className={rowClass}
                  >
                    <Icon className="size-4.5" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                  {!href && (
                    <SidebarMenuBadge className={soonBadge}>
                      Soon
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-3 w-auto" />

        {/* INSPIRATION */}
        <SidebarGroup>
          <SidebarGroupLabel className={groupLabelClass}>
            Inspiration
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {inspiration.map(({ label, icon: Icon, color }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton disabled className={rowClass}>
                    <Icon className={`size-4.5 ${color}`} />
                    <span>{label}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className={soonBadge}>
                    Soon
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-3 w-auto" />

        {/* RECENT BOARDS */}
        <SidebarGroup>
          <div className="flex items-center justify-between pr-1">
            <SidebarGroupLabel className={groupLabelClass}>
              Recent
            </SidebarGroupLabel>

            <button
              aria-label="Start a new board"
              title="New board"
              onClick={() => go("/dashboard")}
              className="grid size-7 place-items-center rounded-lg text-sidebar-foreground/50 outline-none transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              {loadingThreads &&
                // Fixed widths: SidebarMenuSkeleton uses Math.random(), which causes hydration mismatches.
                ["78%", "62%", "85%"].map((width) => (
                  <SidebarMenuItem key={width}>
                    <div
                      className="flex h-10 items-center gap-3 px-3"
                      aria-hidden
                    >
                      <div className="size-4.5 shrink-0 animate-pulse rounded-md bg-sidebar-accent" />
                      <div
                        className="h-4 flex-1 animate-pulse rounded-md bg-sidebar-accent"
                        style={{ maxWidth: width }}
                      />
                    </div>
                  </SidebarMenuItem>
                ))}

              {!loadingThreads && threads.length === 0 && (
                <li className="mx-1 rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-center text-[13px] leading-relaxed text-sidebar-foreground/55">
                  No boards yet.
                  <br />
                  Describe a vibe to start one.
                </li>
              )}

              {threads.slice(0, 5).map((thread) => (
                <SidebarMenuItem key={thread.id}>
                  <SidebarMenuButton
                    isActive={pathname === `/workspace/${thread.id}`}
                    onClick={() => go(`/workspace/${thread.id}`)}
                    className={rowClass}
                  >
                    <LayoutGrid className="size-4.5 text-sidebar-foreground/55" />
                    <span className="truncate">{thread.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="gap-2 border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled className={rowClass}>
              <Settings className="size-4.5" />
              <span>Settings</span>
            </SidebarMenuButton>
            <SidebarMenuBadge className={soonBadge}>Soon</SidebarMenuBadge>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/70 p-2.5">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#D9623B]/15 text-sm font-semibold text-[#B84A25] dark:text-[#F0A185]"
          >
            {(user?.name ?? "N").charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {user?.name ?? "Signed in"}
            </p>
            {user?.email && (
              <p className="truncate text-xs leading-tight text-sidebar-foreground/55">
                {user.email}
              </p>
            )}
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-sidebar-foreground/55 outline-none transition hover:bg-sidebar hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 disabled:opacity-50"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
