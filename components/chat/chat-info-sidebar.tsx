"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';
import { 
  X, Phone, Video, 
  FileText, Image as ImageIcon, Link as LinkIcon,
  Users, Bell, Search,
  Download, ExternalLink, ChevronRight,
  Trash2, ShieldAlert, Ban, LogOut, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';
import { toast } from 'sonner';

type SharedImage = {
  url?: string;
  thumbnail?: string;
};

type SharedFile = {
  name?: string;
  size?: number;
  type?: string;
  url?: string;
};

type SharedLink = {
  title?: string;
  url?: string;
};

type SharedItems = {
  images: SharedImage[];
  files: SharedFile[];
  links: SharedLink[];
};

export default function ChatInfoSidebar() {
  const { activeConversationId, conversations, setInfoSidebarOpen, deleteConversation, setActiveConversation } = useChatStore();
  const [sharedItems, setSharedItems] = useState<SharedItems>({ images: [], files: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  
  const conversation = conversations.find(c => c.id === activeConversationId);

  const fetchSharedItems = useCallback(async () => {
    if (!activeConversationId) return;

    setIsLoading(true);
    try {
      const { data } = await api.get(`/chat/conversations/${activeConversationId}/shared`);
      setSharedItems({
        images: data.images || [],
        files: data.files || [],
        links: data.links || []
      });
    } catch (err) {
      console.error('Failed to fetch shared items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId]);

  useEffect(() => {
    fetchSharedItems();
  }, [fetchSharedItems]);

  const handleClearChat = async () => {
    if (!activeConversationId || !confirm('Are you sure you want to clear all messages? This cannot be undone.')) return;
    try {
      await api.delete(`/chat/conversations/${activeConversationId}/messages`);
      toast.success('Chat cleared');
      // Refresh messages if needed
      window.location.reload(); 
    } catch {
      toast.error('Failed to clear chat');
    }
  };

  const handleDeleteChat = async () => {
    if (!activeConversationId || !confirm('Delete this conversation entirely?')) return;
    try {
      await api.delete(`/chat/conversations/${activeConversationId}`);
      deleteConversation(activeConversationId);
      setActiveConversation(null);
      setInfoSidebarOpen(false);
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  if (!conversation) return null;

  const isGroup = conversation.type === 'group';
  const otherUser = !isGroup ? conversation.participants.find(p => p.id !== (JSON.parse(localStorage.getItem('hive_user') || '{}').id)) : null;
  const displayTitle = isGroup ? (conversation.title || 'Team Group') : (otherUser?.name || 'Private Chat');
  const displayAvatar = isGroup ? conversation.avatar_path : otherUser?.avatar_url;

  return (
    <div className="w-full h-full flex flex-col bg-white/60 dark:bg-background/60 backdrop-blur-3xl border-l border-border/30 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="h-20 flex items-center justify-between px-8 border-b border-border/20 shrink-0">
        <h3 className="font-extrabold text-xl tracking-tight text-foreground">Overview</h3>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setInfoSidebarOpen(false)}
          className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-muted transition-all"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-8 space-y-10">
        {/* Profile Card */}
        <div className="flex flex-col items-center text-center space-y-5">
          <div className="relative">
            <Avatar className="h-28 w-28 rounded-[2rem] shadow-2xl ring-4 ring-primary/5 transition-transform hover:scale-110 duration-500">
              <AvatarImage src={displayAvatar || undefined} />
              <AvatarFallback className="text-3xl font-black bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary">
                {displayTitle?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {isGroup ? (
              <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl shadow-lg">
                <Users className="h-4 w-4" />
              </div>
            ) : (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-background rounded-full shadow-lg" />
            )}
          </div>
          
          <div className="space-y-1.5">
            <h2 className="text-2xl font-black tracking-tight text-foreground">{displayTitle}</h2>
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
              {isGroup ? `${conversation.participants.length} Active Members` : 'Digital Engineering Lead'}
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3 w-full max-w-xs pt-4">
            <ActionButton icon={<Phone className="h-5 w-5" />} label="Call" />
            <ActionButton icon={<Video className="h-5 w-5" />} label="Video" />
            <ActionButton icon={<Search className="h-5 w-5" />} label="Find" />
            <ActionButton icon={<Bell className="h-5 w-5" />} label="Mute" />
          </div>
        </div>

        {/* Dynamic Sections */}
        <div className="space-y-6">
           <SectionLabel label="Conversation Settings" />
           <div className="space-y-3">
              <ToggleAction 
                icon={<Bell className="h-4 w-4" />} 
                title="Mute Notifications" 
              />
              {isGroup && (
                <ActionItem 
                  icon={<Users className="h-4 w-4" />} 
                  title="Group Members" 
                  description={`${conversation.participants.length} people`}
                  color="emerald"
                />
              )}
              <ActionItem 
                icon={<ShieldAlert className="h-4 w-4" />} 
                title="Privacy & Safety" 
                description="Encryption active"
                color="indigo"
              />
           </div>
        </div>

        {/* Shared Repository */}
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <SectionLabel label="Shared Repository" />
              <button className="text-[11px] font-black text-primary uppercase tracking-widest hover:underline">See All</button>
           </div>
          
          <Tabs defaultValue="media" className="w-full">
            <TabsList className="w-full bg-slate-100 dark:bg-muted/30 p-1.5 rounded-2xl h-12">
              <TabsTrigger value="media" className="flex-1 rounded-xl font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Media</TabsTrigger>
              <TabsTrigger value="files" className="flex-1 rounded-xl font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Files</TabsTrigger>
              <TabsTrigger value="links" className="flex-1 rounded-xl font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Links</TabsTrigger>
            </TabsList>
            
            <TabsContent value="media" className="mt-6">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
              ) : sharedItems.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {sharedItems.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-2xl bg-muted/40 relative group cursor-pointer overflow-hidden ring-1 ring-black/5 hover:ring-primary/40 transition-all">
                      <img src={img.url} alt="Shared" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<ImageIcon className="h-10 w-10" />} text="No media shared yet" />
              )}
            </TabsContent>
            
            <TabsContent value="files" className="mt-6 space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
              ) : sharedItems.files.length > 0 ? (
                sharedItems.files.map((file, i) => (
                  <FileCard key={i} file={file} />
                ))
              ) : (
                <EmptyState icon={<FileText className="h-10 w-10" />} text="No files found" />
              )}
            </TabsContent>

            <TabsContent value="links" className="mt-6 space-y-3">
               {sharedItems.links.length > 0 ? (
                 sharedItems.links.map((link, i) => (
                   <LinkCard key={i} link={link} />
                 ))
               ) : (
                 <EmptyState icon={<LinkIcon className="h-10 w-10" />} text="No links shared" />
               )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 space-y-6">
           <SectionLabel label="Danger Zone" color="text-red-500" />
           <div className="space-y-3">
              <button 
                onClick={handleClearChat}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 hover:bg-red-100 transition-colors group"
              >
                <div className="flex items-center gap-4 text-red-600">
                   <Trash2 className="h-5 w-5" />
                   <span className="font-extrabold text-[13px] uppercase tracking-wider">Clear All Messages</span>
                </div>
                <ChevronRight className="h-4 w-4 text-red-300" />
              </button>
              
              <button 
                onClick={handleDeleteChat}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-red-500 text-white shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                   <Ban className="h-5 w-5" />
                   <span className="font-extrabold text-[13px] uppercase tracking-wider">Delete Conversation</span>
                </div>
                <LogOut className="h-5 w-5 opacity-50" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ label, color = "text-muted-foreground/40" }: { label: string, color?: string }) {
  return <h4 className={cn("text-[11px] font-black uppercase tracking-[0.2em]", color)}>{label}</h4>;
}

function ActionButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl shadow-sm border-border/40 hover:border-primary hover:bg-primary/5 transition-all group">
        <div className="group-hover:scale-110 transition-transform">{icon}</div>
      </Button>
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}

function ActionItem({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: 'blue' | 'emerald' | 'indigo' }) {
  const bgStyles = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    indigo: "bg-indigo-500/10 text-indigo-600",
  }[color];

  return (
    <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-muted/20 border border-border/10 hover:border-primary/20 transition-all group">
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", bgStyles)}>
          {icon}
        </div>
        <div className="text-left">
           <p className="text-[13px] font-black text-foreground">{title}</p>
           <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-tight">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
    </button>
  );
}

function ToggleAction({ icon, title }: { icon: React.ReactNode, title: string }) {
  const [enabled, setEnabled] = useState(false);
  
  return (
    <div className="w-full flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-muted/20 border border-border/10">
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 bg-slate-100 text-slate-500")}>
          {icon}
        </div>
        <p className="text-[13px] font-black text-foreground">{title}</p>
      </div>
      <button 
        onClick={() => setEnabled(!enabled)}
        className={cn(
          "w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center",
          enabled ? "bg-primary" : "bg-slate-200 dark:bg-muted"
        )}
      >
        <div className={cn(
          "w-4 h-4 bg-white rounded-full transition-transform duration-300",
          enabled ? "translate-x-6" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}

function FileCard({ file }: { file: SharedFile }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-muted/10 border border-border/30 hover:border-primary/30 transition-all group relative overflow-hidden">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
          <FileText className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-extrabold truncate group-hover:text-primary transition-colors">{file.name || 'document.pdf'}</span>
          <span className="text-[11px] text-muted-foreground font-black uppercase tracking-tight">{((file.size ?? 0) / 1024 / 1024).toFixed(2)} MB · {file.type || 'FILE'}</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-xl hover:bg-slate-100">
        <Download className="h-5 w-5" />
      </Button>
    </div>
  );
}

function LinkCard({ link }: { link: SharedLink }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-muted/10 border border-border/30 hover:border-primary/30 transition-all group cursor-pointer">
       <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
          <LinkIcon className="h-6 w-6" />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black truncate">{link.title || link.url}</p>
          <p className="text-[11px] font-bold text-primary truncate leading-tight">{link.url}</p>
       </div>
       <ExternalLink className="h-4 w-4 text-muted-foreground/30" />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 opacity-30">
      <div className="p-6 rounded-[2rem] bg-slate-100 dark:bg-muted">
        {icon}
      </div>
      <p className="text-xs font-black uppercase tracking-widest">{text}</p>
    </div>
  );
}
