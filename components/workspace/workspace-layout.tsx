'use client'

import { useState, type ReactNode } from 'react'
import {
  MessageSquare,
  LayoutGrid,
  ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type WorkspaceTab = 'chat' | 'board' | 'preview'

interface WorkspaceLayoutProps {
  tab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  itemCount: number

  chat: ReactNode
  board: ReactNode
  preview: ReactNode
}

export function WorkspaceLayout({
  tab,
  onTabChange,
  itemCount,
  chat,
  board,
  preview,
}: WorkspaceLayoutProps) {
  const [chatVisible, setChatVisible] = useState(true)

  const activeContent = tab === 'preview' ? preview : board

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">

      {/* MOBILE NAVIGATION */}
      <div className="flex shrink-0 items-center border-b bg-background p-2 lg:hidden">
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(
            [
              { value: 'chat', label: 'Chat', icon: MessageSquare },
              { value: 'board', label: 'Products', icon: LayoutGrid },
              { value: 'preview', label: 'Preview', icon: ImageIcon },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onTabChange(value)}
              aria-pressed={tab === value}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="size-4" />

              <span>{label}</span>

              {value === 'board' && itemCount > 0 && (
                <span className="text-xs opacity-70">
                  {itemCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* DESKTOP WORKSPACE */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full w-full"
        >
          {chatVisible && (
            <>
              <ResizablePanel
                defaultSize={32}
                minSize={24}
                maxSize={50}
              >
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-4 text-primary" />
                      <span className="text-sm font-semibold">
                        Nakami AI
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setChatVisible(false)}
                      aria-label="Collapse chat"
                    >
                      <PanelLeftClose className="size-4" />
                    </Button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    {chat}
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel
            defaultSize={chatVisible ? 68 : 100}
            minSize={50}
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {/* PRODUCT TOOLBAR */}
              <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
                <div className="flex items-center gap-2">
                  {!chatVisible && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setChatVisible(true)}
                      aria-label="Expand chat"
                    >
                      <PanelLeftOpen className="size-4" />
                    </Button>
                  )}

                  <span className="text-sm font-semibold">
                    Shopping Workspace
                  </span>

                  <Badge variant="secondary">
                    {itemCount} items
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg bg-muted p-1">
                    <Button
                      variant={tab !== 'preview' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => onTabChange('board')}
                      className="h-8 gap-2"
                    >
                      <LayoutGrid className="size-4" />
                      Products
                    </Button>

                    <Button
                      variant={tab === 'preview' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => onTabChange('preview')}
                      className="h-8 gap-2"
                    >
                      <ImageIcon className="size-4" />
                      Preview
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* BOARD / PREVIEW */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {activeContent}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* MOBILE WORKSPACE */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        <div className={tab === 'chat' ? 'min-h-0 flex-1' : 'hidden'}>
          {chat}
        </div>

        <div className={tab === 'board' ? 'min-h-0 flex-1' : 'hidden'}>
          {board}
        </div>

        <div className={tab === 'preview' ? 'min-h-0 flex-1' : 'hidden'}>
          {preview}
        </div>
      </div>
    </div>
  )
}