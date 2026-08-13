"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Radio, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/modules/shared/api/http";

type RealtimeSettingsPayload = {
  enabled: boolean;
  app_id: string;
  app_key: string;
  host: string;
  port: number;
  scheme: string;
  app_secret_set: boolean;
  managed_by_environment: boolean;
  source: "environment" | "database";
};

/**
 * Reverb credentials for the current deployment.
 *
 * Production and local environments can have different public websocket
 * endpoints. When a complete environment configuration is present, this view
 * is read-only and operators are directed to update the deployment variables
 * and redeploy. The database form remains available as a backwards-compatible
 * fallback for installations that do not configure Reverb through the env.
 */
export default function RealtimeSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } =
    useQuery<RealtimeSettingsPayload>({
      queryKey: ["settings", "realtime"],
      queryFn: async () => (await api.get("/settings/realtime")).data?.data,
    });

  const [form, setForm] = useState<RealtimeSettingsPayload | null>(null);
  const [secret, setSecret] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;

      return (
        await api.post("/settings/realtime", {
          enabled: form.enabled,
          app_id: form.app_id,
          app_key: form.app_key,
          // Omitted when blank so the stored secret survives an edit.
          ...(secret.trim() ? { app_secret: secret.trim() } : {}),
          host: form.host,
          port: Number(form.port),
          scheme: form.scheme,
        })
      ).data;
    },
    onSuccess: () => {
      toast.success("Realtime settings saved.");
      setSecret("");
      void queryClient.invalidateQueries({
        queryKey: ["settings", "realtime"],
      });
    },
    onError: (error: any) => {
      const errors = error?.response?.data?.errors;
      toast.error(
        errors
          ? String(Object.values(errors)[0])
          : error?.response?.data?.message ||
              "Could not save realtime settings.",
      );
    },
  });

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 p-6 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading
        realtime settings…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="space-y-3 rounded-xl border border-border/60 p-4"
        role="alert"
      >
        <div>
          <p className="font-bold">Could not load realtime settings</p>
          <p className="text-sm text-muted-foreground">
            Check the API connection, then try again.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          Retry loading settings
        </Button>
      </div>
    );
  }

  if (!form) {
    return (
      <p className="p-6 text-sm text-muted-foreground" role="status">
        No realtime configuration is available for this deployment.
      </p>
    );
  }

  const update = (patch: Partial<RealtimeSettingsPayload>) =>
    setForm((current) => (current ? { ...current, ...patch } : current));

  const managedByEnvironment = form.managed_by_environment;

  return (
    <div className="space-y-6" data-testid="realtime-settings">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/60">
          <Radio className="h-5 w-5 text-indigo-500" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tight">
            Realtime (Reverb)
          </h3>
          <p className="text-sm text-muted-foreground">
            Kitchen displays and the floor app subscribe with these. They hold
            an open connection instead of relying on a push service.
          </p>
        </div>
      </div>

      {managedByEnvironment ? (
        <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500"
            aria-hidden="true"
          />
          <div>
            <p className="font-bold">Managed by deployment environment</p>
            <p className="text-sm text-muted-foreground">
              These values come from this deployment&apos;s REVERB_ and
              NEXT_PUBLIC_REVERB_ variables. Update those variables and redeploy
              to change the connection.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-xl border border-border/50 p-4">
        <div>
          <Label htmlFor="realtime_enabled" className="font-bold">
            Realtime enabled
          </Label>
          <p
            id="realtime-enabled-help"
            className="text-xs text-muted-foreground"
          >
            Turn off to stop clients attempting to connect.
          </p>
        </div>
        <Switch
          id="realtime_enabled"
          checked={form.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
          disabled={managedByEnvironment}
          aria-describedby="realtime-enabled-help"
          data-testid="realtime-enabled"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reverb_app_id">App ID</Label>
          <Input
            id="reverb_app_id"
            value={form.app_id}
            onChange={(event) => update({ app_id: event.target.value })}
            disabled={managedByEnvironment}
            aria-describedby="reverb-app-id-help"
            data-testid="realtime-app-id"
          />
          <p id="reverb-app-id-help" className="text-xs text-muted-foreground">
            Server application identifier for this deployment.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reverb_app_key">App key</Label>
          <Input
            id="reverb_app_key"
            value={form.app_key}
            onChange={(event) => update({ app_key: event.target.value })}
            disabled={managedByEnvironment}
            aria-describedby="reverb-app-key-help"
            data-testid="realtime-app-key"
          />
          <p id="reverb-app-key-help" className="text-xs text-muted-foreground">
            Sent to clients. Safe to expose.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="reverb_app_secret">App secret</Label>
          <Input
            id="reverb_app_secret"
            type="password"
            value={secret}
            placeholder={
              form.app_secret_set
                ? "A secret is stored — leave blank to keep it"
                : "Not set"
            }
            onChange={(event) => setSecret(event.target.value)}
            disabled={managedByEnvironment}
            aria-describedby="reverb-app-secret-help"
            data-testid="realtime-app-secret"
          />
          <p
            id="reverb-app-secret-help"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Server-side only. Encrypted at rest and never returned by the API.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reverb_host">Host</Label>
          <Input
            id="reverb_host"
            value={form.host}
            placeholder="realtime.example.com"
            onChange={(event) => update({ host: event.target.value })}
            disabled={managedByEnvironment}
            aria-describedby="reverb-host-help"
            data-testid="realtime-host"
          />
          <p id="reverb-host-help" className="text-xs text-muted-foreground">
            Public hostname used by browser clients.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reverb_port">Port</Label>
            <Input
              id="reverb_port"
              type="number"
              value={form.port}
              onChange={(event) => update({ port: Number(event.target.value) })}
              disabled={managedByEnvironment}
              data-testid="realtime-port"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reverb_scheme">Scheme</Label>
            <Select
              value={form.scheme}
              onValueChange={(scheme) => update({ scheme })}
              disabled={managedByEnvironment}
            >
              <SelectTrigger id="reverb_scheme" data-testid="realtime-scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="https">https</SelectItem>
                <SelectItem value="http">http</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => save.mutate()}
        disabled={managedByEnvironment || save.isPending}
        data-testid="realtime-save"
      >
        {save.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {managedByEnvironment
          ? "Managed by environment"
          : "Save realtime settings"}
      </Button>
    </div>
  );
}
