import { useState } from "react";
import { useListReports, useCreateReport, useListVideos, getListReportsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Plus, FileSignature, ShieldAlert, AlignLeft, ListChecks, Clock, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Reports() {
  const { data: reports, isLoading: loadingReports } = useListReports();
  const { data: videos } = useListVideos();
  const createReportMutation = useCreateReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [videoId, setVideoId] = useState<string>("none");

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createReportMutation.mutate(
      { 
        data: { 
          title, 
          videoId: videoId !== "none" ? parseInt(videoId) : undefined 
        } 
      },
      {
        onSuccess: (newReport) => {
          toast({ title: "Report generated successfully" });
          queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
          setIsCreating(false);
          setTitle("");
          setVideoId("none");
          setSelectedReport(newReport); // Auto-select the new report
        },
        onError: () => {
          toast({ title: "Failed to generate report", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Investigation Reports</h2>
          <p className="text-muted-foreground">AI-generated summaries of incidents and analytical findings.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Generate New Report
        </Button>
      </div>

      {isCreating && (
        <Card className="border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
          <CardHeader>
            <CardTitle className="text-lg">Report Generation Parameters</CardTitle>
            <CardDescription>Configure the scope for the AI analyst.</CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateReport}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Report Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g., Q3 Security Audit - Main Entrance" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video">Focus Video (Optional)</Label>
                <Select value={videoId} onValueChange={setVideoId}>
                  <SelectTrigger id="video">
                    <SelectValue placeholder="Select a video to analyze" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">System-wide Overview</SelectItem>
                    {videos?.map(v => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.fileName} ({v.cameraName})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={createReportMutation.isPending}>
                {createReportMutation.isPending ? "Generating..." : "Compile Report"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-[600px] flex flex-col">
          <CardHeader className="pb-3 border-b">
            <CardTitle>Report Archive</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {loadingReports ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : reports && reports.length > 0 ? (
              <div className="divide-y divide-border">
                {reports.map(report => (
                  <div 
                    key={report.id} 
                    className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${selectedReport?.id === report.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                    onClick={() => setSelectedReport(report)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-sm truncate pr-2">{report.title}</h4>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${report.severity === 'critical' ? 'text-destructive border-destructive' : 'text-primary border-primary'}`}>
                        {report.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground font-mono">
                      <FileText className="w-3 h-3 mr-1" />
                      {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <FileSignature className="w-10 h-10 mb-2 opacity-20" />
                <p>No reports generated yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 h-[600px] flex flex-col">
          {selectedReport ? (
            <>
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl mb-1">{selectedReport.title}</CardTitle>
                    <CardDescription className="font-mono text-xs flex gap-4">
                      <span>ID: REP-{selectedReport.id.toString().padStart(4, '0')}</span>
                      <span>DATE: {format(new Date(selectedReport.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                      {selectedReport.videoId && <span>VID: {selectedReport.videoId}</span>}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" /> Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Executive Summary */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3 border-b pb-1">
                    <AlignLeft className="w-4 h-4" /> Executive Summary
                  </h3>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 bg-card p-4 rounded-md border border-border/50">
                    {selectedReport.summary}
                  </div>
                </section>

                {/* Risk Analysis */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3 border-b pb-1">
                    <ShieldAlert className="w-4 h-4" /> Risk Assessment
                  </h3>
                  <div className="flex items-center gap-6 bg-card p-4 rounded-md border border-border/50">
                    <div className="text-center">
                      <div className="text-3xl font-bold font-mono text-primary">{selectedReport.riskScore}</div>
                      <div className="text-xs text-muted-foreground">OVERALL RISK</div>
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
                        <div 
                          className={`h-full ${selectedReport.riskScore > 80 ? 'bg-destructive' : selectedReport.riskScore > 50 ? 'bg-warning' : 'bg-safe'}`} 
                          style={{ width: `${selectedReport.riskScore}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Severity classification: <strong className="text-foreground uppercase">{selectedReport.severity}</strong>. 
                        Immediate attention {selectedReport.severity === 'critical' ? 'REQUIRED' : 'recommended'}.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Key Findings */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3 border-b pb-1">
                    <ListChecks className="w-4 h-4" /> Key Findings
                  </h3>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-foreground/90">
                    {selectedReport.findings.split('\n').filter(Boolean).map((finding: string, i: number) => (
                      <li key={i} className="pl-1 leading-relaxed">{finding.replace(/^[-\*]\s/, '')}</li>
                    ))}
                  </ul>
                </section>

                {/* Recommendations */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3 border-b pb-1">
                    <Target className="w-4 h-4" /> Actionable Recommendations
                  </h3>
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
                    <ul className="space-y-3 text-sm text-foreground/90">
                      {selectedReport.recommendations.split('\n').filter(Boolean).map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="mt-0.5 bg-primary/20 text-primary w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold">{i+1}</div>
                          <span className="leading-relaxed">{rec.replace(/^[-\*\d\.]\s/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {selectedReport.timeline && (
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3 border-b pb-1">
                      <Clock className="w-4 h-4" /> Incident Narrative
                    </h3>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground font-mono bg-black/50 p-4 rounded-md border border-border">
                      {selectedReport.timeline}
                    </div>
                  </section>
                )}
                
              </CardContent>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
              <FileText className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg font-medium">No Report Selected</p>
              <p className="text-sm">Select a report from the archive to view its contents.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
