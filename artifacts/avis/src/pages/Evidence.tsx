import { useEffect, useRef, useState } from "react";
import { useListEvents } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Maximize2, Camera, Clock, Target } from "lucide-react";
import { format } from "date-fns";

export default function Evidence() {
  const { data: events, isLoading } = useListEvents({ limit: 20 });
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // We use events that have actual physical meaning for evidence frames
  const evidenceEvents = events?.filter(e => 
    e.eventType.toLowerCase().includes('person') || 
    e.eventType.toLowerCase().includes('object') ||
    e.eventType.toLowerCase().includes('bag') ||
    e.eventType.toLowerCase().includes('intrusion') ||
    e.eventType.toLowerCase().includes('loitering')
  ) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Evidence Gallery</h2>
        <p className="text-muted-foreground">Captured frames from high-risk incidents for reporting and export.</p>
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
          {evidenceEvents.map((event) => (
            <EvidenceCard 
              key={event.id} 
              event={event} 
              onExpand={() => setSelectedEvent(event)} 
            />
          ))}
        </div>
      ) : (
        <div className="h-[400px] flex flex-col items-center justify-center border border-dashed rounded-lg text-muted-foreground">
          <Camera className="w-12 h-12 mb-4 opacity-20" />
          <p>No evidence frames available.</p>
          <p className="text-sm">Processed video events will appear here.</p>
        </div>
      )}

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-4xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Evidence Frame: EV-{selectedEvent?.id.toString().padStart(6, '0')}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-md overflow-hidden border border-border">
                <EvidenceCanvas event={selectedEvent} width={800} height={450} expanded={true} />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-md border border-border text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Camera Source</span>
                  <span className="font-mono">{selectedEvent.camera}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Timestamp</span>
                  <span className="font-mono">{format(new Date(selectedEvent.timestamp), 'yyyy-MM-dd HH:mm:ss')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Event Type</span>
                  <span className="font-mono">{selectedEvent.eventType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Risk Score</span>
                  <Badge variant="outline" className={selectedEvent.riskScore > 80 ? 'border-destructive text-destructive' : 'border-warning text-warning'}>
                    {selectedEvent.riskScore}/100
                  </Badge>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
                <Button className="gap-2">
                  <Download className="w-4 h-4" /> Download SECURE_EXPORT
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EvidenceCard({ event, onExpand }: { event: any, onExpand: () => void }) {
  const getSeverityBorder = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'border-t-4 border-t-destructive';
      case 'high': return 'border-t-4 border-t-[hsl(var(--warning))]';
      default: return 'border-t-4 border-t-[hsl(var(--attention))]';
    }
  };

  return (
    <Card className={`overflow-hidden flex flex-col group ${getSeverityBorder(event.severity)}`}>
      <div className="relative aspect-video bg-black overflow-hidden border-b border-border">
        <EvidenceCanvas event={event} width={400} height={225} />
        
        {/* Overlay controls */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]">
          <Button size="icon" variant="secondary" onClick={onExpand} className="rounded-full">
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="primary" className="rounded-full">
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {/* Permanent badges overlay */}
        <div className="absolute top-2 left-2 flex gap-2">
          <Badge className="bg-black/70 backdrop-blur text-white border-none font-mono text-[10px]">
            {event.camera}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4 flex-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-sm line-clamp-1" title={event.eventType}>{event.eventType}</h3>
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            RS:{event.riskScore}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 text-xs text-muted-foreground font-mono flex items-center gap-2">
        <Clock className="w-3 h-3" />
        {format(new Date(event.timestamp), 'HH:mm:ss')}
      </CardFooter>
    </Card>
  );
}

function EvidenceCanvas({ event, width, height, expanded = false }: { event: any, width: number, height: number, expanded?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background (simulated CCTV frame)
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.fillRect(0, 0, width, height);
    
    // Draw some noise/texture to make it look like a frame
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let i = 0; i < 1000; i++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

    // Determine what to draw based on event type
    const isPerson = event.eventType.toLowerCase().includes('person') || event.eventType.toLowerCase().includes('loitering');
    const isBag = event.eventType.toLowerCase().includes('bag');
    
    // Randomize position based on event ID for consistency
    const seed = event.id * 123.456;
    const rand = () => {
      let t = seed + 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    const cx = (width * 0.3) + (rand() * width * 0.4);
    let cy = (height * 0.4) + (rand() * height * 0.4);

    // Draw simulated object
    ctx.fillStyle = '#334155'; // shape color
    
    let boxColor = '#3b82f6'; // blue default
    if (event.severity === 'critical') boxColor = '#ef4444'; // red
    else if (event.severity === 'high') boxColor = '#f97316'; // orange

    let bw = 0, bh = 0;

    if (isBag) {
      bw = width * 0.15;
      bh = height * 0.2;
      // Draw bag shape
      ctx.fillRect(cx - bw/2, cy - bh/2, bw, bh);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - bw/4, cy - bh/2 - 10, bw/2, 15); // Handle
    } else {
      // Person shape
      bw = width * 0.12;
      bh = height * 0.4;
      ctx.fillRect(cx - bw/2, cy - bh/2, bw, bh); // Body
      ctx.beginPath();
      ctx.arc(cx, cy - bh/2 - 20, bw/2.5, 0, Math.PI * 2); // Head
      ctx.fill();
      bh += 30; // Adjust box height to include head
      cy -= 15;
    }

    // Draw bounding box
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = expanded ? 3 : 2;
    ctx.strokeRect(cx - bw/2 - 10, cy - bh/2 - 10, bw + 20, bh + 20);

    // Draw crosshairs at corners
    const pad = 10;
    const len = 15;
    ctx.beginPath();
    // Top left
    ctx.moveTo(cx - bw/2 - pad, cy - bh/2 - pad + len);
    ctx.lineTo(cx - bw/2 - pad, cy - bh/2 - pad);
    ctx.lineTo(cx - bw/2 - pad + len, cy - bh/2 - pad);
    // Top right
    ctx.moveTo(cx + bw/2 + pad - len, cy - bh/2 - pad);
    ctx.lineTo(cx + bw/2 + pad, cy - bh/2 - pad);
    ctx.lineTo(cx + bw/2 + pad, cy - bh/2 - pad + len);
    // Bottom left
    ctx.moveTo(cx - bw/2 - pad, cy + bh/2 + pad - len);
    ctx.lineTo(cx - bw/2 - pad, cy + bh/2 + pad);
    ctx.lineTo(cx - bw/2 - pad + len, cy + bh/2 + pad);
    // Bottom right
    ctx.moveTo(cx + bw/2 + pad - len, cy + bh/2 + pad);
    ctx.lineTo(cx + bw/2 + pad, cy + bh/2 + pad);
    ctx.lineTo(cx + bw/2 + pad, cy + bh/2 + pad - len);
    ctx.stroke();

    // Draw Label
    ctx.fillStyle = boxColor;
    const labelH = expanded ? 24 : 16;
    ctx.fillRect(cx - bw/2 - 10, cy - bh/2 - 10 - labelH, bw + 20, labelH);
    
    ctx.fillStyle = '#fff';
    ctx.font = `${expanded ? '14px' : '10px'} monospace`;
    ctx.fillText(`${isBag ? 'object' : 'person'} ${(event.riskScore/100).toFixed(2)}`, cx - bw/2 - 5, cy - bh/2 - 10 - (labelH/4));

    // Data overlay (timecode etc) if expanded
    if (expanded) {
      ctx.fillStyle = '#22c55e'; // Green terminal text
      ctx.font = '12px monospace';
      ctx.fillText(`REC ${event.camera}`, 20, 30);
      ctx.fillText(`FRM: ${event.frameNumber || 1024}`, 20, 50);
      
      // Draw grid lines
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.1)';
      ctx.beginPath();
      ctx.moveTo(width/2, 0); ctx.lineTo(width/2, height);
      ctx.moveTo(0, height/2); ctx.lineTo(width, height/2);
      ctx.stroke();
    }

  }, [event, width, height, expanded]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="w-full h-full object-cover"
    />
  );
}
