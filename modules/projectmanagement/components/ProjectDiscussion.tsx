"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday, isThisYear, isSameDay } from "date-fns";
import { 
  MessageSquare, Send, Paperclip, FileIcon, X, Loader2, Reply, Trash2,
  MoreVertical, Download, ExternalLink, History, Pencil, CheckCircle2,
  Smile, Maximize2, Minimize2, LockKeyhole, Layers, ListChecks,
  AlertTriangle
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import EmojiPicker from "emoji-picker-react";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { ImageViewer } from "@/components/ui/image-viewer";
import { VideoPlayer } from "@/components/ui/video-player";
import { AudioPlayer } from "@/components/ui/audio-player";
import { PdfViewer } from "@/components/ui/pdf-viewer";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Model3DViewer } from "@/components/ui/model-3d-viewer";
import { getStreamUrl, getBackendStorageUrl, getBackendApiRoot } from "@/lib/runtime-context";
import { projectApi } from "../api";
import { ProjectComment, ProjectAttachment } from "../types";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DiscussionComposer } from "./discussion/DiscussionComposer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProjectManagementRealtime } from "../hooks/use-project-management-realtime";
import { useUser } from "@/hooks/use-user";
import { useTranslation } from "@/store/use-translation";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface ProjectDiscussionProps {
  projectId: string;
}

const getStorageUrl = (url: string | null | undefined) => {
  return getBackendStorageUrl(url) || '';
};

export function ProjectDiscussion({ projectId }: ProjectDiscussionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [parentId, setParentId] = React.useState<number | null>(null);
  const [replyToName, setReplyToName] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<ProjectAttachment[]>([]);
  const [isFileManagerOpen, setIsFileManagerOpen] = React.useState(false);
  const [editingCommentId, setEditingCommentId] = React.useState<number | null>(null);
  const [editContent, setEditContent] = React.useState("");
  const [isFullScreen, setIsFullScreen] = React.useState(false);
  const [isFetchingPrevious, setIsFetchingPrevious] = React.useState(false);
  const [isSelectMode, setIsSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
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

  const { user } = useUser();
  const { typingUsers, sendTyping } = useProjectManagementRealtime({ 
    projectId,
    onCommentCreated: (payload: any) => {
      queryClient.setQueryData(["project-comments", projectId], (oldData: any) => {
        if (!oldData) return oldData;
        const newPages = [...oldData.pages];
        if (newPages.length > 0) {
          const allComments = newPages.flatMap(p => p.data || []);
          if (allComments.some(c => c.id === payload.comment.id)) return oldData;
          
          newPages[0] = {
            ...newPages[0],
            data: [payload.comment, ...newPages[0].data]
          };
        }
        return { ...oldData, pages: newPages };
      });
      setIsAtBottom(true);
      setTimeout(() => scrollToBottom("smooth"), 100);
    },
    onCommentUpdated: (payload: any) => {
      queryClient.setQueryData(["project-comments", projectId], (oldData: any) => {
        if (!oldData) return oldData;
        
        const updatedComment = payload.comment;
        // Check if comment is now hidden for current user or deleted for everyone
        const isHiddenForMe = updatedComment.hidden_for_user_ids?.some((id: any) => Number(id) === Number(user?.id));
        const isDeletedForEveryone = updatedComment.is_deleted_for_everyone;

        const deepUpdate = (comments: any[]): any[] => {
          return comments.reduce((acc: any[], c) => {
            if (Number(c.id) === Number(updatedComment.id)) {
              // If it should be hidden or hard removed, don't include it
              if (isHiddenForMe) return acc;
              acc.push({ ...updatedComment, replies: c.replies || [] });
            } else {
              acc.push({ ...c, replies: c.replies ? deepUpdate(c.replies) : [] });
            }
            return acc;
          }, []);
        };
        
        const newPages = oldData.pages.map((page: any) => ({
          ...page,
          data: deepUpdate(page.data || [])
        }));
        return { ...oldData, pages: newPages };
      });
    },
    onCommentDeleted: (payload: any) => {
      queryClient.setQueryData(["project-comments", projectId], (oldData: any) => {
        if (!oldData) return oldData;
        
        const deepFilter = (comments: any[]): any[] => {
          return comments
            .filter(c => Number(c.id) !== Number(payload.comment_id))
            .map(c => {
              if (c.replies) return { ...c, replies: deepFilter(c.replies) };
              return c;
            });
        };
        
        const newPages = oldData.pages.map((page: any) => ({
          ...page,
          data: deepFilter(page.data || [])
        }));
        return { ...oldData, pages: newPages };
      });
    }
  });

  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectApi.getProject(projectId),
  });

  const { 
    data, 
    isLoading, 
    isError, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ["project-comments", projectId],
    queryFn: ({ pageParam = 1 }) => projectApi.getProjectComments(projectId, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.current_page < lastPage.last_page) {
        return lastPage.current_page + 1;
      }
      return undefined;
    },
  });

  const canDeleteForEveryone = (comment: any) => {
    if (!comment || !user || !project) return false;
    const isOwner = Number(comment.user_id) === Number(user.id);
    const isManager = Number(project.project_manager_id) === Number(user.id);
    const isProjectCreator = Number(project.created_by) === Number(user.id);
    return isOwner || isManager || isProjectCreator;
  };

  const safeComments = React.useMemo(() => {
    if (!data?.pages || !Array.isArray(data.pages)) return [];
    
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
    
    const allFlat = flattenComments(data.pages.flatMap(page => page?.data || []));
    // Filter out hidden comments for current user
    return allFlat.filter(c => {
      const hidden = c.hidden_for_user_ids || [];
      return !hidden.some((hId: any) => Number(hId) === Number(user?.id));
    });
  }, [data, user?.id]);

  const visibleCommentIds = React.useMemo(() => {
    return Array.from(new Set(safeComments.map(c => Number(c.id))));
  }, [safeComments]);

  // THE ADVANCED TREE BUILDER
  const groupedItems = React.useMemo(() => {
    if (safeComments.length === 0) return [];

    const commentMap = new Map();
    const rootComments: any[] = [];

    const sorted = [...safeComments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sorted.forEach(c => {
      commentMap.set(Number(c.id), { ...c, replies: [] });
    });

    sorted.forEach(c => {
      const commentNode = commentMap.get(Number(c.id));
      if (c.parent_id) {
        const parentNode = commentMap.get(Number(c.parent_id));
        if (parentNode) {
          parentNode.replies.push(commentNode);
        } else {
          rootComments.push(commentNode); 
        }
      } else {
        rootComments.push(commentNode);
      }
    });

    const items: (any | { isDateDivider: true; date: string })[] = [];
    let lastDate: Date | null = null;

    rootComments.forEach((comment) => {
      const currentDate = new Date(comment.created_at);
      if (!lastDate || !isSameDay(lastDate, currentDate)) {
        items.push({ isDateDivider: true, date: comment.created_at });
        lastDate = currentDate;
      }
      items.push(comment);
    });

    return items;
  }, [safeComments]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
    }
    setShowScrollButton(false);
  };

  React.useEffect(() => {
    if (isAtBottom && !isFetchingPrevious) {
      scrollToBottom("smooth");
    } else if (!isAtBottom && !isFetchingPrevious) {
      setShowScrollButton(true);
    }
    
    if (isFetchingPrevious && scrollRef.current) {
      const viewport = scrollRef.current;
      const newScrollHeight = viewport.scrollHeight;
      const prevHeight = viewport.dataset.prevHeight ? parseInt(viewport.dataset.prevHeight) : 0;
      const scrollDiff = newScrollHeight - prevHeight;
      
      if (scrollDiff > 0) {
        viewport.scrollTop += scrollDiff;
      }
      setIsFetchingPrevious(false);
    }
  }, [groupedItems, isAtBottom, isFetchingPrevious, isFullScreen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 50;
    setIsAtBottom(isBottom);
    if (isBottom) setShowScrollButton(false);
    target.dataset.prevHeight = target.scrollHeight.toString();
  };

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullScreen]);

  React.useEffect(() => {
    document.body.style.overflow = isFullScreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullScreen]);

  const addComment = useMutation({
    mutationFn: async (payload: { content: string; parent_id?: number | null; attachments?: any[] | null }) => {
      return await projectApi.addProjectComment(projectId, payload);
    },
    onSuccess: () => {
      setParentId(null);
      setReplyToName(null);
      setAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
      toast.success(t("project_management.message_posted", "Message posted"));
      setIsAtBottom(true);
      setTimeout(() => scrollToBottom("smooth"), 150);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("project_management.failed_to_post_message", "Failed to post message"));
    }
  });

  const updateComment = useMutation({
    mutationFn: (data: { id: number; content: string }) =>
      projectApi.updateProjectComment(data.id, { content: data.content }),
    onSuccess: () => {
      setEditingCommentId(null);
      setEditContent("");
      queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
      toast.success(t("project_management.message_updated", "Message updated"));
    },
  });

  const deleteComment = useMutation({
    mutationFn: (data: { id: number; type: 'me' | 'everyone' }) => projectApi.deleteProjectComment(data.id, data.type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
      toast.success(variables.type === 'me' ? "Message hidden for you" : "Message deleted for everyone");
    },
  });

  const deleteSelectedComments = async (type: 'me' | 'everyone' = 'me') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (type === 'everyone') {
      const deletableForEveryoneCount = ids.filter(id => {
        const comment = safeComments.find(c => Number(c.id) === Number(id));
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
        : t("project_management.delete_permission_warning", "You only have permission to delete {x} of the selected messages for everyone. The remaining {y} will only be hidden for you.", { x: deletableForEveryoneCount, y: ids.length - deletableForEveryoneCount });

      setDeleteConfirm({
        isOpen: true,
        type: 'everyone',
        ids,
        title: confirmTitle,
        description: confirmDescription
      });
      return;
    }

    // For 'me' type bulk delete, we can just do it or show a simpler confirm
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
      const result = await projectApi.bulkDeleteProjectComments(ids, type);
      
      toast.dismiss(loadingToast);
      setSelectedIds(new Set());
      setIsSelectMode(false);
      queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
      
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

  const toggleSelectId = (id: any) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const numId = Number(id);
      if (isNaN(numId)) return prev;
      if (next.has(numId)) {
        next.delete(numId);
      } else {
        next.add(numId);
      }
      return next;
    });
  };

  const handleFileSelect = (file: any) => {
    const newAttachment: ProjectAttachment = {
      path: file.path || file.media_details?.relative_path,
      name: file.name || file.media_details?.original_name,
      url: file.url || file.media_details?.url,
      mime_type: file.media_details?.mime_type || file.mime_type,
      media_details: file.media_details
    };
    setAttachments(prev => [...prev, newAttachment]);
    setIsFileManagerOpen(false);
  };

  const startReply = (comment: ProjectComment) => {
    setParentId(comment.id);
    setReplyToName(comment.user?.name || "User");
    const input = document.getElementById("project-discussion-input");
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Converts stored HTML content into editable plain text
  const htmlToPlainText = (html: string): string => {
    if (typeof document === 'undefined') return html;
    const el = document.createElement('div');
    el.innerHTML = html;
    return (el.textContent || el.innerText || '').trim();
  };

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

  const renderFilePreview = (file: ProjectAttachment) => {
    if (!file) return null;
    const mime = file.mime_type || '';
    const safeUrl = getStorageUrl(file.url);
    const mediaTitle = file.name || 'Attachment';

    if (mime.startsWith('image/')) {
      return (
        <div className="w-full aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-border/40 shadow-inner group-hover/file:shadow-md transition-all">
           <ImageViewer src={safeUrl} fetchUrl={file.url?.includes('/api/v1/files/') ? file.url : `${getBackendApiRoot()}/files/${(file as any).id}/download`} alt={mediaTitle} />
        </div>
      );
    }
    
    if (mime.startsWith('video/')) {
      return (
        <div className="flex aspect-video w-full items-center justify-center bg-black rounded-2xl border border-border/50 overflow-hidden shadow-inner relative">
          <VideoPlayer src={safeUrl} nativeSrc={safeUrl} className="w-full h-full" title={mediaTitle} authToken={typeof window !== 'undefined' ? localStorage.getItem('hive_token') : null} />
        </div>
      );
    }

    if (mime === 'application/pdf') {
      return (
        <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden border border-border/50 shadow-inner">
          <PdfViewer src={getStreamUrl(safeUrl)} title={mediaTitle} />
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
          <a href={file.url || "#"} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline flex items-center gap-0.5 font-bold uppercase tracking-wider">
            <ExternalLink className="h-2.5 w-2.5" /> Download
          </a>
        </div>
      </div>
    );
  };

  // INFINITE RECURSIVE RENDERER
  const renderComment = (comment: any, isReply = false, depth = 0) => {
    const isEditing = Number(editingCommentId) === Number(comment.id);
    const canDelete = Number(user?.id) === Number(comment.user_id);
    const isSelected = selectedIds.has(Number(comment.id));
    
    // Check if hidden for current user
    if (comment.hidden_for_user_ids && Array.isArray(comment.hidden_for_user_ids)) {
      if (comment.hidden_for_user_ids.some((id: any) => Number(id) === Number(user?.id))) {
        return null;
      }
    }

    return (
      <motion.div 
        key={comment.id} 
        id={`project-comment-${comment.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        layout
        onClick={() => isSelectMode && toggleSelectId(comment.id)}
        className={cn(
          "flex gap-3 sm:gap-4 group relative transition-all duration-200",
          isReply ? "mt-4" : "mt-6",
          depth > 0 && depth < 4 ? "ml-2 sm:ml-12 border-l-2 pl-2 sm:pl-6 border-border/30" : "",
          depth >= 4 ? "ml-1 sm:ml-4 border-l-2 pl-2 sm:pl-4 border-border/30" : "",
          isSelectMode && "cursor-pointer hover:bg-muted/30 px-2 -mx-2 rounded-xl",
          isSelectMode && isSelected && "bg-destructive/5 ring-1 ring-destructive/30 px-2 -mx-2 rounded-xl"
        )}
      >
        {isSelectMode && (
          <div className="shrink-0 pt-2" onClick={(e) => { e.stopPropagation(); toggleSelectId(comment.id); }}>
            <Checkbox 
              checked={isSelected} 
              onCheckedChange={() => {}} // toggleSelectId is called by the parent div's onClick
              className="h-5 w-5 rounded-md border-border data-[state=checked]:bg-destructive data-[state=checked]:border-destructive pointer-events-none"
            />
          </div>
        )}
        <Avatar className={cn("shrink-0 ring-2 ring-background border border-border/50", isReply ? "w-8 h-8" : "w-10 h-10")}>
          <AvatarImage src={comment.user?.avatar_path || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{comment.user?.name?.charAt(0) || "U"}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-1.5 min-w-0 w-full">
          {comment.parent_id && depth === 0 && (
            <button 
              onClick={() => {
                const element = document.getElementById(`project-comment-${comment.parent_id}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element?.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'rounded-xl');
                setTimeout(() => element?.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'rounded-xl'), 2000);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline mb-1 transition-all"
            >
              <Reply className="h-2.5 w-2.5 rotate-180" /> JUMP TO PARENT
            </button>
          )}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{comment.user?.name}</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{formatCommentDate(comment.created_at)}</span>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!comment.is_deleted_for_everyone && !isSelectMode && (
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-all" onClick={(e) => { e.stopPropagation(); startReply(comment); }}>
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {!isSelectMode && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted transition-all">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 backdrop-blur-md">
                    {!comment.is_deleted_for_everyone && (Number(user?.id) === Number(comment.user_id)) && (
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { setEditingCommentId(comment.id); setEditContent(htmlToPlainText(comment.content)); }}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
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
                          description: "This will replace the message content with a deletion placeholder for all project members."
                        });
                      }}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete for everyone
                      </DropdownMenuItem>
                    )}
                    <Separator className="my-1" />
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { setIsSelectMode(true); setSelectedIds(new Set([Number(comment.id)])); }}>
                      <ListChecks className="h-3.5 w-3.5" /> Select messages
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          <div className={cn(
            "bg-muted/30 border border-border/30 p-4 rounded-2xl rounded-tl-none shadow-sm backdrop-blur-sm relative overflow-hidden group-hover:bg-muted/40 transition-colors inline-block w-full sm:w-auto min-w-[200px]",
            comment.is_deleted_for_everyone && "bg-muted/10 opacity-60"
          )}>
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
                    {updateComment.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />} Save Changes
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] uppercase tracking-wider font-bold" onClick={() => { setEditingCommentId(null); setEditContent(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className={cn("prose prose-sm dark:prose-invert max-w-none break-words relative z-10", comment.is_deleted_for_everyone && "italic text-muted-foreground opacity-70")}>
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
              <div className={cn("mt-4 grid gap-3 relative z-10", comment.attachments.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                {comment.attachments.map((file: any, idx: number) => (
                  <div key={idx} className="w-full">{renderFilePreview(file)}</div>
                ))}
              </div>
            )}
          </div>

          {/* INFINITE RECURSION */}
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

  const discussionContent = (
    <motion.div 
      layout
      initial={false}
      className={cn(
        "flex flex-col bg-background border border-border/40 overflow-hidden shadow-2xl transition-all duration-300 ease-in-out",
        isFullScreen ? "fixed inset-0 z-[99999] h-screen w-screen rounded-none" : "h-[500px] sm:h-[600px] lg:h-[700px] max-h-[85vh] rounded-3xl"
      )}
    >
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border/40 bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold tracking-tight">{t("project_management.project_discussion", "Project Discussion")}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{t("project_management.team_collaboration", "Team Collaboration")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSelectMode && selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 px-3 text-xs font-bold gap-1.5 rounded-lg shadow-lg shadow-destructive/20 animate-in fade-in slide-in-from-right-4"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("project_management.delete_selected", "Delete {count} selected", { count: selectedIds.size })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/50 backdrop-blur-md">
                <DropdownMenuItem 
                  className="cursor-pointer gap-2 py-2.5" 
                  onClick={() => deleteSelectedComments('me')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete for me</span>
                  <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">All</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2 py-2.5" 
                  onClick={() => deleteSelectedComments('everyone')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete for everyone</span>
                  <span className="ml-auto text-[10px] bg-destructive/10 px-1.5 py-0.5 rounded">Admin / Yours</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-9 px-4 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest gap-2",
              isSelectMode ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-primary/10 hover:text-primary"
            )}
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds(new Set());
            }}
          >
            {isSelectMode ? <X className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
            {isSelectMode ? t("project_management.cancel_select", "Cancel Select") : t("project_management.select", "Select")}
          </Button>

          {isSelectMode && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest border-primary/20 hover:bg-primary/5 transition-all gap-2"
              onClick={() => {
                if (selectedIds.size === visibleCommentIds.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(visibleCommentIds));
                }
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {selectedIds.size === visibleCommentIds.length ? t("project_management.deselect_all", "Deselect All") : t("project_management.select_all", "Select All")}
            </Button>
          )}

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" onClick={() => setIsFullScreen(!isFullScreen)}>
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div 
          ref={scrollRef}
          className="h-full px-6 overflow-y-auto custom-scrollbar scroll-smooth"
          onScroll={handleScroll}
        >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <span className="text-sm font-medium animate-pulse">Loading discussion...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <X className="h-8 w-8 text-destructive" />
            </div>
            <h4 className="font-bold text-foreground/80">Failed to load messages</h4>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] })}>{t("project_management.retry_loading", "Retry")}</Button>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <h4 className="font-bold text-foreground/80">No messages yet</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Start the conversation by sending the first message.</p>
          </div>
        ) : (
          <div className="py-6 space-y-4 flex flex-col justify-end min-h-full">
            {hasNextPage && (
              <div className="flex justify-center pb-4">
                <Button variant="outline" size="sm" onClick={() => { setIsFetchingPrevious(true); fetchNextPage(); }} disabled={isFetchingNextPage} className="rounded-full gap-2 text-[10px] uppercase tracking-wider font-bold h-8 px-4 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all shadow-sm">
                  {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />} Load Previous Messages
                </Button>
              </div>
            )}

            <AnimatePresence initial={false}>
              {groupedItems.map((item, idx) => {
                if ('isDateDivider' in item) {
                  const dividerDate = new Date(item.date);
                  let label = format(dividerDate, "MMMM d, yyyy");
                  if (isToday(dividerDate)) label = t("project_management.today", "Today");
                  else if (isYesterday(dividerDate)) label = t("project_management.yesterday", "Yesterday");

                  return (
                    <motion.div key={`date-${item.date}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 py-4">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50">{label}</span>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    </motion.div>
                  );
                }
                return renderComment(item);
              })}
            </AnimatePresence>
            
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
        )}
        </div>

        <AnimatePresence>
          {showScrollButton && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
              <Button variant="secondary" size="sm" className="rounded-full shadow-lg border border-border/40 bg-background/80 backdrop-blur-md gap-2 font-bold text-[10px] uppercase tracking-wider" onClick={() => scrollToBottom()}>
                New Messages <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className={cn("p-4 border-t border-border/40 bg-card/80 backdrop-blur-sm transition-all shrink-0", isFullScreen ? "max-w-4xl mx-auto w-full rounded-t-3xl border-x shadow-2xl" : "")} id="project-discussion-input">
        {parentId && (
          <div className="mb-4 flex items-center justify-between bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10 animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/10 rounded-lg"><Reply className="h-3.5 w-3.5 text-primary" /></div>
              <p className="text-xs font-bold">Replying to <span className="text-primary">{replyToName}</span></p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-primary/10" onClick={() => { setParentId(null); setReplyToName(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("project_management.add_to_conversation", "Add to conversation")}</span>
        </div>

        <DiscussionComposer 
          key={parentId ? `reply-${parentId}` : "new-comment"}
          onSend={async (content, atts) => {
            await addComment.mutateAsync({ content, parent_id: parentId, attachments: atts.length > 0 ? atts : null });
            if (user) sendTyping(false, { id: user.id, name: user.name });
          }}
          isSending={addComment.isPending}
          onOpenFilePicker={() => setIsFileManagerOpen(true)}
          attachments={attachments}
          onRemoveAttachment={(idx) => setAttachments(prev => prev.filter((_, i) => i !== idx))}
          placeholder={parentId ? `Reply to ${replyToName}...` : "Write a professional message..." }
        />
      </div>

      <Dialog open={isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
        <DialogContent className="sm:max-w-[1000px] h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-2xl z-[10000]">
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-4 bg-muted/20">
            <DialogTitle className="font-bold tracking-tight text-lg">{t("project_management.select_project_files", "Select Project Files")}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsFileManagerOpen(false)} className="rounded-full h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <FileManagerClient isPickerMode={true} onFileSelect={(file: any) => { setAttachments(prev => [...prev, file]); setIsFileManagerOpen(false); }} />
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
    </motion.div>
  );

  if (isFullScreen && typeof document !== 'undefined') {
    return createPortal(discussionContent, document.body);
  }

  return discussionContent;
}
