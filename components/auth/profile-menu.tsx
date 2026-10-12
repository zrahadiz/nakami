'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface ProfileMenuProps {
  user: User
}

export function ProfileMenu({ user }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Get initials from the user's name or email
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    'User'

  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function handleLogout() {
    const supabase = createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Failed to log out:', error.message)
      return
    }

    setIsOpen(false)
    router.refresh()
    router.push('/')
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile avatar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E1B18] text-sm font-semibold text-[#F6F2EA] transition hover:bg-[#38332E]"
      >
        {initials}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-[#DDD4C4] bg-[#F6F2EA] p-2 shadow-xl"
        >
          {/* User information */}
          <div className="border-b border-[#DDD4C4] px-3 py-3">
            <p className="text-sm font-semibold text-[#1E1B18]">
              {displayName}
            </p>

            {user.email && (
              <p className="mt-1 truncate text-xs text-[#756D63]">
                {user.email}
              </p>
            )}
          </div>

          {/* Profile links */}
          <div className="py-1">
            <Link
              href="/home"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm text-[#1E1B18] transition hover:bg-[#EAE3D7]"
            >
              My workspace
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-[#DDD4C4] pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}