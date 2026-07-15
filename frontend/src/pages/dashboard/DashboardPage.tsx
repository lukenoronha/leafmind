import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { PageHeader } from '@/components/common/PageHeader'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your LeafMind activity."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['Recent identifications', 'Saved species', 'Model insights'].map(
          (title) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>Coming soon.</CardDescription>
              </CardHeader>
            </Card>
          ),
        )}
      </div>
    </div>
  )
}
