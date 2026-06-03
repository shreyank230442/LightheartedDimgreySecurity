import { useState } from "react";
import { useLocation } from "wouter";
import { Video, ShieldAlert, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("operator@avis.soc");
  const [password, setPassword] = useState("************");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setTimeout(() => {
      setLocation("/dashboard");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-destructive/20 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-card border border-primary/50 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AVIS</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm uppercase tracking-widest">
            Agentic Visual Incident Investigation System
          </p>
        </div>

        <Card className="border-primary/20 shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>System Access</CardTitle>
            <CardDescription>Enter credentials to access the SOC terminal.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Operator ID / Email</Label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 font-mono text-sm" 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passkey</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono text-sm tracking-widest" 
                  required 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isAuthenticating}>
                {isAuthenticating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full animate-spin" />
                    AUTHENTICATING...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    INITIALIZE SECURE SESSION
                  </span>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground font-mono">
            UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED
            <br />
            IP: 192.168.1.144 | TERMINAL: T-800
          </p>
        </div>
      </div>
    </div>
  );
}
