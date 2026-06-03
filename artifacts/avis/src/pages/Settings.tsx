import { useEffect } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Save, Settings2, Sliders, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const settingsSchema = z.object({
  defaultModel: z.string(),
  enableMotionDetection: z.boolean(),
  enableFaceDetection: z.boolean(),
  loiteringThresholdMinutes: z.coerce.number().min(1).max(60),
  abandonedObjectMinutes: z.coerce.number().min(1).max(60),
  crowdThreshold: z.coerce.number().min(2).max(50),
  runningVelocityThreshold: z.coerce.number().min(1).max(10),
  riskScoreLoitering: z.coerce.number().min(0).max(100),
  riskScoreRestrictedArea: z.coerce.number().min(0).max(100),
  riskScoreAbandonedBag: z.coerce.number().min(0).max(100),
  riskScoreCrowd: z.coerce.number().min(0).max(100),
  riskScoreRunning: z.coerce.number().min(0).max(100),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettingsMutation = useUpdateSettings();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultModel: "gemini-1.5-pro",
      enableMotionDetection: true,
      enableFaceDetection: false,
      loiteringThresholdMinutes: 5,
      abandonedObjectMinutes: 10,
      crowdThreshold: 5,
      runningVelocityThreshold: 3.5,
      riskScoreLoitering: 40,
      riskScoreRestrictedArea: 85,
      riskScoreAbandonedBag: 90,
      riskScoreCrowd: 30,
      riskScoreRunning: 50,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        defaultModel: settings.defaultModel,
        enableMotionDetection: settings.enableMotionDetection,
        enableFaceDetection: settings.enableFaceDetection,
        loiteringThresholdMinutes: settings.loiteringThresholdMinutes,
        abandonedObjectMinutes: settings.abandonedObjectMinutes,
        crowdThreshold: settings.crowdThreshold,
        runningVelocityThreshold: settings.runningVelocityThreshold,
        riskScoreLoitering: settings.riskScoreLoitering,
        riskScoreRestrictedArea: settings.riskScoreRestrictedArea,
        riskScoreAbandonedBag: settings.riskScoreAbandonedBag,
        riskScoreCrowd: settings.riskScoreCrowd,
        riskScoreRunning: settings.riskScoreRunning,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsFormValues) => {
    updateSettingsMutation.mutate(
      { data },
      {
        onSuccess: () => {
          toast({
            title: "Configuration Saved",
            description: "System parameters have been updated successfully.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to save configuration.",
            variant: "destructive",
          });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="h-[400px] flex items-center justify-center"><Skeleton className="h-10 w-10 rounded-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
        <p className="text-muted-foreground">Adjust analysis thresholds and model parameters.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-primary" /> Core Engine</CardTitle>
              <CardDescription>Primary AI model and feature toggles.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="defaultModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vision Intelligence Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (High Accuracy)</SelectItem>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Fast Processing)</SelectItem>
                        <SelectItem value="yolo-v8">YOLOv8 Local (Edge Realtime)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Model used for deep visual analysis and reporting.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="enableMotionDetection"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Optical Flow Motion</FormLabel>
                        <FormDescription>Pre-filter frames based on pixel movement.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enableFaceDetection"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Facial Recognition</FormLabel>
                        <FormDescription>Extract and match facial embeddings (Requires compliance clearance).</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Detection Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sliders className="w-5 h-5 text-primary" /> Detection Thresholds</CardTitle>
                <CardDescription>Time and quantity triggers for generating events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="loiteringThresholdMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between pb-2">
                        <FormLabel>Loitering Time (Minutes)</FormLabel>
                        <span className="font-mono text-xs text-primary">{field.value} min</span>
                      </div>
                      <FormControl>
                        <Slider min={1} max={60} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="abandonedObjectMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between pb-2">
                        <FormLabel>Abandoned Object (Minutes)</FormLabel>
                        <span className="font-mono text-xs text-primary">{field.value} min</span>
                      </div>
                      <FormControl>
                        <Slider min={1} max={60} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="crowdThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between pb-2">
                        <FormLabel>Crowd Density Alert (Persons)</FormLabel>
                        <span className="font-mono text-xs text-primary">{field.value} persons</span>
                      </div>
                      <FormControl>
                        <Slider min={2} max={50} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Risk Scoring */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Threat Assessment</CardTitle>
                <CardDescription>Base risk scores assigned to event types (0-100).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RiskScoreField form={form} name="riskScoreRestrictedArea" label="Restricted Area Intrusion" />
                <Separator />
                <RiskScoreField form={form} name="riskScoreAbandonedBag" label="Abandoned Bag/Object" />
                <Separator />
                <RiskScoreField form={form} name="riskScoreRunning" label="Running/Fleeing" />
                <Separator />
                <RiskScoreField form={form} name="riskScoreLoitering" label="Loitering" />
                <Separator />
                <RiskScoreField form={form} name="riskScoreCrowd" label="Crowd Formation" />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" className="gap-2 font-mono" disabled={updateSettingsMutation.isPending}>
              <Save className="w-4 h-4" />
              {updateSettingsMutation.isPending ? "SAVING..." : "COMMIT CHANGES"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function RiskScoreField({ form, name, label }: { form: any, name: string, label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between space-y-0">
          <FormLabel className="text-sm font-normal flex-1">{label}</FormLabel>
          <div className="flex items-center gap-4 flex-1 justify-end">
            <div className="w-32">
              <FormControl>
                <Slider min={0} max={100} step={5} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
              </FormControl>
            </div>
            <div className={`w-10 text-right font-mono text-sm ${field.value >= 80 ? 'text-destructive' : field.value >= 50 ? 'text-warning' : 'text-safe'}`}>
              {field.value}
            </div>
          </div>
        </FormItem>
      )}
    />
  );
}
