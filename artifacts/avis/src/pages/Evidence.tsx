import { useState } from "react";
import { useListEvents } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Maximize2, Camera, Clock, Target } from "lucide-react";
import { format } from "date-fns";

export default function Evidence() {
  const { data: events, isLoading } = useListEvents({ limit: 50 });
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const evidenceEvents = events ?? [];

  const getSeverityBorder = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical": return "border-t-4 border-t-destructive";
      case "high": return "border-t-4 border-t-[hsl(var(--warning))]";
      default: return "border-t-4 border-t-[hsl(var(--attention))]";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical": return <Badge className="bg-destructive/20 text-destructive border-destructive/50">{severity.toUpperCase()}</Badge>;
      case "high": return <Badge className="bg-warning/20 text-warning border-warning/50">{severity.toUpperCase()}</Badge>;
      case "medium": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">{severity.toUpperCase()}</Badge>;
      default: return <Badge variant="outline">{severity?.toUpperCase() ?? "LOW"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Evidence Gallery</h2>
        <p className="text-muted-foreground">Real annotated frames captured during CV incident detection.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full rounded-none" />
              <CardContent className="p-4"><Skeleton className="h-4 w-2/3 mb-2" /><Skeleton className="h-4 w-1/2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : evidenceEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {evidenceEvents.map(event => (
            <Card key={event.id} className={`overflow-hidden flex flex-col group ${getSeverityBorder(event.severity)}`}>
              <div className="relative aspect-video bg-black overflow-hidden border-b border-border">
                <img
                  src={`/api/evidence/${event.id}`}
                  alt={`Evidence for ${event.eventType}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]">
                  <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setSelectedEvent(event)}>
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="secondary" className="rounded-full" asChild>
                    <a href={`/api/evidence/${event.id}`} download={`evidence-${event.id}.jpg`}>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
                <div className="absolute top-2 left-2 flex gap-2">
                  <Badge className="bg-black/70 backdrop-blur text-white border-none font-mono text-[10px]">
                    {event.camera}
                  </Badge>
                </div>
                <div className="absolute top-2 right-2">
                  {getSeverityBadge(event.severity)}
                </div>
              </div>

              <CardContent className="p-4 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-sm line-clamp-1 capitalize">{event.eventType.replace(/_/g, " ")}</h3>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    RS:{event.riskScore}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
              </CardContent>

              <CardFooter className="p-4 pt-0 text-xs text-muted-foreground font-mono flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {format(new Date(event.timestamp), "HH:mm:ss")}
                <span className="ml-auto text-[10px]">EV-{event.id.toString().padStart(6, "0")}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="h-[400px] flex flex-col items-center justify-center border border-dashed rounded-lg text-muted-foreground">
          <Camera className="w-12 h-12 mb-4 opacity-20" />
          <p>No evidence frames available.</p>
          <p className="text-sm">Upload and process a video to capture real incident evidence.</p>
        </div>
      )}

      <Dialog open={!!selectedEvent} onOpenChange={open => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-4xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Evidence Frame: EV-{selectedEvent?.id.toString().padStart(6, "0")}
            </DialogTitle>
            <DialogDescription>{selectedEvent?.description}</DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-md overflow-hidden border border-border">
                <img
                  src={`/api/evidence/${selectedEvent.id}`}
                  alt="Evidence frame"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-md border border-border text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Camera Source</span>
                  <span className="font-mono">{selectedEvent.camera}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Timestamp</span>
                  <span className="font-mono">{format(new Date(selectedEvent.timestamp), "yyyy-MM-dd HH:mm:ss")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Event Type</span>
                  <span className="font-mono capitalize">{selectedEvent.eventType.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Risk Score</span>
                  <Badge variant="outline" className={selectedEvent.riskScore > 80 ? "border-destructive text-destructive" : "border-warning text-warning"}>
                    {selectedEvent.riskScore}/100
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
                <Button asChild className="gap-2">
                  <a href={`/api/evidence/${selectedEvent.id}`} download={`evidence-${selectedEvent.id}.jpg`}>
                    <Download className="w-4 h-4" /> Download JPEG
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
