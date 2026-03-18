"use client";

import Link from "next/link";
import { Users } from "lucide-react";

import { ClassColorBadge } from "@/components/class-color-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClassSummary } from "@/lib/api";

interface ClassCardProps {
  cls: ClassSummary;
}

const roleLabels: Record<ClassSummary["myRole"], string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function ClassCard({ cls }: ClassCardProps) {
  return (
    <Link href={`/classes/${cls.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClassColorBadge color={cls.color} />
            <CardTitle className="text-base truncate">{cls.name}</CardTitle>
          </div>
          <CardDescription className="line-clamp-2">
            {cls.description || "No description"}
          </CardDescription>
          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {cls.memberCount}
            </span>
            <Badge variant="secondary" className="text-xs">
              {roleLabels[cls.myRole]}
            </Badge>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
