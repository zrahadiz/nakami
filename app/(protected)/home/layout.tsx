// app/home/layout.tsx
import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { AppHeader } from '@/components/dashboard/app-header'

import { createClient } from '@/lib/supabase/server'

// The layout itself is synchronous, so Next.js can prerender a static shell.
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeShell>{children}</HomeShell>
    </Suspense>
  )
}

// Everything that depends on the request (session, current time) lives here.
async function HomeShell({
  children,
}: {
  children: React.ReactNode
}) {
  await connection() // render at request time, not during prerender

  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) {
    redirect('/sign-in')
  }

  const email =
    typeof data.claims.email === 'string'
      ? data.claims.email
      : undefined

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <AppHeader email={email} />

        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

// Shown for a moment while the session is checked: matches the header height.
function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border" />
    </div>
  )
}