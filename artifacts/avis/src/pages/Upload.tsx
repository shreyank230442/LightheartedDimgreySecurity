import { useState, useRef } from "react";
import { useListVideos, useUploadVideo, useProcessVideo, useDeleteVideo, getListVideosQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload as UploadIcon, Video, X, CheckCircle, Clock, AlertTriangle, FileVideo, Cpu, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Upload() {
  const { data: videos, isLoading } = useListVideos();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const uploadVideoMutation = useUploadVideo();
  const processVideoMutation = useProcessVideo();
  const deleteVideoMutation = useDeleteVideo();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cameraName, setCameraName] = useState("CAM-01-MAIN");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const validTypes = ['video/mp4', 'video/avi', 'video/quicktime'];
    if (validTypes.includes(file.type) || file.name.match(/\.(mp4|avi|mov)$/i)) {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an MP4, AVI, or MOV file.",
        variant: "destructive"
      });
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    uploadVideoMutation.mutate(
      { data: { fileName: selectedFile.name, cameraName, durationSeconds: Math.floor(Math.random() * 300) + 30 } },
      {
        onSuccess: () => {
          toast({
            title: "Upload complete",
            description: `${selectedFile.name} has been uploaded to the staging area.`,
          });
          setSelectedFile(null);
          queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        },
        onError: () => {
          toast({
            title: "Upload failed",
            description: "An error occurred while uploading the file.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleProcess = (id: number) => {
    processVideoMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: "Processing initiated",
            description: "Video has been added to the analysis queue.",
          });
          queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteVideoMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: "Video deleted",
            description: "The video has been removed from the system.",
          });
          queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        }
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed':
        return <Badge variant="outline" className="bg-safe/20 text-safe border-safe/30 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> PROCESSED</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1 animate-pulse"><Cpu className="w-3 h-3" /> PROCESSING</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> FAILED</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> PENDING</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Video Ingestion</h2>
        <p className="text-muted-foreground">Upload and process surveillance footage for AI analysis.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Ingestion Zone</CardTitle>
            <CardDescription>Drop footage here or click to browse</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-card/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".mp4,.avi,.mov,video/mp4,video/avi,video/quicktime" 
              />
              
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <UploadIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">Drag & Drop Footage</h3>
              <p className="text-sm text-muted-foreground mb-4">MP4, AVI, or MOV (max. 2GB)</p>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Browse Files
              </Button>
            </div>

            {selectedFile && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/50">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileVideo className="h-8 w-8 text-primary shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="camera">Source Camera</Label>
                    <Select value={cameraName} onValueChange={setCameraName}>
                      <SelectTrigger id="camera">
                        <SelectValue placeholder="Select camera" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAM-01-MAIN">CAM-01-MAIN (Front Entrance)</SelectItem>
                        <SelectItem value="CAM-02-LOBBY">CAM-02-LOBBY (Reception)</SelectItem>
                        <SelectItem value="CAM-03-EXT">CAM-03-EXT (Parking Lot)</SelectItem>
                        <SelectItem value="CAM-04-HALL">CAM-04-HALL (Corridor A)</SelectItem>
                        <SelectItem value="DRONE-01">DRONE-01 (Aerial Unit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleUpload}
                    disabled={uploadVideoMutation.isPending}
                  >
                    {uploadVideoMutation.isPending ? "UPLOADING..." : "UPLOAD TO STAGING"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle>Staging Area</CardTitle>
            <CardDescription>Uploaded footage ready for processing</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : videos && videos.length > 0 ? (
              <div className="space-y-3">
                {videos.map((video) => (
                  <div key={video.id} className="p-3 border rounded-md bg-card shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm truncate max-w-[200px]" title={video.fileName}>
                          {video.fileName}
                        </span>
                      </div>
                      {getStatusBadge(video.status)}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{video.cameraName}</span>
                      <span>{new Date(video.uploadTime).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(video.id)}
                        disabled={deleteVideoMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-8"
                        onClick={() => handleProcess(video.id)}
                        disabled={video.status !== 'pending' || processVideoMutation.isPending}
                      >
                        {processVideoMutation.isPending && processVideoMutation.variables?.id === video.id ? (
                          "STARTING..."
                        ) : (
                          <><Cpu className="h-3 w-3 mr-1" /> Process</>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border border-dashed rounded-md">
                <FileVideo className="h-8 w-8 mb-2 opacity-50" />
                <p>No videos in staging area</p>
                <p className="text-xs mt-1">Upload footage to begin analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
