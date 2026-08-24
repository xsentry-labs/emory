"use client";

import {
  Bell,
  Briefcase,
  FileText,
  Flame,
  Hash,
  LineChart,
  Link2,
  MessagesSquare,
  Newspaper,
  Search,
  Sparkles,
  Target,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  sparkles: Sparkles,
  messages: MessagesSquare,
  hash: Hash,
  briefcase: Briefcase,
  newspaper: Newspaper,
  flame: Flame,
  wrench: Wrench,
  "line-chart": LineChart,
  bell: Bell,
  link: Link2,
  target: Target,
  "file-text": FileText,
};

export function DeskIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Newspaper;
  return <Icon className={className} aria-hidden />;
}
