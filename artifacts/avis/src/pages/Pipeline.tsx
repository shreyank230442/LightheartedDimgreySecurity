import { useEffect, useRef, useState } from "react";
import { useListVideos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Cpu, Eye, Box, Layers, PlaySquare } from "lucide-react";

export default function Pipeline() {
  const { data: videos } = useListVideos();
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  
  const processedVideos = videos?.filter(v => v.status === 'processed') || [];

  // Canvas refs for different stages
  const canvasRefs = {
    original: useRef<HTMLCanvasElement>(null),
    noise: useRef<HTMLCanvasElement>(null),
    contrast: useRef<HTMLCanvasElement>(null),
    edge: useRef<HTMLCanvasElement>(null),
    motion: useRef<HTMLCanvasElement>(null),
    object: useRef<HTMLCanvasElement>(null),
  };

  // Animation frame reference
  const animationRef = useRef<number>();
  const frameCountRef = useRef(0);

  useEffect(() => {
    if (processedVideos.length > 0 && !selectedVideoId) {
      setSelectedVideoId(processedVideos[0].id.toString());
    }
  }, [processedVideos, selectedVideoId]);

  // Canvas drawing logic to simulate CV pipeline
  useEffect(() => {
    if (!selectedVideoId) return;

    const canvases = {
      original: canvasRefs.original.current,
      noise: canvasRefs.noise.current,
      contrast: canvasRefs.contrast.current,
      edge: canvasRefs.edge.current,
      motion: canvasRefs.motion.current,
      object: canvasRefs.object.current,
    };

    const ctxs = {
      original: canvases.original?.getContext('2d'),
      noise: canvases.noise?.getContext('2d'),
      contrast: canvases.contrast?.getContext('2d'),
      edge: canvases.edge?.getContext('2d'),
      motion: canvases.motion?.getContext('2d'),
      object: canvases.object?.getContext('2d'),
    };

    // Ensure all canvases are ready
    if (!Object.values(ctxs).every(Boolean)) return;

    // Simulation entities (people walking)
    const entities = Array.from({ length: 3 }).map((_, i) => ({
      x: 50 + (i * 100),
      y: 150 + (Math.random() * 50),
      vx: (Math.random() * 2) + 0.5,
      vy: (Math.random() * 0.5) - 0.25,
      size: 40 + (Math.random() * 20),
      id: `ID-${1000 + i}`
    }));

    const renderFrame = () => {
      frameCountRef.current++;
      const time = frameCountRef.current * 0.05;

      Object.entries(canvases).forEach(([key, canvas]) => {
        if (!canvas) return;
        const ctx = ctxs[key as keyof typeof ctxs];
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        // Base scene rendering
        ctx.fillStyle = '#1e293b'; // Background slate
        ctx.fillRect(0, 0, w, h);

        // Draw "scene" (a simple room/street perspective)
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.7);
        ctx.lineTo(w, h * 0.7); // Horizon
        ctx.moveTo(w * 0.3, h * 0.7);
        ctx.lineTo(w * 0.1, h); // Road line 1
        ctx.moveTo(w * 0.7, h * 0.7);
        ctx.lineTo(w * 0.9, h); // Road line 2
        ctx.stroke();

        // Update entities
        entities.forEach(ent => {
          ent.x += ent.vx;
          ent.y += ent.vy;
          
          // Bounce off walls
          if (ent.x > w + 50) ent.x = -50;
          if (ent.y > h || ent.y < h * 0.5) ent.vy *= -1;
        });

        // Stage-specific rendering
        if (key === 'original') {
          // Draw plain entities
          entities.forEach(ent => {
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(ent.x - ent.size/4, ent.y - ent.size, ent.size/2, ent.size); // Body
            ctx.beginPath();
            ctx.arc(ent.x, ent.y - ent.size - 10, ent.size/3, 0, Math.PI * 2); // Head
            ctx.fill();
          });
          
          // Add fake camera overlay
          ctx.fillStyle = '#fff';
          ctx.font = '10px monospace';
          ctx.fillText(`CAM-01 ${new Date().toISOString().split('T')[1].slice(0,8)} REC`, 10, 20);
        }
        else if (key === 'noise') {
          // Gaussian blur simulation
          ctx.globalAlpha = 0.5;
          entities.forEach(ent => {
            ctx.fillStyle = '#64748b';
            // Draw multiple offset layers to simulate blur
            for(let i=0; i<3; i++) {
              const offsetX = (Math.random() - 0.5) * 10;
              const offsetY = (Math.random() - 0.5) * 10;
              ctx.fillRect(ent.x - ent.size/4 + offsetX, ent.y - ent.size + offsetY, ent.size/2, ent.size);
              ctx.beginPath();
              ctx.arc(ent.x + offsetX, ent.y - ent.size - 10 + offsetY, ent.size/3, 0, Math.PI * 2);
              ctx.fill();
            }
          });
          ctx.globalAlpha = 1.0;
        }
        else if (key === 'contrast') {
          // High contrast black & white
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
          entities.forEach(ent => {
            ctx.fillStyle = '#fff';
            ctx.fillRect(ent.x - ent.size/4, ent.y - ent.size, ent.size/2, ent.size);
            ctx.beginPath();
            ctx.arc(ent.x, ent.y - ent.size - 10, ent.size/3, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        else if (key === 'edge') {
          // Canny Edge detection simulation (black bg, green/white edges)
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
          
          // Draw scene edges
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h * 0.7); ctx.lineTo(w, h * 0.7);
          ctx.moveTo(w * 0.3, h * 0.7); ctx.lineTo(w * 0.1, h);
          ctx.moveTo(w * 0.7, h * 0.7); ctx.lineTo(w * 0.9, h);
          ctx.stroke();

          // Entity edges
          ctx.strokeStyle = '#22c55e'; // Green edges for active objects
          ctx.lineWidth = 2;
          entities.forEach(ent => {
            ctx.strokeRect(ent.x - ent.size/4, ent.y - ent.size, ent.size/2, ent.size);
            ctx.beginPath();
            ctx.arc(ent.x, ent.y - ent.size - 10, ent.size/3, 0, Math.PI * 2);
            ctx.stroke();
          });
        }
        else if (key === 'motion') {
          // Background subtraction / Optical Flow simulation
          ctx.fillStyle = '#020617'; // Deep dark bg
          ctx.fillRect(0, 0, w, h);
          
          entities.forEach(ent => {
            // Draw motion vectors (red/blue based on direction)
            ctx.strokeStyle = ent.vx > 0 ? '#3b82f6' : '#ef4444';
            ctx.lineWidth = 2;
            
            // Motion blobs
            ctx.fillStyle = `${ent.vx > 0 ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`;
            ctx.fillRect(ent.x - ent.size/2, ent.y - ent.size - 20, ent.size, ent.size + 30);
            
            // Vector arrows
            ctx.beginPath();
            ctx.moveTo(ent.x, ent.y - ent.size/2);
            ctx.lineTo(ent.x + (ent.vx * 15), ent.y - ent.size/2);
            ctx.stroke();
          });
        }
        else if (key === 'object') {
          // Final YOLO / Tracking output
          // Draw base scene first (darkened)
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, w, h);
          
          // Draw faint entities
          entities.forEach(ent => {
            ctx.fillStyle = '#475569';
            ctx.fillRect(ent.x - ent.size/4, ent.y - ent.size, ent.size/2, ent.size);
            ctx.beginPath();
            ctx.arc(ent.x, ent.y - ent.size - 10, ent.size/3, 0, Math.PI * 2);
            ctx.fill();
          });

          // Draw Bounding Boxes and Tracking info
          entities.forEach((ent, i) => {
            const conf = (0.85 + (Math.sin(time + i) * 0.1)).toFixed(2);
            const boxColor = '#3b82f6'; // Blue for person
            
            const bx = ent.x - ent.size/1.5;
            const by = ent.y - ent.size * 1.5;
            const bw = ent.size * 1.3;
            const bh = ent.size * 1.8;

            // Bounding box
            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, bw, bh);

            // Label background
            ctx.fillStyle = boxColor;
            ctx.fillRect(bx, by - 16, bw, 16);

            // Label text
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.fillText(`person ${conf}`, bx + 2, by - 4);
            
            // Tracking dot & ID
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(ent.x, ent.y, 3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.fillText(ent.id, ent.x + 5, ent.y);
          });
        }
      });

      animationRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [selectedVideoId]);

  const PipelineStage = ({ id, title, icon: Icon, description }: { id: keyof typeof canvasRefs, title: string, icon: React.ElementType, description: string }) => (
    <Card className="overflow-hidden border-border bg-card shadow-sm group hover:border-primary/50 transition-colors">
      <div className="bg-muted/30 px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 font-mono">STG-{Object.keys(canvasRefs).indexOf(id) + 1}</Badge>
      </div>
      <div className="relative aspect-video bg-black p-1">
        <canvas 
          ref={canvasRefs[id]} 
          width={400} 
          height={225} 
          className="w-full h-full object-contain rounded-sm"
        />
        {/* Scanning line effect */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/30 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-[scan_3s_linear_infinite]" />
      </div>
      <div className="p-3 bg-muted/10">
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Processing Pipeline</h2>
          <p className="text-muted-foreground">Real-time computer vision algorithm visualization.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
            <SelectTrigger className="w-[280px]">
              <PlaySquare className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select processed video" />
            </SelectTrigger>
            <SelectContent>
              {processedVideos.map(v => (
                <SelectItem key={v.id} value={v.id.toString()}>{v.fileName} ({v.cameraName})</SelectItem>
              ))}
              {processedVideos.length === 0 && (
                <SelectItem value="none" disabled>No processed videos available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <PipelineStage 
          id="original" 
          title="1. Source Frame" 
          icon={Activity} 
          description="Raw RGB frame extraction from video stream." 
        />
        <PipelineStage 
          id="noise" 
          title="2. Noise Reduction" 
          icon={Layers} 
          description="Gaussian blur applied to reduce high-frequency noise." 
        />
        <PipelineStage 
          id="contrast" 
          title="3. Grayscale / Contrast" 
          icon={Eye} 
          description="Luminance extraction and histogram equalization." 
        />
        <PipelineStage 
          id="edge" 
          title="4. Edge Detection" 
          icon={Cpu} 
          description="Canny algorithm identifying structural boundaries." 
        />
        <PipelineStage 
          id="motion" 
          title="5. Optical Flow" 
          icon={Activity} 
          description="Background subtraction isolating moving pixels." 
        />
        <PipelineStage 
          id="object" 
          title="6. Object Detection & Tracking" 
          icon={Box} 
          description="CNN inference bounding boxes + DeepSORT tracking." 
        />
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
