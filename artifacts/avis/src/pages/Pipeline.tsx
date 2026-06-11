import { useState, useEffect } from "react";
import { useListVideos } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Cpu, Eye, Box, Layers, PlaySquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const STAGES = [
  { id: "original",  title: "1. Source Frame",              icon: Activity, description: "Raw RGB frame extracted from video stream by OpenCV VideoCapture." },
  { id: "blur",      title: "2. Noise Reduction",           icon: Layers,   description: "Gaussian blur kernel applied to suppress high-frequency noise and sensor artefacts." },
  { id: "contrast",  title: "3. Contrast Enhancement",      icon: Eye,      description: "Grayscale conversion followed by CLAHE (Contrast Limited Adaptive Histogram Equalization)." },
  { id: "edges",     title: "4. Edge Detection",            icon: Cpu,      description: "Canny algorithm identifying structural boundaries (thresholds 50–150)." },
  { id: "motion",    title: "5. Background Subtraction",    icon: Activity, description: "Frame-difference background subtraction isolating moving foreground pixels." },
  { id: "detection", title: "6. YOLOv8 Object Detection",   icon: Box,      description: "YOLOv8n CNN inference with bounding boxes, class labels, and confidence scores." },
] as const;

type Stage = typeof STAGES[number]["id"];

function PipelineImage({ videoId, stage, refreshKey }: { videoId: string; stage: Stage; refreshKey: number }) {
  const src = `/api/pipeline/frames/${videoId}/${stage}?v=${refreshKey}`;
  return (
    <img
      src={src}
      alt={stage}
      className="w-full h-full object-contain rounded-sm"
      style={{ minHeight: 180 }}
    />
  );
}

export default function Pipeline() {
  const { data: videos } = useListVideos();
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const processedVideos = videos?.filter(v => v.status === "processed") || [];

  useEffect(() => {
    if (processedVideos.length > 0 && !selectedVideoId) {
      setSelectedVideoId(processedVideos[0].id.toString());
    }
  }, [processedVideos.length]);

  const selectedVideo = processedVideos.find(v => v.id.toString() === selectedVideoId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Processing Pipeline</h2>
          <p className="text-muted-foreground">Real OpenCV computer vision algorithm output — actual processed frames.</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
            <SelectTrigger className="w-[300px]">
              <PlaySquare className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select processed video" />
            </SelectTrigger>
            <SelectContent>
              {processedVideos.map(v => (
                <SelectItem key={v.id} value={v.id.toString()}>
                  {v.fileName} — {v.cameraName}
                </SelectItem>
              ))}
              {processedVideos.length === 0 && (
                <SelectItem value="none" disabled>No processed videos yet</SelectItem>
              )}
            </SelectContent>
          </Select>
          {selectedVideoId && (
            <Button variant="outline" size="icon" title="Refresh images" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {selectedVideo && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
          <span className="font-mono text-primary">{selectedVideo.cameraName}</span>
          <span>·</span>
          <span>{selectedVideo.fileName}</span>
          {selectedVideo.frameCount && <><span>·</span><span>{selectedVideo.frameCount.toLocaleString()} frames</span></>}
          {selectedVideo.durationSeconds && <><span>·</span><span>{selectedVideo.durationSeconds}s</span></>}
        </div>
      )}

      {!selectedVideoId ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed rounded-lg">
          <PlaySquare className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">No video selected</p>
          <p className="text-sm mt-1">Upload and process a video to see the real CV pipeline output.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {STAGES.map((stage, i) => (
            <Card key={stage.id} className="overflow-hidden border-border bg-card shadow-sm hover:border-primary/50 transition-colors">
              <div className="bg-muted/30 px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <stage.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{stage.title}</span>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 font-mono">STG-{i + 1}</Badge>
              </div>
              <div className="relative aspect-video bg-black overflow-hidden">
                <PipelineImage
                  videoId={selectedVideoId}
                  stage={stage.id}
                  refreshKey={refreshKey}
                />
                <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/20 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-[scan_4s_linear_infinite]" />
              </div>
              <div className="p-3 bg-muted/10">
                <p className="text-xs text-muted-foreground">{stage.description}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <style>{`
        @keyframes scan {
          0%   { top: 0%;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
