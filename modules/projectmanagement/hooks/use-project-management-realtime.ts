"use client";

import * as React from "react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getProjectManagementChannelName,
  getProjectManagementProjectChannelName,
  initEcho,
} from "@/lib/echo";
import { getAccessToken } from "@/lib/runtime-context";

type RealtimePayload = Record<string, unknown>;
type TypingUser = { name: string; timestamp: number };
type SendTyping = (isTyping: boolean, user: { id: string | number; name: string }) => void;

type ProjectManagementRealtimeOptions = {
  projectId?: string | null;
  onCommentCreated?: (payload: RealtimePayload) => void;
  onCommentUpdated?: (payload: RealtimePayload) => void;
  onCommentDeleted?: (payload: RealtimePayload) => void;
};

type ProjectManagementEvent = {
  project_id?: string | number | null;
  action?: string;
  payload?: RealtimePayload;
};

type ProjectManagementTypingEvent = {
  user_id?: string | number;
  user_name?: string;
};

export function useProjectManagementRealtime(options: ProjectManagementRealtimeOptions = {}) {
  const [typingUsers, setTypingUsers] = React.useState<Record<string, TypingUser>>({});
  const sendTypingRef = React.useRef<SendTyping | null>(null);
  const callbackRefs = React.useRef<Pick<ProjectManagementRealtimeOptions, "onCommentCreated" | "onCommentUpdated" | "onCommentDeleted">>({});
  const queryClient = useQueryClient();
  const { projectId, onCommentCreated, onCommentUpdated, onCommentDeleted } = options;

  useEffect(() => {
    callbackRefs.current = { onCommentCreated, onCommentUpdated, onCommentDeleted };
  }, [onCommentCreated, onCommentUpdated, onCommentDeleted]);

  useEffect(() => {
    const token = getAccessToken() || localStorage.getItem("token");

    if (!token) {
      return;
    }

    const echo = initEcho(token);
    const workspaceChannelName = getProjectManagementChannelName();
    const workspaceChannel = echo.private(workspaceChannelName);

    const refreshProjectManagement = (event: ProjectManagementEvent) => {
      const eventProjectId = event?.project_id ? String(event.project_id) : null;
      const action = event?.action;
      const payload = event?.payload;

      // Check for specific comment actions if callbacks are provided
      if ((action === 'project.comment_created' || action === 'comment.created') && callbackRefs.current.onCommentCreated) {
        callbackRefs.current.onCommentCreated(payload ?? {});
        return;
      }
      if ((action === 'project.comment_updated' || action === 'comment.updated') && callbackRefs.current.onCommentUpdated) {
        callbackRefs.current.onCommentUpdated(payload ?? {});
        return;
      }
      if ((action === 'project.comment_deleted' || action === 'comment.deleted') && callbackRefs.current.onCommentDeleted) {
        callbackRefs.current.onCommentDeleted(payload ?? {});
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-summary"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-task"] });

      if (eventProjectId) {
        queryClient.invalidateQueries({ queryKey: ["project", eventProjectId] });
        queryClient.invalidateQueries({ queryKey: ["project-comments", eventProjectId] });
      }

      if (projectId && !eventProjectId) {
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
      }
    };

    workspaceChannel.listen(".project-management.updated", refreshProjectManagement);

    // Typing indicators
    const handleTyping = (event: ProjectManagementTypingEvent) => {
      const userId = event.user_id;
      const userName = event.user_name;

      if (userId && userName) {
        setTypingUsers(prev => ({
          ...prev,
          [String(userId)]: {
            name: userName,
            timestamp: Date.now(),
          },
        }));
      }
    };

    workspaceChannel.listenForWhisper('typing', handleTyping);

    // Cleanup old typing indicators
    const typingInterval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (now - next[id].timestamp > 3000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    let projectChannelName: string | null = null;
    let projectChannel: typeof workspaceChannel | null = null;
    if (projectId) {
      projectChannelName = getProjectManagementProjectChannelName(projectId);
      projectChannel = echo.private(projectChannelName);
      projectChannel.listen(".project-management.updated", refreshProjectManagement);
      projectChannel.listenForWhisper('typing', handleTyping);
    }

    const sendTyping: SendTyping = (isTyping, user) => {
      if (isTyping) {
        workspaceChannel.whisper('typing', {
          user_id: user.id,
          user_name: user.name,
          project_id: projectId
        });
        if (projectChannel) {
          projectChannel.whisper('typing', {
            user_id: user.id,
            user_name: user.name,
            project_id: projectId
          });
        }
      }
    };

    sendTypingRef.current = sendTyping;

    return () => {
      clearInterval(typingInterval);
      echo.leave(workspaceChannelName);
      if (projectChannelName) {
        echo.leave(projectChannelName);
      }
    };
  }, [projectId, queryClient]);

  return { 
    typingUsers,
    sendTyping: (isTyping: boolean, user: { id: string | number, name: string }) => {
      sendTypingRef.current?.(isTyping, user);
    }
  };
}
