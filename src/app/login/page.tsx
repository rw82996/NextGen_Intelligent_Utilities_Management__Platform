"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { authenticate } from "@/lib/client-data";
import { Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("daniel.osei@gridnextgen.io");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    const user = authenticate(email, password);
    if (user) {
      toast.success("Welcome to GridNextGen");
      router.push("/");
    } else {
      toast.error("Invalid credentials");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6TTAgMGgzMnYySDByLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm shadow-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">GridNextGen</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            The Grid,<br />Intelligently Managed.
          </h1>
          <p className="text-lg text-white/70 max-w-md leading-relaxed">
            AI-powered demand forecasting, real-time telemetry, energy-theft detection, digital-twin simulation, and GPU/WASM edge analytics — one control room.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold">4.8 GW</p>
              <p className="text-sm text-white/60 mt-1">Load Managed</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold">94%</p>
              <p className="text-sm text-white/60 mt-1">Auto-Dispatch</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold">60.0 Hz</p>
              <p className="text-sm text-white/60 mt-1">Frequency</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50/30 px-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4 lg:hidden">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/25">
                <Zap className="h-7 w-7" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
            <CardDescription className="text-sm">Sign in to your GridNextGen control room</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-11" />
            </div>
            <Button className="w-full h-11 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 shadow-md shadow-emerald-500/20 font-medium" onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-center text-xs text-muted-foreground mt-4 space-y-1">
              <p className="font-medium">Demo credentials pre-filled</p>
              <p className="font-mono text-[11px]">daniel.osei@gridnextgen.io / demo1234</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
