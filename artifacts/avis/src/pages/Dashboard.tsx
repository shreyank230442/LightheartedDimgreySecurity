import { 
  useGetDashboardStats, 
  useGetDashboardTimeline, 
  useGetRiskBreakdown 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, FileText, Video, Eye, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: timeline, isLoading: timelineLoading } = useGetDashboardTimeline();
  const { data: riskBreakdown, isLoading: riskLoading } = useGetRiskBreakdown();

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'hsl(var(--destructive))';
      case 'high': return 'hsl(var(--warning))';
      case 'medium': return 'hsl(var(--attention))';
      case 'low': return 'hsl(var(--safe))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]';
      case 'medium': return 'bg-[hsl(var(--attention))] text-[hsl(var(--attention-foreground))]';
      case 'low': return 'bg-[hsl(var(--safe))] text-[hsl(var(--safe-foreground))]';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
        <p className="text-muted-foreground">Real-time status of all monitored zones.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Videos" value={stats?.totalVideos} icon={Video} loading={statsLoading} />
        <StatCard title="Processed" value={stats?.processedVideos} icon={Activity} loading={statsLoading} />
        <StatCard title="Detections" value={stats?.totalDetections} icon={Eye} loading={statsLoading} />
        <StatCard title="Active Incidents" value={stats?.activeIncidents} icon={AlertTriangle} loading={statsLoading} />
        <StatCard 
          title="Critical Incidents" 
          value={stats?.criticalIncidents} 
          icon={ShieldAlert} 
          loading={statsLoading} 
          highlight="text-destructive"
        />
        <StatCard title="Reports Generated" value={stats?.totalReports} icon={FileText} loading={statsLoading} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Risk Breakdown Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Risk Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {riskLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : riskBreakdown && riskBreakdown.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskBreakdown} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="severity" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {riskBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No risk data available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline Feed */}
        <Card className="col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '300px' }}>
            {timelineLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : timeline && timeline.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
                {timeline.map((event) => (
                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getSeverityColor(event.severity) }}></div>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card border border-border p-4 rounded-md shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span>
                        <Badge className={getSeverityBadgeClass(event.severity)} variant="outline">{event.severity}</Badge>
                      </div>
                      <div className="text-sm font-medium mb-1">{event.eventType}</div>
                      <div className="text-xs text-muted-foreground truncate">{event.description}</div>
                      <div className="text-xs font-mono mt-2 text-primary">CAM: {event.camera}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No recent activity.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  loading,
  highlight = ""
}: { 
  title: string; 
  value?: number; 
  icon: React.ElementType; 
  loading: boolean;
  highlight?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-muted-foreground ${highlight}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className={`text-2xl font-bold ${highlight}`}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
