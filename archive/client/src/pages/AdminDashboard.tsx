import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = trpc.admin.summary.useQuery(void 0, {
    enabled: user?.role === "admin",
  });
  const { data: stats, isLoading: statsLoading } = trpc.admin.featureStats.useQuery(void 0, {
    enabled: user?.role === "admin",
  });
  const { data: activity, isLoading: activityLoading } = trpc.admin.recentActivity.useQuery({}, {
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Access denied. Admin role required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">Monitor HoldOff usage and activity</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalUsers ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalEvents ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Events Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.eventsToday ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.eventsLast7Days ?? 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feature Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Feature Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.map((stat: any) => (
                <div key={stat.feature} className="flex items-center justify-between">
                  <span className="capitalize">{stat.feature.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-48 bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            (stat.count / Math.max(...stats.map((s: any) => s.count))) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="font-semibold w-12 text-right">{stat.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {activity && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="text-muted-foreground">No recent activity</p>
              ) : (
                activity.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <span className="font-medium capitalize">{item.feature}</span>
                      <span className="text-muted-foreground ml-2">{item.action}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(summaryLoading || statsLoading || activityLoading) && (
        <div className="text-center text-muted-foreground">Loading...</div>
      )}
    </div>
  );
}
