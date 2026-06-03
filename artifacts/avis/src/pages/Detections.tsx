import { useState, useMemo, useRef, useEffect } from "react";
import { useListDetections, useListVideos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Target, Filter, ChevronRight } from "lucide-react";

export default function Detections() {
  const [selectedVideo, setSelectedVideo] = useState<string>("all");
  const [objectTypeFilter, setObjectTypeFilter] = useState<string>("");
  
  const { data: videos } = useListVideos();
  const { data: detections, isLoading } = useListDetections({ 
    videoId: selectedVideo !== "all" ? parseInt(selectedVideo) : undefined 
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedDetection, setSelectedDetection] = useState<any>(null);

  const filteredDetections = useMemo(() => {
    if (!detections) return [];
    if (!objectTypeFilter) return detections;
    return detections.filter(d => 
      d.objectType.toLowerCase().includes(objectTypeFilter.toLowerCase())
    );
  }, [detections, objectTypeFilter]);

  // Render mock frame with bounding box when a detection is selected
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Draw dark background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Draw grid pattern for tech feel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<w; i+=40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
    }
    for(let i=0; i<h; i+=40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }

    if (selectedDetection) {
      // Draw mock frame content (a blurred shape)
      ctx.fillStyle = '#334155';
      const mockX = w/2 - 50;
      const mockY = h/2 - 100;
      const mockW = 100;
      const mockH = 200;
      ctx.fillRect(mockX, mockY, mockW, mockH);
      
      // Draw bounding box
      ctx.strokeStyle = '#3b82f6'; // primary blue
      ctx.lineWidth = 2;
      
      // Add padding to box
      const pad = 10;
      ctx.strokeRect(mockX - pad, mockY - pad, mockW + pad*2, mockH + pad*2);
      
      // Draw label
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(mockX - pad, mockY - pad - 20, mockW + pad*2, 20);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(`${selectedDetection.objectType} ${(selectedDetection.confidence * 100).toFixed(1)}%`, mockX - pad + 5, mockY - pad - 6);

      // Draw crosshairs
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.beginPath();
      ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
      ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#475569';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SELECT DETECTION TO VIEW FRAME', w/2, h/2);
    }
  }, [selectedDetection]);

  const getVideoName = (id: number) => {
    return videos?.find(v => v.id === id)?.fileName || `Video ${id}`;
  };

  const getVideoCamera = (id: number) => {
    return videos?.find(v => v.id === id)?.cameraName || `Unknown`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detections</h2>
          <p className="text-muted-foreground">Raw object detections identified by AI models.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col h-[700px]">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <CardTitle>Detection Log</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="search" 
                    placeholder="Filter object..." 
                    className="pl-8 h-9"
                    value={objectTypeFilter}
                    onChange={(e) => setObjectTypeFilter(e.target.value)}
                  />
                </div>
                <Select value={selectedVideo} onValueChange={setSelectedVideo}>
                  <SelectTrigger className="w-full sm:w-48 h-9">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All Videos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Videos</SelectItem>
                    {videos?.map(v => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.fileName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredDetections.length > 0 ? (
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
                  {filteredDetections.map((det) => (
                    <TableRow 
                      key={det.id} 
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedDetection?.id === det.id ? 'bg-primary/10' : ''}`}
                      onClick={() => setSelectedDetection(det)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          {det.objectType}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={det.confidence > 0.8 ? 'text-safe border-safe' : 'text-attention border-attention'}>
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
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
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

        <Card className="lg:col-span-1 h-[700px] flex flex-col">
          <CardHeader>
            <CardTitle>Frame Viewer</CardTitle>
            <CardDescription>Spatial context for selected detection.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-4">
            <div className="relative aspect-video bg-black rounded-md overflow-hidden border border-border">
              <canvas 
                ref={canvasRef}
                width={640}
                height={360}
                className="w-full h-full object-contain"
              />
              {selectedDetection && (
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur text-xs font-mono text-white px-2 py-1 rounded border border-white/10">
                  {selectedDetection.timestamp} | FRM: {selectedDetection.frameNumber}
                </div>
              )}
            </div>

            {selectedDetection ? (
              <div className="space-y-4 bg-muted/30 p-4 rounded-md border border-border">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Detection Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Object Type</span>
                    <span className="font-mono text-primary">{selectedDetection.objectType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Confidence</span>
                    <span className="font-mono">{(selectedDetection.confidence * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Source Camera</span>
                    <span className="font-mono">{getVideoCamera(selectedDetection.videoId)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Timestamp</span>
                    <span className="font-mono">{selectedDetection.timestamp}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-xs">Bounding Box (x,y,w,h)</span>
                    <span className="font-mono text-xs bg-background px-2 py-1 rounded block mt-1">
                      {selectedDetection.boundingBox || "[270, 80, 100, 200]"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-xs">Tracking ID</span>
                    <span className="font-mono text-xs bg-background px-2 py-1 rounded block mt-1">
                      TRK-{selectedDetection.videoId}-{selectedDetection.id.toString().padStart(4, '0')}
                    </span>
                  </div>
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
    </div>
  );
}
