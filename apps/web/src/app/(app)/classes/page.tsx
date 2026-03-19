"use client";

import { BookOpen, Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassCard } from "@/features/classes/components/class-card";
import { JoinClassDialog } from "@/features/classes/components/join-class-dialog";
import { useClasses } from "@/features/classes/hooks/use-classes";

export default function ClassesPage() {
  const { sharedClasses, loading, reload } = useClasses();

  return (
    <>
      <AppHeader title="Classes" />
      <div className="mx-auto max-w-240 p-6 space-y-6">
        <PageHeader
          title="Classes"
          description="Manage your classes and collaborate with others"
        >
          <JoinClassDialog
            trigger={
              <Button variant="outline" size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Join
              </Button>
            }
            onJoined={reload}
          />
          <Button asChild size="sm">
            <Link href="/classes/new">
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Link>
          </Button>
        </PageHeader>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : sharedClasses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No classes yet"
            description="Create a new class or join one with an invite code."
          >
            <div className="flex gap-2">
              <JoinClassDialog
                trigger={
                  <Button variant="outline" size="sm">
                    Join class
                  </Button>
                }
                onJoined={reload}
              />
              <Button asChild size="sm">
                <Link href="/classes/new">Create class</Link>
              </Button>
            </div>
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedClasses.map((cls) => (
              <ClassCard key={cls.id} cls={cls} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
