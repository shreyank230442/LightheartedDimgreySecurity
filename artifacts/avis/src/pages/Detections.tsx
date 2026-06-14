import { useState, useMemo } from "react";
import { useListDetections, useListEvents, useListVideos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Target, Filter, ChevronRight, AlertTriangle, ShieldAlert, AlertCircle, Info, Activity } from "lucide-react";
import { format } from "date-fns";

const INCIDENT_LABELS: Record<string, { label: string; color: string }> = {
  fire:                { label: "Fire",              color: "text-orange-400 border-orange-400" },
  explosion:           { label: "Explosion",         color: "text-red-500 border-red-500" },
  violence:            { label: "Violence",          color: "text-red-400 border-red-400" },
  fight:               { label: "Fight",             color: "text-red-400 border-red-400" },
  fall:                { label: "Fall",              color: "text-yellow-400 border-yellow-400" },
  accident:            { label: "Accident",          color: "text-orange-500 border-orange-500" },
  intrusion:           { label: "Intrusion",         color: "text-purple-400 border-purple-400" },
  loitering:           { label: "Loitering",         color: "text-yellow-300 border-yellow-300" },
  running:             { label: "Running",           color: "text-blue-400 border-blue-400" },
  crowd_formation:     { label: "Crowd Formation",   color: "text-orange-300 border-orange-300" },
  suspicious_movement: { label: "Suspicious",        color: "text-amber-400 border-amber-400" },
  abandoned_object:    { label: "Abandoned Object",  color: "text-red-300 border-red-300" },
};

function severityIcon(s: string) {
  switch (s?.toLowerCase()) {
    case "critical": return <ShieldAlert className="w-4 h-4 text-destructive" />;
    case "high":     return <AlertTriangle className="w-4 h-4 text-warning" />;
    case "medium":   return <AlertCircle className="w-4 h-4 text-attention" />;
    default:         return <Info className="w-4 h-4 text-safe" />;
  }
}

function severityBadge(s: string) {
  const cls = s?.toLowerCase() === "critical" ? "bg-destructive/20 text-destructive border-destructive"
            : s?.toLowerCase() === "high"     ? "bg-warning/20 text-warning border-warning"
            : s?.toLowerCase() === "medium"   ? "bg-attention/20 text-attention border-attention"
            :                                   "bg-safe/20 text-safe border-safe";
  return <Badge variant="outline" className={`text-[10px] uppercase ${cls}`}>{s}</Badge>;
}

// ── Objects tab ──────────────────────────────────────────────────────────────
function ObjectsTab() {
  const [selectedVideo, setSelectedVideo]         = useState("all");
  const [objectTypeFilter, setObjectTypeFilter]   = useState("");
  const [selectedDetection, setSelectedDetection] = useState<any>(null);

  const { data: videos }                  = useListVideos();
  const { data: detections, isLoading }   = useListDetections({
    videoId: selectedVideo !== "all" ? parseInt(selectedVideo) : undefined,
  });

  const filtered = useMemo(() => {
    if (!detections) return [];
    if (!objectTypeFilter) return detections;
    return detections.filter(d => d.objectType.toLowerCase().includes(objectTypeFilter.toLowerCase()));
  }, [detections, objectTypeFilter]);

  const getVideoName   = (id: number) => videos?.find(v => v.id === id)?.fileName   || `Video ${id}`;
  const getVideoCamera = (id: number) => videos?.find(v => v.id === id)?.cameraName || "Unknown";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 flex flex-col h-[660px]">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>Object Detection Log</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Filter type…" className="pl-8 h-9"
                  value={objectTypeFilter} onChange={e => setObjectTypeFilter(e.target.value)} />
              </div>
              <Select value={selectedVideo} onValueChange={setSelectedVideo}>
                <SelectTrigger className="w-full sm:w-48 h-9">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Videos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Videos</SelectItem>
                  {videos?.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.fileName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 border-b shadow-sm">
                <TableRow>
                  <TableHead>Object Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Frame / Time</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(det => (
                  <TableRow key={det.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedDetection?.id === det.id ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedDetection(det)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" />{det.objectType}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={det.confidence > 0.8 ? "text-safe border-safe" : "text-attention border-attention"}>
                        {(det.confidence * 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">F:{det.frameNumber}</div>
                      <div className="text-xs text-muted-foreground font-mono">{det.timestamp}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm max-w-[150px] truncate">{getVideoName(det.videoId)}</div>
                      <div className="text-xs text-muted-foreground">{getVideoCamera(det.videoId)}</div>
                    </TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Target className="w-10 h-10 mb-2 opacity-20" />
              <p>No detections found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1 h-[660px] flex flex-col">
        <CardHeader>
          <CardTitle>Detection Details</CardTitle>
          <CardDescription>Click a row to inspect.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-4">
          {selectedDetection ? (
            <div className="space-y-4 bg-muted/30 p-4 rounded-md border border-border">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Raw Detection</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground block text-xs">Object Type</span>
                  <span className="font-mono text-primary">{selectedDetection.objectType}</span></div>
                <div><span className="text-muted-foreground block text-xs">Confidence</span>
                  <span className="font-mono">{(selectedDetection.confidence * 100).toFixed(2)}%</span></div>
                <div><span className="text-muted-foreground block text-xs">Camera</span>
                  <span className="font-mono">{getVideoCamera(selectedDetection.videoId)}</span></div>
                <div><span className="text-muted-foreground block text-xs">Timestamp</span>
                  <span className="font-mono">{selectedDetection.timestamp}</span></div>
                <div><span className="text-muted-foreground block text-xs">Frame</span>
                  <span className="font-mono">#{selectedDetection.frameNumber}</span></div>
                <div><span className="text-muted-foreground block text-xs">Tracking ID</span>
                  <span className="font-mono text-xs">TRK-{selectedDetection.videoId}-{selectedDetection.id.toString().padStart(4,"0")}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground block text-xs">Bounding Box</span>
                  <span className="font-mono text-xs bg-background px-2 py-1 rounded block mt-1 break-all">
                    {selectedDetection.boundingBox || "N/A"}
                  </span></div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed rounded-md border-border bg-muted/10 text-muted-foreground text-sm">
              Select a detection to view details
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Incidents tab ────────────────────────────────────────────────────────────
function IncidentsTab() {
  const [selectedVideo,    setSelectedVideo]    = useState("all");
  const [selectedIncident, setSelectedIncident] = useState<any>(null);

  const { data: videos }               = useListVideos();
  const { data: events, isLoading }    = useListEvents({
    videoId: selectedVideo !== "all" ? parseInt(selectedVideo) : undefined,
    limit: 200,
  });

  const getVideoName   = (id: number) => videos?.find(v => v.id === id)?.fileName   || `Video ${id}`;
  const getVideoCamera = (id: number) => videos?.find(v => v.id === id)?.cameraName || "Unknown";
  const incidentLabel  = (t: string) => INCIDENT_LABELS[t]?.label || t.replace(/_/g, " ");
  const incidentColor  = (t: string) => INCIDENT_LABELS[t]?.color || "text-muted-foreground border-muted-foreground";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 flex flex-col h-[660px]">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>Incident Log</CardTitle>
            <Select value={selectedVideo} onValueChange={setSelectedVideo}>
              <SelectTrigger className="w-full sm:w-48 h-9">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Videos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Videos</SelectItem>
                {videos?.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.fileName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : events && events.length > 0 ? (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 border-b shadow-sm">
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead>Incident Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="hidden md:table-cell">Camera / Time</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(ev => (
                  <TableRow key={ev.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedIncident?.id === ev.id ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedIncident(ev)}>
                    <TableCell>{severityIcon(ev.severity ?? "")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${incidentColor(ev.eventType ?? "")}`}>
                        {incidentLabel(ev.eventType ?? "")}
                      </Badge>
                    </TableCell>
                    <TableCell>{severityBadge(ev.severity ?? "low")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${ev.riskScore ?? 0}%` }} />
                        </div>
                        <span className="text-xs font-mono">{ev.riskScore}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">{getVideoCamera(ev.videoId ?? 0)}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {ev.timestamp ? format(new Date(ev.timestamp), "HH:mm:ss") : "—"}
                        {ev.frameNumber ? ` · F:${ev.frameNumber}` : ""}
                      </div>
                    </TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mb-2 opacity-20" />
              <p>No incidents detected yet.</p>
              <p className="text-xs mt-1">Upload and process a video to populate this log.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident details panel */}
      <Card className="lg:col-span-1 h-[660px] flex flex-col">
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
          <CardDescription>Click an incident to investigate.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-4 overflow-auto">
          {selectedIncident ? (
            <>
              <div className="flex items-center gap-2">
                {severityIcon(selectedIncident.severity ?? "")}
                <Badge variant="outline" className={`text-sm ${incidentColor(selectedIncident.eventType ?? "")}`}>
                  {incidentLabel(selectedIncident.eventType ?? "")}
                </Badge>
                {severityBadge(selectedIncident.severity ?? "low")}
              </div>

              <div className="space-y-3 bg-muted/30 p-4 rounded-md border border-border text-sm">
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-xs mb-1">Scene Description</span>
                  <p className="text-sm leading-relaxed">{selectedIncident.description}</p>
                </div>
                <hr className="border-border" />
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground block text-xs">Risk Score</span>
                    <span className="font-mono text-primary text-lg">{selectedIncident.riskScore}</span></div>
                  <div><span className="text-muted-foreground block text-xs">Frame #</span>
                    <span className="font-mono">{selectedIncident.frameNumber ?? "—"}</span></div>
                  <div><span className="text-muted-foreground block text-xs">Camera</span>
                    <span className="font-mono text-xs">{selectedIncident.camera || getVideoCamera(selectedIncident.videoId ?? 0)}</span></div>
                  <div><span className="text-muted-foreground block text-xs">Timestamp</span>
                    <span className="font-mono text-xs">
                      {selectedIncident.timestamp ? format(new Date(selectedIncident.timestamp), "HH:mm:ss") : "—"}
                    </span></div>
                  <div><span className="text-muted-foreground block text-xs">Source Video</span>
                    <span className="font-mono text-xs truncate block">{getVideoName(selectedIncident.videoId ?? 0)}</span></div>
                  <div><span className="text-muted-foreground block text-xs">Incident ID</span>
                    <span className="font-mono text-xs">EV-{selectedIncident.id?.toString().padStart(6,"0")}</span></div>
                </div>
                {selectedIncident.metadata && (() => {
                  try {
                    const m = JSON.parse(selectedIncident.metadata);
                    return (
                      <div><span className="text-muted-foreground block text-xs mb-1">Detector Metadata</span>
                        <pre className="text-xs bg-background p-2 rounded border border-border overflow-auto max-h-24">
                          {JSON.stringify(m, null, 2)}
                        </pre>
                      </div>
                    );
                  } catch { return null; }
                })()}
              </div>

              {/* Evidence frame */}
              <div>
                <span className="text-muted-foreground block text-xs mb-2">Evidence Frame</span>
                <img
                  src={`/api/evidence/${selectedIncident.id}`}
                  alt="Evidence"
                  className="w-full rounded-md border border-border object-contain bg-black"
                  style={{ maxHeight: 200 }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed rounded-md border-border bg-muted/10 text-muted-foreground text-sm">
              Select an incident to investigate
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page root ────────────────────────────────────────────────────────────────
export default function Detections() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Detections</h2>
        <p className="text-muted-foreground">AI-identified objects and incident classifications from processed video.</p>
      </div>

      <Tabs defaultValue="incidents">
        <TabsList className="mb-4">
          <TabsTrigger value="incidents" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Incidents
          </TabsTrigger>
          <TabsTrigger value="objects" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Objects
          </TabsTrigger>
        </TabsList>
        <TabsContent value="incidents"><IncidentsTab /></TabsContent>
        <TabsContent value="objects"><ObjectsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
