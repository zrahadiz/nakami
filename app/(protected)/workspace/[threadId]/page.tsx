import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>
}) {
  const { threadId } = await params

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Button variant="outline">
        <Link href="/home">
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
      </Button>

      <div className="mt-10">
        <h1 className="text-3xl font-bold">
          Shopping Project
        </h1>

        <p className="mt-3 text-muted-foreground">
          Project ID: {threadId}
        </p>

        <p className="mt-6">
          Your AI shopping workspace will appear here.
        </p>
      </div>
    </div>
  )
}