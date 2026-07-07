"use client";

import React, { useState, useEffect } from 'react';
import { useChatAccess } from '@/hooks/use-chat-access';
import {
  bootstrapConversationEncryption,
  decryptChatConversation,
  decryptChatMessages,
  encryptChatMessageBody,
} from '@/lib/chat-e2ee';
import { useChatStore } from '@/store/chat-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { 
  Loader2, X, Search, ChevronRight, Check,
  Sparkles
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
  chat_encryption_public_key?: string | null;
}

export default function ComposeChatModal() {
  const {
    isComposeOpen,
    setComposeOpen,
    composeData,
    appendConversation,
    setActiveConversation,
    adjustCounts,
    setMessages,
    conversations,
    encryptionConfig,
  } = useChatStore();
  const { canManageChat } = useChatAccess();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [initialMessage, setInitialMessage] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (isComposeOpen && composeData?.user) {
      setSelectedUsers([composeData.user]);
    }
  }, [isComposeOpen, composeData]);

  useEffect(() => {
    if (!canManageChat && isComposeOpen) {
      setComposeOpen(false);
    }
  }, [canManageChat, isComposeOpen, setComposeOpen]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!search.trim() || search.length < 2) {
        setSearchResults([]);
        return;
      }
      
      setSearching(true);
      try {
        const { data } = await api.get(`/chat/users/search?q=${encodeURIComponent(search)}`);
        setSearchResults(data.data || data || []);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleStartConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    if (isGroup && !groupTitle.trim()) {
      toast.error('Please enter a group title');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (isGroup || selectedUsers.length > 1) {
        response = await api.post('/chat/groups', {
          title: groupTitle.trim() || `${selectedUsers.map(u => u.name.split(' ')[0]).join(', ')}...`,
          user_ids: selectedUsers.map(u => u.id),
        });
      } else {
        const outgoingMessage = initialMessage.trim() || 'Hey there!';

        response = await api.post('/chat/conversations', {
          user_id: selectedUsers[0].id,
          body: encryptionConfig.enabled ? null : outgoingMessage,
        });
      }
      
      let newConv = await decryptChatConversation(response.data.conversation || response.data);
      const existingConversation = conversations.find((conversation) => String(conversation.id) === String(newConv.id));

      appendConversation(newConv);
      setActiveConversation(newConv.id);

      if (!existingConversation) {
        adjustCounts({ total: 1 });
      }

      if (!isGroup && selectedUsers.length === 1 && encryptionConfig.enabled) {
        newConv = await bootstrapConversationEncryption(newConv);

        const encryptedBody = await encryptChatMessageBody(
          newConv,
          initialMessage.trim() || 'Hey there!'
        );

        await api.post(`/chat/conversations/${newConv.id}/messages`, {
          type: 'text',
          body: encryptedBody,
        });
      }

      const { data } = await api.get(`/chat/conversations/${newConv.id}/messages`);
      const decryptedMessages = await decryptChatMessages(data.data || data, newConv);
      setMessages(decryptedMessages);
      
      handleClose();
      toast.success(isGroup ? 'Group created' : 'Chat started');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to initialize conversation'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setComposeOpen(false);
    setSearch('');
    setSearchResults([]);
    setSelectedUsers([]);
    setInitialMessage('');
    setGroupTitle('');
    setIsGroup(false);
  };

  const toggleUser = (user: User) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
      if (selectedUsers.length > 0) setIsGroup(true);
    }
  };

  if (!canManageChat) {
    return null;
  }

  return (
    <Dialog open={isComposeOpen} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className="sm:max-w-[450px] md:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl sm:rounded-[2rem] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <DialogHeader className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2 relative z-10 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight">New Message</DialogTitle>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5 sm:mt-1">Start a conversation</p>
            </div>
            <div className="flex bg-muted/40 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl">
              <button 
                onClick={() => setIsGroup(false)}
                className={cn(
                  "px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                  !isGroup ? "bg-white dark:bg-slate-800 shadow-sm text-primary" : "text-muted-foreground/50"
                )}
              >
                Direct
              </button>
              <button 
                onClick={() => setIsGroup(true)}
                className={cn(
                  "px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                  isGroup ? "bg-white dark:bg-slate-800 shadow-sm text-primary" : "text-muted-foreground/50"
                )}
              >
                Group
              </button>
            </div>
            
          </div>
        </DialogHeader>
        
        <div className="px-4 sm:px-6 lg:px-8 pb-4 flex flex-col gap-4 sm:gap-5 lg:gap-6 relative z-10 overflow-y-auto">
          {isGroup && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-3 sm:space-y-4"
            >
              <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 p-3 sm:p-4 bg-primary/5 rounded-xl sm:rounded-2xl ring-1 ring-primary/10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-[1rem] lg:rounded-[1.5rem] bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center">
                   <span className="text-2xl sm:text-3xl">👥</span>
                </div>
                <div className="flex-1">
                  <Input 
                    placeholder="Group name..."
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    className="bg-transparent border-none p-0 text-base sm:text-lg lg:text-xl font-black placeholder:text-muted-foreground/20 focus-visible:ring-0"
                  />
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5 sm:mt-1">Group Name</p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="space-y-2 sm:space-y-3">
             <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Recipients</label>
                <span className="text-[10px] font-black text-primary/60">{selectedUsers.length} Selected</span>
             </div>
             
             <div className="relative group">
                <Search className={cn(
                  "absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-colors",
                  searching ? "text-primary animate-pulse" : "text-muted-foreground/30 group-focus-within:text-primary"
                )} />
                <Input 
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 sm:pl-11 lg:pl-12 h-11 sm:h-12 lg:h-14 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-muted/20 border-border/10 focus-visible:ring-primary/20 focus-visible:border-primary/30 text-sm sm:text-base font-semibold"
                />
             </div>

             {selectedUsers.length > 0 && (
               <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                  <AnimatePresence>
                    {selectedUsers.map(user => (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        key={user.id}
                        className="flex items-center gap-1.5 sm:gap-2 pl-1 pr-2 sm:pr-3 py-0.5 sm:py-1 bg-white dark:bg-slate-800 shadow-sm border border-border/20 rounded-full group hover:border-red-200 transition-colors cursor-pointer"
                        onClick={() => toggleUser(user)}
                      >
                         <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
                           <AvatarImage src={user.avatar_url} />
                           <AvatarFallback className="text-[8px] sm:text-[10px] font-bold">{user.name.charAt(0)}</AvatarFallback>
                         </Avatar>
                         <span className="text-[10px] sm:text-xs font-bold">{user.name.split(' ')[0]}</span>
                         <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground group-hover:text-red-500" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
               </div>
             )}
             
             <div className="relative h-[140px] sm:h-[160px] lg:h-[200px]">
                {searching ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary/20" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="absolute inset-0 flex flex-col gap-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-thin">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user)}
                        className={cn(
                          "flex items-center justify-between p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all group",
                          selectedUsers.find(u => u.id === user.id) 
                            ? "bg-primary/5 ring-1 ring-primary/20" 
                            : "hover:bg-slate-50 dark:hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="relative">
                            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 rounded-lg sm:rounded-xl shadow-sm">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-sm">
                                {user.name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            {selectedUsers.find(u => u.id === user.id) && (
                              <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5">
                                <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-extrabold text-sm text-foreground">{user.name}</div>
                            <div className="text-[10px] sm:text-xs font-bold text-muted-foreground/50">{user.email}</div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-all hidden sm:block" />
                      </button>
                    ))}
                  </div>
                ) : search.length > 2 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 italic text-xs sm:text-sm">
                    No users found
                  </div>
                ) : !search && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-4 opacity-10">
                      <span className="text-3xl sm:text-4xl">💬</span>
                      <p className="font-black text-[10px] sm:text-xs uppercase tracking-widest">Search for contacts</p>
                   </div>
                )}
             </div>
          </div>

          {!isGroup && selectedUsers.length === 1 && (
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-2 sm:space-y-3"
            >
              <label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Message</label>
              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Say hello..."
                className="w-full min-h-[80px] sm:min-h-[100px] p-3 sm:p-4 rounded-xl sm:rounded-3xl bg-slate-50 dark:bg-muted/20 border-border/10 focus:ring-0 resize-none text-sm sm:text-[15px] font-semibold placeholder:text-muted-foreground/20 transition-all"
              />
            </motion.div>
          )}
        </div>
        
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-50/50 dark:bg-muted/10 border-t border-border/20 flex gap-2 sm:gap-3 shrink-0">
          <Button 
            variant="ghost" 
            onClick={handleClose} 
            disabled={loading}
            className="flex-1 h-11 sm:h-12 lg:h-14 rounded-xl sm:rounded-2xl font-black uppercase tracking-wider text-muted-foreground text-xs sm:text-sm"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleStartConversation} 
            disabled={loading || selectedUsers.length === 0 || (isGroup && !groupTitle.trim())}
            className={cn(
              "flex-[1.5] h-11 sm:h-12 lg:h-14 rounded-xl sm:rounded-2xl font-black uppercase tracking-wider transition-all shadow-xl text-xs sm:text-sm",
              selectedUsers.length > 0 ? "bg-primary shadow-primary/30" : "bg-muted"
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : (
              <span className="flex items-center gap-1.5 sm:gap-2">
                {isGroup ? 'Create Group' : 'Start Chat'}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
