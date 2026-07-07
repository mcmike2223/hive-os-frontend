"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday, isSameDay, isThisYear } from "date-fns";
import { FileManagerClient, ImageViewer } from "@/components/dashboard/file-manager-client";
import { VideoPlayer } from "@/components/ui/video-player";
import { AudioPlayer } from "@/components/ui/audio-player";
import { PdfViewer } from "@/components/ui/pdf-viewer";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Calendar, CheckSquare, Loader2, MessageSquare, Plus, Trash2, Paperclip, FileIcon, X, ExternalLink, Upload, Pencil, Reply, MoreVertical, Smile, Send, CheckCircle2, ListChecks, AlertTriangle, Eye, Bug, Zap, Terminal, Code2, ShieldAlert, Layers, Cpu, Globe, Server, Link } from "lucide-react";
import { ProjectAttachment } from "../types";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { projectApi } from "../api";
import type { Column, Task } from "../types";
import { DiscussionComposer } from "./discussion/DiscussionComposer";
import { useProjectManagementRealtime } from "../hooks/use-project-management-realtime";
import { useUser } from "@/hooks/use-user";
import { motion, AnimatePresence } from "framer-motion";
import * as RuntimeContext from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { TaskTimer } from "./TaskTimer";
import { History as HistoryIcon, Clock, Trash2 as TrashIcon } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

interface TaskDetailModalProps {
  taskId: string | null;
  columns: Column[];
  onOpenChange: (open: boolean) => void;
}

const getStorageUrl = (url: string | null | undefined) => {
  return RuntimeContext.getBackendStorageUrl(url) || '';
};

const ISSUE_TYPE_CONFIG = {
  task: { label: "Task", icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  bug: { label: "Bug", icon: Bug, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  feature: { label: "Feature", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  improvement: { label: "Improvement", icon: Terminal, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  epic: { label: "Epic", icon: Layers, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  refactor: { label: "Refactor", icon: Code2, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  debt: { label: "Tech Debt", icon: ShieldAlert, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
};

const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

export function TaskDetailSheet({ taskId, columns, onOpenChange }: TaskDetailModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const isSoftwareDev = user?.business_type?.toLowerCase()?.replace('-', ' ') === 'software development';
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<string>("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editIssueType, setEditIssueType] = useState<string>("task");
  const [editStoryPoints, setEditStoryPoints] = useState<number | "">("");
  const [editEnvironment, setEditEnvironment] = useState<string>("none");
  const [editPrUrl, setEditPrUrl] = useState("");
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [composerAttachments, setComposerAttachments] = useState<any[]>([]);
  const [checklistItem, setChecklistItem] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [replyToName, setReplyToName] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'me' | 'everyone';
    ids: number[];
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: 'me',
    ids: [],
    title: "",
    description: ""
  });
  const [filePickerContext, setFilePickerContext] = useState<'composer' | 'attachments'>('composer');
  const [previewFile, setPreviewFile] = useState<any>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const open = Boolean(taskId);

  const { data: task, isLoading } = useQuery({
    queryKey: ["project-task", taskId],
    queryFn: () => projectApi.getTask(taskId as string),
    enabled: open,
  });

  const { data: timeLogs } = useQuery({
    queryKey: ["task-time-logs", taskId],
    queryFn: () => projectApi.getTimeLogs(taskId as string),
    enabled: open,
  });

  // Recursively flatten a nested comment tree into a flat array
  const flattenComments = (comments: any[]): any[] => {
    let flat: any[] = [];
    for (const c of comments) {
      if (!c) continue;
      const { replies, ...rest } = c;
      flat.push(rest);
      if (replies && Array.isArray(replies)) {
        flat = flat.concat(flattenComments(replies));
      }
    }
    return flat;
  };

  const canDeleteForEveryone = (comment: any) => {
    if (!comment || !user || !task) return false;
    const isOwner = Number(comment.user_id) === Number(user.id);
    const isManager = Number(task.project?.project_manager_id) === Number(user.id);
    const isProjectCreator = Number(task.project?.created_by) === Number(user.id);
    const isTaskCreator = Number(task.created_by) === Number(user.id);
    return isOwner || isManager || isProjectCreator || isTaskCreator;
  };

  // Enable real-time updates for the task view
  const { sendTyping, typingUsers } = useProjectManagementRealtime({ 
    projectId: task?.project_id,
    onCommentCreated: (payload: any) => {
      if (payload.task_id === taskId) {
        queryClient.setQueryData(["project-task", taskId], (oldData: any) => {
          if (!oldData) return oldData;

          const newComment = { ...payload.comment, replies: payload.comment.replies || [] };

          if (!newComment.parent_id) {
            // Root comment — check for duplicate then prepend
            if ((oldData.comments || []).some((c: any) => c.id === newComment.id)) return oldData;
            return { ...oldData, comments: [newComment, ...(oldData.comments || [])] };
          }

          // Reply — insert into the correct parent's replies array
          const insertReply = (comments: any[]): any[] => {
            return comments.map((c: any) => {
              if (c.id === newComment.parent_id) {
                if ((c.replies || []).some((r: any) => r.id === newComment.id)) return c;
                return { ...c, replies: [...(c.replies || []), newComment] };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: insertReply(c.replies) };
              }
              return c;
            });
          };

          return { ...oldData, comments: insertReply(oldData.comments || []) };
        });
        setTimeout(() => scrollToBottom("smooth"), 100);
      }
    },
    onCommentUpdated: (payload: any) => {
      queryClient.setQueryData(["project-task", taskId], (oldData: any) => {
        if (!oldData) return oldData;
        const deepMap = (comments: any[]): any[] =>
          comments.map(c => {
            if (c.id === payload.comment.id) return { ...payload.comment, replies: c.replies || [] };
            if (c.replies) return { ...c, replies: deepMap(c.replies) };
            return c;
          });
        return { ...oldData, comments: deepMap(oldData.comments || []) };
      });
    },
    onCommentDeleted: (payload: any) => {
      queryClient.setQueryData(["project-task", taskId], (oldData: any) => {
        if (!oldData) return oldData;
        const deepFilter = (comments: any[]): any[] =>
          comments
            .filter(c => c.id !== payload.comment_id)
            .map(c => (c.replies ? { ...c, replies: deepFilter(c.replies) } : c));
        return { ...oldData, comments: deepFilter(oldData.comments || []) };
      });
    }
  });

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  React.useEffect(() => {
    if (task?.comments?.length) {
      setTimeout(() => scrollToBottom("auto"), 100);
    }
  }, [task?.comments?.length]);

  React.useEffect(() => {
    if (task) {
      setAttachments(task.attachments || []);
    }
  }, [task]);

  const refresh = () => {
    if (taskId) queryClient.invalidateQueries({ queryKey: ["project-task", taskId] });
  };

  const addComment = useMutation({
    mutationFn: async (data: { content: string, parent_id?: number | null, attachments: any[] }) => {
      return await projectApi.addComment(taskId as string, data);
    },
    onSuccess: () => {
      setComposerAttachments([]);
      setParentId(null);
      setReplyToName(null);
      refresh();
      toast.success("Message posted");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to post message.");
    }
  });

  const updateComment = useMutation({
    mutationFn: (data: { id: number; content: string }) =>
      projectApi.updateTaskComment(data.id, { content: data.content }),
    onSuccess: () => {
      setEditingCommentId(null);
      setEditContent("");
      refresh();
      toast.success("Message updated");
    },
  });

   const deleteComment = useMutation({
    mutationFn: (data: { id: number; type: 'me' | 'everyone' }) => projectApi.deleteTaskComment(data.id, data.type),
    onSuccess: (_, variables) => {
      refresh();
      toast.success(variables.type === 'me' ? "Message hidden for you" : "Message deleted for everyone");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: (data: any) => projectApi.updateTask(taskId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-projects"] });
      setIsEditMode(false);
      toast.success("Task updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update task");
    }
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { id: number; status: 'approved' | 'rejected'; review_note?: string }) =>
      projectApi.reviewAttachment(data.id, { status: data.status, review_note: data.review_note }),
    onSuccess: () => {
      refresh();
      toast.success("Attachment reviewed successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to review attachment");
    }
  });

  const handleStartEdit = () => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setEditPriority(task.priority);
      setEditDueDate(task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "");
      setEditIssueType(task.issue_type || "task");
      setEditStoryPoints(task.story_points ?? "");
      setEditEnvironment(task.environment || "none");
      setEditPrUrl(task.pr_url || "");
      setIsEditMode(true);
    }
  };

  const deleteSelectedComments = async (type: 'me' | 'everyone' = 'me') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Pre-flatten comments once to avoid repeated recursive work
    const allFlat = flattenComments(task?.comments || []);

    if (type === 'everyone') {
      const deletableForEveryoneCount = ids.filter(id => {
        const comment = allFlat.find(c => c.id == id);
        return canDeleteForEveryone(comment);
      }).length;
      
      if (deletableForEveryoneCount === 0) {
        toast.error("You don't have permission to delete these messages for everyone.");
        return;
      }

      const confirmTitle = deletableForEveryoneCount === ids.length 
        ? `Delete ${ids.length} message(s) for everyone?`
        : `Partial Permission: Delete for everyone?`;

      const confirmDescription = deletableForEveryoneCount === ids.length 
        ? "This action will remove the content and attachments for all participants. This cannot be undone."
        : `You only have permission to delete ${deletableForEveryoneCount} of the selected messages for everyone. The remaining ${ids.length - deletableForEveryoneCount} will only be hidden for you.`;

      setDeleteConfirm({
        isOpen: true,
        type: 'everyone',
        ids,
        title: confirmTitle,
        description: confirmDescription
      });
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      type: 'me',
      ids,
      title: `Hide ${ids.length} message(s)?`,
      description: "These messages will be hidden from your view. Other participants will still see them."
    });
  };

  const executeBulkDelete = async (ids: number[], type: 'me' | 'everyone') => {
    const loadingToast = toast.loading(`Processing ${ids.length} messages...`);

    try {
      const result = await projectApi.bulkDeleteTaskComments(ids, type);
      
      // Cleanup
      toast.dismiss(loadingToast);
      setSelectedIds(new Set());
      setIsSelectMode(false);
      refresh();
      
      const { everyone_count, me_count, failed_count } = result;
      
      if (failed_count > 0) {
        toast.error(`${failed_count} message(s) could not be deleted. They might have been deleted already or you don't have permission.`);
      }

      if (everyone_count > 0 && me_count > 0) {
        toast.success(`${everyone_count} deleted for everyone, ${me_count} hidden for you`);
      } else if (everyone_count > 0) {
        toast.success(`${everyone_count} message(s) deleted for everyone`);
      } else if (me_count > 0) {
        toast.success(`${me_count} message(s) hidden for you`);
      } else if (failed_count === 0) {
        toast.success("Messages processed successfully");
      }
    } catch (err: unknown) {
      toast.dismiss(loadingToast);
      console.error("Bulk deletion error:", err);
      toast.error(getErrorMessage(err, "An error occurred during bulk deletion"));
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateChecklist = useMutation({
    mutationFn: ({ id, is_completed }: { id: number; is_completed: boolean }) =>
      projectApi.updateChecklist(id, { is_completed }),
    onSuccess: () => refresh(),
  });

  const addChecklist = useMutation({
    mutationFn: () => projectApi.addChecklist(taskId as string, { item: checklistItem }),
    onSuccess: () => {
      setChecklistItem("");
      refresh();
    },
  });

  const formatCommentDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isToday(date)) return `Today at ${format(date, "h:mm a")}`;
      if (isYesterday(date)) return `Yesterday at ${format(date, "h:mm a")}`;
      if (isThisYear(date)) return format(date, "MMM d 'at' h:mm a");
      return format(date, "MMM d, yyyy 'at' h:mm a");
    } catch (e) {
      return "Just now";
    }
  };

  const startReply = (comment: any) => {
    setParentId(comment.id);
    setReplyToName(comment.user?.name || "User");
    const input = document.getElementById("task-discussion-input");
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Converts stored HTML content into editable plain text
  const htmlToPlainText = (html: string): string => {
    if (typeof document === 'undefined') return html;
    const el = document.createElement('div');
    el.innerHTML = html;
    return (el.textContent || el.innerText || '').trim();
  };

  // TREE BUILDER: task.comments is already a nested tree (root only + replies).
  // We flatten it first, rebuild the tree to normalise any realtime-injected flat items,
  // then group by date for rendering.
  const groupedComments = React.useMemo(() => {
    if (!task?.comments) return [];

    // 1. Recursively flatten the nested tree into a plain list and filter hidden ones
    const flatList = flattenComments(task.comments).filter(c => {
      const hidden = c.hidden_for_user_ids || [];
      return !hidden.some((hId: any) => Number(hId) === Number(user?.id));
    });

    // 2. Sort chronologically
    const sorted = [...flatList].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // 3. Rebuild the tree via Map
    const commentMap = new Map<number, any>();
    const rootComments: any[] = [];

    sorted.forEach(c => {
      commentMap.set(c.id, { ...c, replies: [] });
    });

    sorted.forEach(c => {
      const node = commentMap.get(c.id)!;
      if (c.parent_id) {
        const parent = commentMap.get(c.parent_id);
        if (parent) {
          parent.replies.push(node);
        } else {
          rootComments.push(node); // orphan fallback
        }
      } else {
        rootComments.push(node);
      }
    });

    // 4. Group by Date
    const items: (any | { isDateDivider: true; date: string })[] = [];
    let lastDate: Date | null = null;

    rootComments.forEach(comment => {
      const currentDate = new Date(comment.created_at);
      if (!lastDate || !isSameDay(lastDate, currentDate)) {
        items.push({ isDateDivider: true, date: comment.created_at });
        lastDate = currentDate;
      }
      items.push(comment);
    });

    return items;
  }, [task?.comments, user?.id]);
  
  // Helper to get all visible IDs (for Select All)
  const visibleCommentIds = React.useMemo(() => {
    const ids: number[] = [];
    const extract = (items: any[]) => {
      items.forEach(item => {
        if (item.id) {
          ids.push(item.id);
          if (item.replies?.length) extract(item.replies);
        }
      });
    };
    extract(groupedComments);
    return ids;
  }, [groupedComments]);

  const renderFilePreview = (file: any) => {
    if (!file) return null;
    const mime = file.mime_type || '';
    const safeUrl = getStorageUrl(file.url);
    const mediaTitle = file.name || 'Attachment';

    if (mime.startsWith('image/')) {
      return (
        <div className="w-full aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-border/40 shadow-inner">
           <ImageViewer
             src={safeUrl}
             fetchUrl={file.url?.includes('/api/v1/files/') ? file.url : `${RuntimeContext.getBackendApiRoot()}/files/${(file as any).id}/download`}
             alt={mediaTitle}
           />
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/40 rounded-xl hover:bg-background transition-colors group/file">
        <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center border border-border/30">
          <FileIcon className="h-5 w-5 text-primary/70" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold truncate pr-2">{file.name}</p>
          <div className="flex items-center gap-2">
            <a 
              href={file.url || "#"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[9px] text-primary hover:underline flex items-center gap-0.5 font-bold uppercase tracking-wider"
            >
              <ExternalLink className="h-2.5 w-2.5" /> Download
            </a>
          </div>
        </div>
      </div>
    );
  };

  const renderComment = (comment: any, isReply = false, depth = 0) => {
    const isEditing = editingCommentId === comment.id;
    const canDelete = Number(user?.id) === Number(comment.user_id);
    const isSelected = selectedIds.has(comment.id);

    // Check if hidden for current user
    if (comment.hidden_for_user_ids && Array.isArray(comment.hidden_for_user_ids)) {
      if (comment.hidden_for_user_ids.some((id: any) => String(id) === String(user?.id))) {
        return null;
      }
    }

    return (
      <motion.div 
        key={comment.id} 
        id={`task-comment-${comment.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        layout
        onClick={() => isSelectMode && toggleSelectId(comment.id)}
        className={cn(
          "flex gap-3 sm:gap-4 group transition-colors rounded-xl",
          isReply ? "mt-4" : "mt-6",
          depth > 0 && depth < 4 ? "ml-6 sm:ml-12 border-l-2 pl-4 sm:pl-6 border-border/30" : "",
          depth >= 4 ? "ml-2 sm:ml-4 border-l-2 pl-3 sm:pl-4 border-border/30" : "",
          isSelectMode ? "cursor-pointer hover:bg-muted/30 px-2 -mx-2" : "",
          isSelectMode && isSelected ? "bg-destructive/5 ring-1 ring-destructive/30 px-2 -mx-2" : ""
        )}
      >
        {/* SELECT CHECKBOX */}
        {isSelectMode && (
          <div className="flex items-start pt-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelectId(comment.id)}
              className="h-4 w-4 rounded border-border data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
            />
          </div>
        )}
        <Avatar className={cn("shrink-0 ring-2 ring-background shadow-sm border border-border/50", isReply ? "w-8 h-8" : "w-10 h-10")}>
          <AvatarImage src={comment.user?.avatar_path || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">{comment.user?.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-1.5 min-w-0">
          {comment.parent_id && depth === 0 && (
            <button 
              onClick={() => {
                const element = document.getElementById(`task-comment-${comment.parent_id}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element?.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'rounded-xl');
                setTimeout(() => element?.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'rounded-xl'), 2000);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline mb-1 transition-all"
            >
              <Reply className="h-2.5 w-2.5 rotate-180" /> JUMP TO PARENT
            </button>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{comment.user?.name}</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {formatCommentDate(comment.created_at)}
              </span>
            </div>
            
            {!isSelectMode && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!comment.is_deleted_for_everyone && (
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-all" onClick={(e) => { e.stopPropagation(); startReply(comment); }}>
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted transition-all" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl border-border/50">
                  {canDelete && !comment.is_deleted_for_everyone && (
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { setEditingCommentId(comment.id); setEditContent(htmlToPlainText(comment.content)); }}>
                      <Pencil className="h-3.5 w-3.5" /> Edit message
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => {
                    setDeleteConfirm({
                      isOpen: true,
                      type: 'me',
                      ids: [comment.id],
                      title: "Delete message for me?",
                      description: "This will remove the message from your view only."
                    });
                  }}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete for me
                  </DropdownMenuItem>

                  {canDeleteForEveryone(comment) && !comment.is_deleted_for_everyone && (
                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2" onClick={() => {
                      setDeleteConfirm({
                        isOpen: true,
                        type: 'everyone',
                        ids: [comment.id],
                        title: "Delete message for everyone?",
                        description: "This will replace the message content with a deletion placeholder for all task members."
                      });
                    }}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete for everyone
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            )}
          </div>
          
          <div className="bg-muted/30 p-4 rounded-2xl rounded-tl-none border border-border/40 text-sm text-foreground/90 leading-relaxed inline-block group-hover:bg-muted/50 transition-colors w-full sm:w-auto min-w-[200px]">
            {isEditing ? (
              <div className="space-y-3 relative z-10">
                <Textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px] bg-background border-primary/20 text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-8 px-3 text-[10px] uppercase tracking-wider font-bold" onClick={() => updateComment.mutate({ id: comment.id, content: `<p>${editContent}</p>` })} disabled={updateComment.isPending || !editContent.trim()}>
                    {updateComment.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />} Save
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] uppercase tracking-wider font-bold" onClick={() => { setEditingCommentId(null); setEditContent(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className={cn("prose prose-sm dark:prose-invert max-w-none", comment.is_deleted_for_everyone && "italic text-muted-foreground opacity-70")}>
                {comment.is_deleted_for_everyone ? (
                  <div className="flex items-center gap-2 py-1">
                    <X className="h-3.5 w-3.5 opacity-50" />
                    <span>This message was deleted</span>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: comment.content }} />
                )}
              </div>
            )}
            
            {!comment.is_deleted_for_everyone && comment.attachments && comment.attachments.length > 0 && (
              <div className={cn("mt-4 grid gap-3", comment.attachments.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                {comment.attachments.map((file: any, idx: number) => (
                  <div key={idx} className="w-full">{renderFilePreview(file)}</div>
                ))}
              </div>
            )}
          </div>

          {comment.replies && comment.replies.length > 0 && (
            <div className="w-full mt-2">
              <AnimatePresence>
                {comment.replies.map((reply: any) => renderComment(reply, true, depth + 1))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] xl:max-w-[1400px] 2xl:max-w-[1600px] h-[90vh] p-0 bg-background border border-border/40 overflow-hidden flex flex-col rounded-2xl shadow-2xl">
          <DialogTitle className="sr-only">{t('project_management.task_details', 'Task Details')}</DialogTitle>
          
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/10 shrink-0">
            <h2 className="text-xl font-bold tracking-tight">{t('project_management.task_details', 'Task Details')}</h2>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t('project_management.task', 'Task')}</span><span>&gt;</span><span className="font-medium text-foreground">{t('project_management.task_details', 'Task Details')}</span>
            </div>
            <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading || !task ? (
              <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 p-4 sm:p-6 lg:p-8">
                
                <div className="xl:col-span-8 space-y-6">
                  <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                          <h3 className="text-lg sm:text-xl font-bold">{isEditMode ? t('project_management.edit_task', 'Edit Task') : t('project_management.task_summary', 'Task Summary')}</h3>
                        </div>
                        {!isEditMode && task && (
                          <div className="ml-0 sm:ml-4">
                            <TaskTimer task={task} />
                          </div>
                        )}
                      </div>
                      {!isEditMode ? (
                        <Button onClick={handleStartEdit} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto">
                          <Pencil className="w-4 h-4 mr-2" /> {t('project_management.edit_task', 'Edit Task')}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)} className="h-8">
                            {t('project_management.cancel', 'Cancel')}
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-emerald-500 hover:bg-emerald-600 h-8"
                            onClick={() => updateTaskMutation.mutate({
                              title: editTitle,
                              description: editDescription,
                              priority: editPriority,
                              due_date: editDueDate || null,
                              issue_type: isSoftwareDev ? editIssueType : undefined,
                              story_points: isSoftwareDev ? (editStoryPoints !== "" ? editStoryPoints : null) : undefined,
                              environment: isSoftwareDev ? (editEnvironment !== "none" ? editEnvironment : null) : undefined,
                              pr_url: isSoftwareDev ? (editPrUrl || null) : undefined,
                            })}
                            disabled={updateTaskMutation.isPending || !editTitle.trim()}
                          >
                            {updateTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />} {t('project_management.save_changes', 'Save Changes')}
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditMode ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('project_management.task_title', 'Task Title')}</Label>
                          <Input 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="text-lg font-bold bg-background/50"
                            placeholder={t('project_management.task_title_placeholder', 'Enter task title...')}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('project_management.task_description', 'Task Description')}</Label>
                          <RichTextEditor 
                            value={editDescription}
                            onChange={setEditDescription}
                            className="min-h-[200px] bg-background/50 leading-relaxed"
                            placeholder={t('project_management.task_description_placeholder', 'Describe the task in detail...')}
                            onOpenMediaPicker={() => setIsFileManagerOpen(true)}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('project_management.priority_level', 'Priority')}</Label>
                            <Select value={editPriority} onValueChange={setEditPriority}>
                              <SelectTrigger className="bg-background/50 h-10">
                                <SelectValue placeholder={t('project_management.select_priority', 'Select priority')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">{t('project_management.priority_low', 'Low')}</SelectItem>
                                <SelectItem value="medium">{t('project_management.priority_medium', 'Medium')}</SelectItem>
                                <SelectItem value="high">{t('project_management.priority_high', 'High')}</SelectItem>
                                <SelectItem value="urgent">{t('project_management.priority_urgent', 'Urgent')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('project_management.due_date', 'Due Date')}</Label>
                            <Input 
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              className="bg-background/50 h-10"
                            />
                          </div>
                        </div>

                         {isSoftwareDev && (
                          <div className="mt-8 space-y-6">
                            <div className="flex items-center gap-2 px-1">
                              <Cpu className="w-4 h-4 text-primary" />
                              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">{t('project_management.software_dev_details', 'Software Development Details')}</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-primary/[0.02] border border-primary/10 shadow-inner">
                              <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  <Terminal className="w-3.5 h-3.5" /> {t('project_management.issue_type', 'Issue Type')}
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(ISSUE_TYPE_CONFIG).map(([value, config]) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setEditIssueType(value)}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                                        editIssueType === value 
                                          ? `${config.bg} ${config.border} ${config.color} ring-2 ring-primary/20` 
                                          : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/30"
                                      )}
                                    >
                                      <config.icon className="w-3.5 h-3.5" />
                                      {config.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  <Zap className="w-3.5 h-3.5" /> {t('project_management.story_points', 'Story Points')}
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                  {STORY_POINTS.map((pts) => (
                                    <button
                                      key={pts}
                                      type="button"
                                      onClick={() => setEditStoryPoints(pts)}
                                      className={cn(
                                        "w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-bold transition-all",
                                        editStoryPoints === pts
                                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-110 z-10"
                                          : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/30"
                                      )}
                                    >
                                      {pts}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  <Globe className="w-3.5 h-3.5" /> {t('project_management.target_environment', 'Environment')}
                                </Label>
                                <div className="flex gap-2">
                                  {['none', 'development', 'staging', 'production'].map((env) => (
                                    <button
                                      key={env}
                                      type="button"
                                      onClick={() => setEditEnvironment(env)}
                                      className={cn(
                                        "flex-1 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-tight transition-all",
                                        editEnvironment === env
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 ring-2 ring-emerald-500/10"
                                          : "bg-background/50 border-border/50 text-muted-foreground hover:border-emerald-500/30"
                                      )}
                                    >
                                      {env}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  <Link className="w-3.5 h-3.5" /> {t('project_management.pr_reference', 'PR URL')}
                                </Label>
                                <div className="relative group">
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <ExternalLink className="w-4 h-4" />
                                  </div>
                                  <Input 
                                    value={editPrUrl}
                                    onChange={(e) => setEditPrUrl(e.target.value)}
                                    className="bg-background/50 h-11 pl-10 border-border/50 focus:border-primary/50 transition-all rounded-xl text-sm"
                                    placeholder="https://github.com/org/repo/pull/123"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-foreground">{task.title}</h1>
                        
                        <div className="space-y-3 mb-8">
                          <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t('project_management.task_description', 'Task Description')} :</h4>
                          <div className="text-foreground/90 text-sm sm:text-base leading-relaxed prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: task.description || t('project_management.no_description', "No description provided.") }} />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-border/50">
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">{t('project_management.assigned_by', 'Assigned By')}</p>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-8 h-8 ring-2 ring-background">
                                <AvatarImage src={task.creator?.avatar_path || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">{task.creator?.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-semibold truncate">{task.creator?.name}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">{t('project_management.assigned_date', 'Assigned Date')}</p>
                            <p className="text-sm font-semibold">{format(new Date(task.created_at), "dd MMM yyyy")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">{t('project_management.due_date', 'Due Date')}</p>
                            <p className="text-sm font-semibold">{task.due_date ? format(new Date(task.due_date), "dd MMM yyyy") : "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">{t('project_management.progress', 'Progress')}</p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${task.progress || 0}%` }}></div>
                              </div>
                              <span className="text-sm font-bold min-w-[3ch]">{task.progress || 0}%</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Task Discussions Component */}
                  <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-sm flex flex-col min-h-[600px]">
                    <div className="flex items-center justify-between gap-3 mb-8 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-primary rounded-full" />
                        <h3 className="text-lg sm:text-xl font-bold">{t('project_management.task_discussions', 'Task Discussions')}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelectMode && selectedIds.size > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 px-3 text-xs font-bold gap-1.5 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('project_management.delete_selected', 'Delete {count} selected').replace('{count}', selectedIds.size.toString())}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl">
                              <DropdownMenuItem 
                                className="cursor-pointer gap-2 py-2.5" 
                                onClick={() => deleteSelectedComments('me')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{t('project_management.delete_for_me', 'Delete for me')}</span>
                                <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t('project_management.all', 'All')}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2 py-2.5" 
                                onClick={() => deleteSelectedComments('everyone')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{t('project_management.delete_for_everyone', 'Delete for everyone')}</span>
                                <span className="ml-auto text-[10px] bg-destructive/10 px-1.5 py-0.5 rounded">{t('project_management.admin_yours', 'Admin / Yours')}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {isSelectMode && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 text-xs font-bold gap-1.5 rounded-lg hover:bg-primary/5 text-primary"
                            onClick={() => {
                              setSelectedIds(selectedIds.size === visibleCommentIds.length ? new Set() : new Set(visibleCommentIds));
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {selectedIds.size === visibleCommentIds.length ? t('project_management.deselect_all', 'Deselect All') : t('project_management.select_all', 'Select All')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isSelectMode ? "secondary" : "outline"}
                          className="h-8 px-3 text-xs font-bold gap-1.5 rounded-lg"
                          onClick={() => { 
                            setIsSelectMode(v => !v); 
                            setSelectedIds(new Set());
                            setParentId(null);
                            setReplyToName(null);
                            setEditingCommentId(null);
                          }}
                        >
                          <ListChecks className="h-3.5 w-3.5" />
                          {isSelectMode ? t('project_management.cancel', 'Cancel') : t('project_management.select', 'Select')}
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 mb-8 overflow-y-auto pr-2 custom-scrollbar" id="task-discussion-scroll">
                      {groupedComments.length > 0 ? (
                        groupedComments.map((item, idx) => {
                          if ('isDateDivider' in item) {
                            const dividerDate = new Date(item.date);
                            let label = format(dividerDate, "MMMM d, yyyy");
                            if (isToday(dividerDate)) label = "Today";
                            else if (isYesterday(dividerDate)) label = "Yesterday";

                            return (
                              <div key={`date-${item.date}`} className="flex items-center gap-4 py-4">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50">{label}</span>
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                              </div>
                            );
                          }
                          return <React.Fragment key={item.id}>{renderComment(item)}</React.Fragment>;
                        })
                      ) : (
                        <div className="text-center py-12 text-muted-foreground text-sm italic bg-muted/5 rounded-2xl border border-dashed border-border/50 h-full flex flex-col items-center justify-center">
                          <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-20" />
                          {t('project_management.no_comments_yet', 'No comments yet. Start the conversation!')}
                        </div>
                      )}
                      
                      {Object.keys(typingUsers).length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mt-4 ml-2">
                          <div className="flex -space-x-2">
                            {Object.keys(typingUsers).slice(0, 3).map(userId => (
                              <div key={userId} className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center">
                                <span className="text-[8px] font-bold text-primary">{typingUsers[userId].name.charAt(0)}</span>
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium italic">
                            {Object.values(typingUsers).length === 1 ? `${Object.values(typingUsers)[0].name} is typing...` : `${Object.values(typingUsers).length} people are typing...`}
                          </span>
                        </motion.div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {!isSelectMode && (
                    <div className="shrink-0" id="task-discussion-input">
                      {parentId && (
                        <div className="mb-4 flex items-center justify-between bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10 animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-primary/10 rounded-lg"><Reply className="h-3.5 w-3.5 text-primary" /></div>
                            <p className="text-xs font-bold">{t('project_management.replying_to', 'Replying to')} <span className="text-primary">{replyToName}</span></p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-primary/10" onClick={() => { setParentId(null); setReplyToName(null); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('project_management.add_to_conversation', 'Add to conversation')}</span>
                      </div>
                      
                      <DiscussionComposer 
                        key={parentId ? `reply-${parentId}` : "new-comment"}
                        onSend={async (content, atts) => {
                          await addComment.mutateAsync({ content, parent_id: parentId, attachments: atts });
                          setComposerAttachments([]);
                          setParentId(null);
                          setReplyToName("");
                          if (user) sendTyping(false, { id: user.id, name: user.name });
                          setTimeout(() => scrollToBottom(), 100);
                        }}
                        isSending={addComment.isPending}
                        onOpenFilePicker={() => {
                          setFilePickerContext('composer');
                          setIsFileManagerOpen(true);
                        }}
                        attachments={composerAttachments}
                        onRemoveAttachment={(idx) => setComposerAttachments(prev => prev.filter((_, i) => i !== idx))}
                        placeholder={parentId ? `Reply to ${replyToName}...` : "Write a comment..."}
                      />
                    </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN - 30% */}
                <div className="xl:col-span-4 space-y-6">
                  
                  {/* Additional Details */}
                  <div className="bg-card border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                      <h3 className="text-lg font-bold">{t('project_management.additional_details', 'Additional Details')}</h3>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/50 gap-1">
                        <span className="font-semibold text-muted-foreground">{t('project_management.task_id', 'Task ID')} :</span>
                        <span className="font-mono font-medium">SPK - {task?.id?.slice(0, 4).toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/50 gap-2 items-start sm:items-center">
                        <span className="font-semibold text-muted-foreground">{t('project_management.task_tags', 'Task Tags')} :</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(task.tags || ['UI/UX', 'Design']).map((tag: string, i: number) => (
                            <Badge key={i} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/50 gap-1">
                        <span className="font-semibold text-muted-foreground">{t('project_management.project_name', 'Project Name')} :</span>
                        <span className="font-semibold truncate max-w-[200px]" title={task?.project?.name}>{task?.project?.name}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/50 gap-1 sm:items-center">
                        <span className="font-semibold text-muted-foreground">{t('project_management.priority_level', 'Priority')} :</span>
                        <Badge 
                          variant="outline" 
                          className={`uppercase text-[10px] tracking-wider font-bold ${
                            task.priority === 'urgent' ? 'border-red-500 text-red-500' :
                            task.priority === 'high' ? 'border-orange-500 text-orange-500' :
                            task.priority === 'medium' ? 'border-yellow-500 text-yellow-600' :
                            'border-blue-500 text-blue-500'
                          }`}
                        >
                          {task?.priority}
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between py-3 gap-2 items-start sm:items-center">
                        <span className="font-semibold text-muted-foreground">{t('project_management.assigned_to', 'Assigned To')} :</span>
                        <div className="flex -space-x-2 overflow-hidden py-1">
                          {(task.assignees || []).length > 0 ? (
                            (task.assignees || []).map((assignee: any) => (
                              <Avatar key={assignee.id} className="w-8 h-8 border-2 border-background ring-1 ring-border/20 transition-transform hover:scale-110 hover:z-10" title={assignee.name}>
                                <AvatarImage src={assignee.avatar_path || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">{assignee.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t('project_management.unassigned', 'Unassigned')}</span>
                          )}
                        </div>
                      </div>

                      {isSoftwareDev && (
                        <div className="pt-4 mt-4 border-t border-border/30 space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Terminal className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t('project_management.software_context', 'Software Context')}</span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:justify-between py-1 gap-1 sm:items-center">
                            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                              Issue Type
                            </span>
                            {(() => {
                              const config = ISSUE_TYPE_CONFIG[task?.issue_type as keyof typeof ISSUE_TYPE_CONFIG] || ISSUE_TYPE_CONFIG.task;
                              return (
                                <Badge variant="outline" className={cn("capitalize text-[10px] font-bold flex items-center gap-1.5 px-2 py-0.5", config.bg, config.color, config.border)}>
                                  <config.icon className="w-3 h-3" />
                                  {config.label}
                                </Badge>
                              );
                            })()}
                          </div>

                          {task?.story_points && (
                            <div className="flex flex-col sm:flex-row sm:justify-between py-1 gap-1 sm:items-center">
                              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                                Story Points
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono text-xs bg-primary/10 text-primary border-primary/20">
                                  {task?.story_points} pts
                                </Badge>
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 5, 8].map((v, i) => (
                                    <div key={i} className={cn("w-1 h-3 rounded-full", v <= Number(task.story_points) ? "bg-primary" : "bg-muted")} />
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {task?.environment && task?.environment !== 'none' && (
                            <div className="flex flex-col sm:flex-row sm:justify-between py-1 gap-1 sm:items-center">
                              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                                Environment
                              </span>
                              <Badge variant="outline" className="capitalize text-[10px] font-bold border-emerald-500/50 text-emerald-600 bg-emerald-50 flex items-center gap-1">
                                <Server className="w-3 h-3" />
                                {task?.environment}
                              </Badge>
                            </div>
                          )}

                          {task?.pr_url && (
                            <div className="flex flex-col sm:flex-row sm:justify-between py-1 gap-1 sm:items-center">
                              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                                Pull Request
                              </span>
                              <a 
                                href={task?.pr_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all"
                              >
                                <span className="text-[10px] font-bold text-primary">View PR</span>
                                <ExternalLink className="h-3 w-3 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub Tasks */}
                  <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col max-h-[500px]">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                        <h3 className="text-lg font-bold">{t('project_management.sub_tasks', 'Sub Tasks')}</h3>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {task?.checklists?.filter(i => i.is_completed).length || 0}/{task?.checklists?.length || 0}
                      </Badge>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
                      <div className="space-y-2">
                        {(task?.checklists || []).map((item) => (
                          <div key={item.id} className="flex items-start gap-3 group hover:bg-muted/40 p-2 rounded-xl transition-colors">
                            <Checkbox 
                              checked={item.is_completed}
                              onCheckedChange={(c) => updateChecklist.mutate({ id: item.id, is_completed: Boolean(c) })}
                              className="mt-1 w-5 h-5 rounded-md border-muted-foreground/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shrink-0"
                            />
                            <span className={`text-sm leading-snug flex-1 pt-0.5 transition-all ${item.is_completed ? "line-through text-muted-foreground/60" : "font-medium"}`}>
                              {item.item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-border/50 shrink-0">
                      <div className="flex gap-2 bg-muted/20 p-1.5 rounded-xl border focus-within:border-primary/50 transition-colors">
                        <Input 
                          value={checklistItem} 
                          onChange={(e) => setChecklistItem(e.target.value)} 
                          placeholder={t('project_management.add_new_sub_task', 'Add new sub-task...')} 
                          className="h-9 border-none bg-transparent focus-visible:ring-0 px-3 text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && checklistItem.trim() && addChecklist.mutate()}
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-primary hover:bg-primary/10" onClick={() => { if(checklistItem.trim()) addChecklist.mutate(); }} disabled={!checklistItem.trim() || addChecklist.isPending}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="bg-card border rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                        <h3 className="text-lg font-bold">{t('project_management.attachments', 'Attachments')}</h3>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg" onClick={() => {
                        setFilePickerContext('attachments');
                        setIsFileManagerOpen(true);
                      }}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> {t('project_management.add', 'Add')}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {attachments && attachments.length > 0 ? (
                        attachments.map((file, i) => (
                          <div key={i} className="flex flex-col gap-2 p-3 border rounded-xl bg-muted/5 hover:bg-muted/20 transition-colors group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="bg-background border p-2.5 rounded-xl shrink-0 text-primary">
                                  <FileIcon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate text-foreground/90">{file.file_entry?.name || file.name || 'Document'}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {file.status && (
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-[8px] h-4 px-1.5 font-black uppercase tracking-tighter",
                                          file.status === 'approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                          file.status === 'rejected' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                          "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        )}
                                      >
                                        {file.status}
                                      </Badge>
                                    )}
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">
                                      {file.user?.name || (file.path ? 'Manual Upload' : '')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setPreviewFile(file)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
                                  <a href={file.file_entry?.url || file.url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                                </Button>
                                
                                {file.id && file.status === 'pending' && ((Number(user?.id) === Number(task?.project?.project_manager_id)) || (Number(user?.id) === Number(task?.project?.created_by))) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem 
                                        className="text-emerald-500"
                                        onClick={() => reviewMutation.mutate({ id: file.id, status: 'approved' })}
                                      >
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="text-rose-500"
                                        onClick={() => {
                                          const note = prompt("Reason for rejection?");
                                          if (note !== null) {
                                            reviewMutation.mutate({ id: file.id, status: 'rejected', review_note: note });
                                          }
                                        }}
                                      >
                                        <X className="w-4 h-4 mr-2" /> Reject
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}

                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => {
                                  const newAttachments = attachments.filter((_, idx) => idx !== i);
                                  updateTaskMutation.mutate({ attachments: newAttachments });
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {file.review_note && (
                              <div className="mt-2 p-2 bg-background/50 rounded-lg border border-border/30 text-[11px] text-muted-foreground italic">
                                <strong>Review Note:</strong> {file.review_note}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center bg-muted/20 border border-dashed rounded-xl">
                          <Paperclip className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground font-medium">No attachments yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time Tracking History */}
                  <div className="bg-card border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                        <h3 className="text-lg font-bold">{t('project_management.time_tracking', 'Time Tracking')}</h3>
                      </div>
                      <Badge variant="outline" className="bg-primary/5 text-primary">
                        {timeLogs?.length || 0} logs
                      </Badge>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {timeLogs && timeLogs.length > 0 ? (
                        timeLogs.map((log) => (
                          <div key={log.id} className="p-4 rounded-xl bg-muted/30 border border-border/40 group relative">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={log.user?.avatar_path || undefined} />
                                  <AvatarFallback className="text-[8px]">{log.user?.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-[11px] font-bold">{log.user?.name}</span>
                              </div>
                              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                {log.duration_minutes ? `${log.duration_minutes}m` : "Active"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.started_at), "MMM d, HH:mm")}
                              {log.ended_at && ` - ${format(new Date(log.ended_at), "HH:mm")}`}
                            </div>
                            {log.note && (
                              <p className="mt-2 text-xs text-foreground/80 italic">"{log.note}"</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 rounded-xl border border-dashed border-border/60">
                          <HistoryIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('project_management.no_logs_yet', 'No logs yet')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
        <DialogContent className="sm:max-w-[1000px] h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-4 bg-muted/20">
            <DialogTitle className="font-bold tracking-tight text-lg">Select Task Files</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsFileManagerOpen(false)} className="rounded-full h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <FileManagerClient 
              isPickerMode={true}
              onFileSelect={(file: any) => {
                if (filePickerContext === 'composer') {
                  setComposerAttachments(prev => [...prev, file]);
                } else {
                  // For task attachments, we need to sync with the backend
                  const path = file?.media_details?.relative_path || file?.path;
                  const name = file?.media_details?.original_name || file?.name || path?.split("/").pop() || "Unnamed File";
                  const url = file?.media_details?.url || file?.url;

                  if (path) {
                    const newAttachment = { 
                      id: file.id, // Important for the backend
                      file_id: file.id, 
                      path, 
                      name, 
                      url 
                    };
                    const currentAttachments = task?.attachments || [];
                    
                    if (!currentAttachments.some((a: any) => a.path === path)) {
                      updateTaskMutation.mutate({
                        attachments: [...currentAttachments, newAttachment]
                      });
                    } else {
                      toast.error("File already attached to this task");
                    }
                  }
                }
                setIsFileManagerOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl overflow-hidden p-0">
          <div className="bg-destructive/10 p-6 flex flex-col items-center gap-4 text-center border-b border-destructive/10">
            <div className="h-12 w-12 rounded-2xl bg-destructive/20 flex items-center justify-center text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogHeader className="p-0">
              <AlertDialogTitle className="text-xl font-bold tracking-tight">{deleteConfirm.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground font-medium">
                {deleteConfirm.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 bg-muted/20 flex sm:justify-center gap-3">
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-6">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteConfirm.ids.length > 1 || (deleteConfirm.ids.length === 1 && deleteConfirm.type === 'me')) {
                  executeBulkDelete(deleteConfirm.ids, deleteConfirm.type);
                } else {
                  deleteComment.mutate({ id: deleteConfirm.ids[0], type: deleteConfirm.type });
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-lg shadow-destructive/20"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50">
          <DialogTitle className="sr-only">File Preview</DialogTitle>
          <div className="flex flex-col h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
                  <FileIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate text-foreground">
                    {previewFile?.file_entry?.name || previewFile?.name || 'File Preview'}
                  </h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                    {previewFile?.file_entry?.mime_type || 'DOCUMENT'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPreviewFile(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-auto bg-black/5 flex items-center justify-center p-4">
              {(() => {
                if (!previewFile) return null;
                const file = previewFile.file_entry || previewFile;
                const mime = file.mime_type || '';
                const url = file.url || previewFile.url;
                const safeUrl = url?.startsWith('http') ? url : `${RuntimeContext.getBackendApiRoot()}/storage/${url}`;

                if (mime.startsWith('image/')) {
                  return (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageViewer src={safeUrl} alt={file.name} className="max-h-full max-w-full object-contain shadow-2xl rounded-lg" />
                    </div>
                  );
                }

                if (mime.startsWith('video/')) {
                  return (
                    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-border/30 bg-black">
                      <VideoPlayer src={RuntimeContext.getStreamUrl(safeUrl)} />
                    </div>
                  );
                }

                if (mime.startsWith('audio/')) {
                  return (
                    <div className="w-full max-w-xl p-8 bg-background/50 backdrop-blur-md rounded-3xl border border-border/30 shadow-2xl">
                      <AudioPlayer src={RuntimeContext.getStreamUrl(safeUrl)} title={file.name} />
                    </div>
                  );
                }

                if (mime === 'application/pdf') {
                  return <PdfViewer src={safeUrl} className="w-full h-full rounded-lg" />;
                }

                if (mime.includes('word') || mime.includes('excel') || mime.includes('officedocument')) {
                  return <DocumentViewer url={safeUrl} className="w-full h-full rounded-lg" />;
                }

                return (
                  <div className="text-center p-12 bg-background/50 backdrop-blur-md rounded-3xl border border-dashed border-border/50 max-w-md w-full">
                    <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-primary">
                      <FileIcon className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">No Preview Available</h3>
                    <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                      This file format cannot be previewed directly. Please download the file to view its contents.
                    </p>
                    <Button variant="default" className="rounded-2xl h-12 px-8 font-bold shadow-lg shadow-primary/20" asChild>
                      <a href={safeUrl} target="_blank" rel="noreferrer">Download File</a>
                    </Button>
                  </div>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}