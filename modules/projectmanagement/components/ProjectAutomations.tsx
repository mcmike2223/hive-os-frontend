"use client";

import React, { useState } from "react";
import { Plus, Zap, Trash2, Edit2, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Project } from "../types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectApi } from "../api";
import { toast } from "sonner";
import { CreateAutomationModal } from "./CreateAutomationModal";
import { useTranslation } from "@/store/use-translation";

interface ProjectAutomationsProps {
  project: Project;
}

export function ProjectAutomations({ project }: ProjectAutomationsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: automations = [] } = useQuery({
    queryKey: ["project-automations", project.id],
    queryFn: () => projectApi.getAutomations(project.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectApi.deleteAutomation(id),
    onSuccess: () => {
      toast.success("Automation deleted");
      queryClient.invalidateQueries({ queryKey: ["project-automations", project.id] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      projectApi.updateAutomation(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-automations", project.id] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('project_management.workflow_automations', 'Workflow Automations')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('project_management.automate_repetitive_tasks', 'Automate repetitive tasks and keep your project moving efficiently.')}
          </p>
        </div>
        <Button 
          id="tour-pm-automations-create"
          className="h-10 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t('project_management.create_automation', 'Create Automation')}
        </Button>
      </div>

      <CreateAutomationModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        projectId={project.id}
      />

      <div id="tour-pm-automations-list" className="grid gap-4">
        {automations.map((automation: any) => (
          <div key={automation.id} className="group flex items-center justify-between p-5 rounded-2xl border bg-card hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{automation.name}</h3>
                  {automation.is_active ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none uppercase text-[11px] tracking-widest font-black">{t('project_management.active', 'Active')}</Badge>
                  ) : (
                    <Badge variant="secondary" className="uppercase text-[11px] tracking-widest font-black">{t('project_management.paused', 'Paused')}</Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground font-medium">
                  <span className="px-2 py-0.5 rounded-md bg-muted/50 text-foreground font-bold">{t('project_management.if', 'IF')}</span>
                  <span>{t(`project_management.${automation.trigger}`, automation.trigger.replace(/_/g, ' '))}</span>
                  <span className="px-2 py-0.5 rounded-md bg-muted/50 text-foreground font-bold">{t('project_management.then', 'THEN')}</span>
                  <span className="text-primary font-bold">{t(`project_management.${automation.action}`, automation.action.replace(/_/g, ' '))}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 mr-4 pr-4 border-r border-border/50">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('project_management.enabled', 'Enabled')}</span>
                <Switch 
                  checked={automation.is_active} 
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: automation.id, is_active: checked })}
                />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary">
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(automation.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {automations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed bg-muted/5">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">{t('project_management.no_automations_yet', 'No automations yet')}</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              {t('project_management.create_first_automation_desc', 'Create your first automation to handle repetitive status changes, notifications, or subtask creation.')}
            </p>
            <Button variant="outline" className="mt-6 rounded-xl border-dashed">
              {t('project_management.explore_templates', 'Explore Templates')}
            </Button>
          </div>
        )}
      </div>

      <div id="tour-pm-automations-recommend" className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-4">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-900">{t('project_management.recommended_for_project', 'Recommended for this project:')}</p>
          <p className="text-xs text-amber-700/80 mt-1">
            {t('project_management.recommended_automation_desc', 'We noticed many tasks are being completed without notifications. Consider adding an automation to "Notify Project Manager when a task is marked as Done".')}
          </p>
        </div>
      </div>
    </div>
  );
}
