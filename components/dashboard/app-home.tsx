import { PromptComposer } from './prompt-composer'
import { RecentProjects } from './recent-projects'

export function AppHome() {
  return (
    <div
      className="min-h-full px-5 py-12 lg:px-10 lg:py-16"
      style={{
        backgroundImage:
          'radial-gradient(#e5e1eb 0.8px, transparent 0.8px)',
        backgroundSize: '24px 24px',
      }}
    >
      <PromptComposer />

      <RecentProjects />
    </div>
  )
}