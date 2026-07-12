"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppHeader() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur-sm px-4 sticky top-0 z-10">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search assets, meters, outages..." className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1" />
        </div>
      </div>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-4 w-4" />
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-[10px] text-white flex items-center justify-center font-medium shadow-sm">
          3
        </span>
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8 ring-2 ring-primary/10">
          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-600 text-white text-xs font-medium">DO</AvatarFallback>
        </Avatar>
        <div className="text-sm">
          <p className="font-medium leading-none">Daniel Osei</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Grid Operator</p>
        </div>
      </div>
    </header>
  );
}
