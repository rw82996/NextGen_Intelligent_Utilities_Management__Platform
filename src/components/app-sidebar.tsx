"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Network, Gauge, AlertTriangle, TrendingUp, ScrollText, Zap,
  Bot, ShieldAlert, CheckCircle, Boxes, Activity, FileText,
  Cpu, Wifi, Binary, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
} from "@/components/ui/sidebar";

const coreItems = [
  { title: "Grid Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Grid Assets", href: "/assets", icon: Network },
  { title: "Smart Meters", href: "/meters", icon: Gauge },
  { title: "Outages", href: "/outages", icon: AlertTriangle },
  { title: "Dispatch Approvals", href: "/dispatch", icon: CheckCircle },
  { title: "Demand Forecast", href: "/forecast", icon: TrendingUp },
  { title: "Audit Trail", href: "/audit", icon: ScrollText },
];

const intelligenceItems = [
  { title: "AI Grid Copilot", href: "/copilot", icon: Bot },
  { title: "Document Intelligence", href: "/documents", icon: FileText },
  { title: "Energy-Theft Detection", href: "/theft", icon: ShieldAlert },
  { title: "Predictive Failure", href: "/predictive", icon: Boxes },
  { title: "Digital Twin", href: "/twin", icon: Activity },
];

const edgeItems = [
  { title: "GPU Anomaly Scoring", href: "/edge/gpu-anomaly", icon: Cpu },
  { title: "Live Telemetry", href: "/edge/live", icon: Wifi },
  { title: "WASM Meter Validator", href: "/edge/wasm-validator", icon: Binary },
];

function NavGroup({ label, items, pathname }: { label: string; items: typeof coreItems; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest font-semibold">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton render={<Link href={item.href} />} isActive={active} tooltip={item.title}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/25">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight text-sidebar-foreground">GridNextGen</span>
            <p className="text-[11px] text-sidebar-foreground/50">Intelligent Utilities</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Operations" items={coreItems} pathname={pathname} />
        <NavGroup label="Intelligence" items={intelligenceItems} pathname={pathname} />
        <NavGroup label="Edge Computing" items={edgeItems} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/login" />}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
