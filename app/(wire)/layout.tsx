import { AppShell } from "@/components/shell/app-shell";

export default function WireLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
