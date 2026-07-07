"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { projectApi } from "@/modules/projectmanagement/api";
import { useProjectManagementRealtime } from "@/modules/projectmanagement/hooks/use-project-management-realtime";
import { useTour } from "@/components/providers/tour-provider";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

type TeamMember = {
  userId: string;
  name: string;
  email: string;
  avatarPath: string | null;
  projects: string[];
  roles: string[];
};

export default function TeamPage() {
  const { t } = useTranslation();
  const { startTour } = useTour();
  
  const teamTourSteps = [
    { target: '#tour-pm-team-header', title: t('tour.team_header_title', 'Team Directory'), content: t('tour.team_header_desc', 'See everyone working across your projects.'), placement: 'bottom' as const },
    { target: '#tour-pm-team-list', title: t('tour.team_list_title', 'Member Details'), content: t('tour.team_list_desc', 'View roles and project counts per person.'), placement: 'top' as const },
  ];
  useProjectManagementRealtime();

  const { data, isLoading } = useQuery({
    queryKey: ["projects", "team"],
    queryFn: () => projectApi.getProjects({ per_page: 100 }),
  });

  const members = React.useMemo(() => {
    const grouped = new Map<string, TeamMember>();

    for (const project of data?.data || []) {
      for (const membership of project.members || []) {
        if (!membership.user) {
          continue;
        }

        const existing = grouped.get(membership.user_id) || {
          userId: membership.user_id,
          name: membership.user.name,
          email: membership.user.email,
          avatarPath: membership.user.avatar_path,
          projects: [],
          roles: [],
        };

        existing.projects.push(project.name);
        existing.roles.push(membership.role);
        grouped.set(membership.user_id, existing);
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div id="tour-pm-team-header" className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('project_management.team', 'Team')}</h1>
          <p className="text-muted-foreground">{t('project_management.team_desc', 'See who is working across your active project spaces.')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => startTour(teamTourSteps)} className="bg-background/50 backdrop-blur-md rounded-full">
          <HelpCircle className="h-4 w-4 mr-2" />
          {t('topbar.system_tour', 'System Tour')}
        </Button>
      </div>

      <Card id="tour-pm-team-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            {t('project_management.project_members', 'Project Members')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">{t('project_management.no_project_members', 'No project members yet.')}</div>
          ) : (
            members.map((member) => <TeamMemberRow key={member.userId} member={member} t={t} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamMemberRow({ member, t }: { member: TeamMember; t: (key: string, fallback?: string) => string }) {
  const topRole = member.roles.includes("owner")
    ? "owner"
    : member.roles.includes("manager")
      ? "manager"
      : member.roles[0] || "member";

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatarPath || undefined} />
          <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{member.name}</p>
          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">{topRole}</Badge>
        <Badge variant="secondary">{member.projects.length} {t('project_management.projects', 'projects')}</Badge>
      </div>
    </div>
  );
}
