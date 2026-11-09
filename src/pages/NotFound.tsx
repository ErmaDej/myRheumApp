import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'

export const NotFound = () => (
  <div className="flex min-h-dvh items-center justify-center bg-surface px-4">
    <Card className="w-full max-w-md p-6">
      <EmptyState
        icon={<Compass className="size-6" aria-hidden />}
        title="This page does not exist"
        description="The link may be outdated. Return to your dashboard to keep tracking."
        action={
          <Link to="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    </Card>
  </div>
)

export default NotFound
