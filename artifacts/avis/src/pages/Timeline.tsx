import { useListEvents, useListVideos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, Video, ShieldAlert, AlertCircle, Info, Activity } from "lucide-react";
import { format } from "date-fns";

export default function Timeline() {
  const { data: events, isLoading } = useListEvents({ limit: 100 });
  const { data: videos } = useListVideos();

  const getSeverityConfig = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': 
        return { color: 'bg-destructive text-destructive-foreground', border: 'border-destructive', icon: ShieldAlert, line: 'bg-destructive' };
      case 'high': 
        return { color: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]', border: 'border-[hsl(var(--warning))]', icon: AlertTriangle, line: 'bg-[hsl(var(--warning))]' };
      case 'medium': 
        return { color: 'bg-[hsl(var(--attention))] text-[hsl(var(--attention-foreground))]', border: 'border-[hsl(var(--attention))]', icon: AlertCircle, line: 'bg-[hsl(var(--attention))]' };
      case 'low': 
        return { color: 'bg-[hsl(var(--safe))] text-[hsl(var(--safe-foreground))]', border: 'border-[hsl(var(--safe))]', icon: Info, line: 'bg-[hsl(var(--safe))]' };
      default: 
        return { color: 'bg-muted text-muted-foreground', border: 'border-muted', icon: Activity, line: 'bg-border' };
    }
  };

  const getVideoInfo = (id: number) => {
    const v = videos?.find(v => v.id === id);
    return v ? `${v.cameraName} (${v.fileName})` : `CAM-${id}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Incident Timeline</h2>
        <p className="text-muted-foreground">Chronological record of all anomalous events.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Event Log
          </CardTitle>
          <CardDescription>Generated automatically by AVIS analysis engine.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4">
                  <div className="w-16 flex flex-col items-center">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-16 w-0.5 mt-2" />
                  </div>
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <div className="relative border-l-2 border-border ml-3 md:ml-4 space-y-8 pb-4">
              {events.map((event) => {
                const config = getSeverityConfig(event.severity);
                const Icon = config.icon;
                
                return (
                  <div key={event.id} className="relative pl-8 md:pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-background ${config.line} flex items-center justify-center shadow-sm`}>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-3">
                        <Badge className={`${config.color} font-mono uppercase tracking-wider text-[10px]`}>
                          <Icon className="w-3 h-3 mr-1" /> {event.severity}
                        </Badge>
                        <span className="text-sm font-semibold">{event.eventType}</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-2 bg-muted/30 px-2 py-1 rounded">
                        <Clock className="w-3 h-3" />
                        {format(new Date(event.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-md p-4 shadow-sm">
                      <p className="text-sm text-foreground/90 mb-3">{event.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-border/50 text-xs">
                        <div>
                          <span className="text-muted-foreground block mb-1">Source Camera</span>
                          <span className="font-mono text-primary flex items-center gap-1">
                            <Video className="w-3 h-3" /> {event.camera}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">Risk Score</span>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${config.line}`} 
                                style={{ width: `${event.riskScore}%` }}
                              />
                            </div>
                            <span className="font-mono">{event.riskScore}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">Frame</span>
                          <span className="font-mono">{event.frameNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">Video Source</span>
                          <span className="font-mono truncate block" title={getVideoInfo(event.videoId)}>
                            {getVideoInfo(event.videoId)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No incidents detected yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
