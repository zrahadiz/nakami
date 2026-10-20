"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProfileMenu } from "../auth/profile-menu";

type AppHeaderProps = { email?: string | null };

export function AppHeader({ email }: AppHeaderProps) {
  const pathname = usePathname();
  const isOrders = pathname === "/orders";

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
            {isOrders
              ? "Your checkout history"
              : "Your creative shopping workspace"}
          </p>
        </div>
      </div>

      <ProfileMenu email={email} />
    </header>
  );
}
