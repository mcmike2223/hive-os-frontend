import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ChatConversation {
    id: number;
    type: 'private' | 'group';
    title: string | null;
    avatar_path: string | null;
    created_by: number | null;
    participants: {
        id: number;
        name: string;
        email: string;
        avatar_path: string;
        avatar_url: string;
        chat_public_key?: string | null;
    }[];
    last_message: {
        id: number;
        body: string | null;
        type: 'text' | 'image' | 'file' | 'audio';
        metadata?: ChatMessageMetadata | null;
        sender_id: number;
        created_at: string;
    } | null;
    unread_count: number;
    encryption?: {
        enabled: boolean;
        algorithm?: string | null;
        wrapped_key?: string | null;
        key_version?: number | null;
    } | null;
    updated_at: string;
}

export interface ChatAttachmentMetadata {
    file_entry_id?: number | null;
    uuid?: string | null;
    name?: string | null;
    title?: string | null;
    download_name?: string | null;
    mime_type?: string | null;
    size?: number | null;
    human_size?: string | null;
    url?: string | null;
    thumbnail?: string | null;
    type?: 'text' | 'image' | 'file' | 'audio';
}

export interface ChatReplyMetadata {
    id: number;
    conversation_id: number;
    sender_id: number;
    body: string | null;
    type: 'text' | 'image' | 'file' | 'audio';
    sender?: {
        id: number;
        name: string | null;
    } | null;
}

export interface ChatMessageMetadata {
    attachment?: ChatAttachmentMetadata | null;
    reply_to?: ChatReplyMetadata | null;
}

export interface ChatMessage {
    id: number;
    conversation_id: number;
    sender_id: number;
    body: string | null;
    type: 'text' | 'image' | 'file' | 'audio';
    metadata: ChatMessageMetadata | null;
    is_read: boolean;
    created_at: string;
    sender: {
        id: number;
        name: string;
        email: string;
        avatar_path: string;
        avatar_url: string;
    };
}

export interface ChatCounts {
    total: number;
    unread: number;
}

export interface ChatEncryptionConfig {
    enabled: boolean;
    algorithm?: string | null;
    public_key?: string | null;
    fingerprint?: string | null;
}

interface ChatState {
    activeConversationId: number | null;
    conversations: ChatConversation[];
    messages: ChatMessage[];
    isComposeOpen: boolean;
    isVideoMeetingOpen: boolean;
    pendingVideoCallConversationId: number | null;
    composeData: any | null;
    counts: ChatCounts;
    checkedConversationIds: number[];
    searchQuery: string;
    isFullscreen: boolean;
    onlineUsers: any[];
    isLoading: boolean;
    typingUsers: Record<string, { id: number, name: string }[]>;
    encryptionConfig: ChatEncryptionConfig;
    
    // New Premium State
    activeTab: 'recent' | 'groups' | 'contacts';
    isInfoSidebarOpen: boolean;
    isSearching: boolean;
    globalSearchResults: {
        conversations: ChatConversation[];
        messages: any[];
    };
    isSidebarCollapsed: boolean;

    setActiveConversation: (id: number | null) => void;
    setConversations: (conversations: ChatConversation[]) => void;
    appendConversation: (conversation: ChatConversation) => void;
    updateConversation: (id: number, data: Partial<ChatConversation>) => void;
    deleteConversation: (id: number) => void;
    setMessages: (messages: ChatMessage[]) => void;
    appendMessage: (message: ChatMessage) => void;
    setComposeOpen: (isOpen: boolean, prefillData?: any) => void;
    setVideoMeetingOpen: (isOpen: boolean) => void;
    setPendingVideoCallConversationId: (id: number | null) => void;
    setCounts: (counts: ChatCounts) => void;
    toggleCheckConversation: (id: number) => void;
    toggleCheckAll: (ids: number[]) => void;
    clearChecked: () => void;
    bulkDeleteConversations: (ids: number[]) => void;
    setSearchQuery: (query: string) => void;
    setFullscreen: (val: boolean) => void;
    adjustCounts: (updates: Partial<ChatCounts>) => void;
    setOnlineUsers: (users: any[]) => void;
    setLoading: (loading: boolean) => void;
    setTyping: (conversationId: number, user: { id: number, name: string }, isTyping: boolean) => void;
    clearTyping: (conversationId?: number) => void;
    setEncryptionConfig: (config: ChatEncryptionConfig) => void;

    // New Premium Actions
    setActiveTab: (tab: 'recent' | 'groups' | 'contacts') => void;
    setInfoSidebarOpen: (isOpen: boolean) => void;
    setSearching: (isSearching: boolean) => void;
    setGlobalSearchResults: (results: { conversations: ChatConversation[]; messages: any[] }) => void;
    setSidebarCollapsed: (val: boolean) => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            activeConversationId: null,
            conversations: [],
            messages: [],
            isComposeOpen: false,
            isVideoMeetingOpen: false,
            pendingVideoCallConversationId: null,
            composeData: null,
            counts: {
                total: 0,
                unread: 0,
            },
            checkedConversationIds: [],
            searchQuery: '',
            isFullscreen: false,
            onlineUsers: [],
            typingUsers: {},
            isLoading: false,
            encryptionConfig: {
                enabled: false,
                algorithm: null,
                public_key: null,
                fingerprint: null,
            },

            // New Premium Initial State
            activeTab: 'recent',
            isInfoSidebarOpen: false,
            isSearching: false,
            globalSearchResults: {
                conversations: [],
                messages: []
            },
            isSidebarCollapsed: false,

            setActiveConversation: (id) => set({ activeConversationId: id, checkedConversationIds: [] }),
            setConversations: (conversations) => set({ conversations, checkedConversationIds: [] }),
            appendConversation: (conversation) => set((state) => {
                const existing = state.conversations.find(c => String(c.id) === String(conversation.id));
                const nextConversation = existing ? { ...existing, ...conversation } : conversation;
                const remaining = state.conversations.filter(c => String(c.id) !== String(conversation.id));

                return {
                    conversations: [nextConversation, ...remaining]
                };
            }),
            updateConversation: (id, data) => set((state) => {
                const existing = state.conversations.find(c => String(c.id) === String(id));

                if (!existing) {
                    return state;
                }

                const updatedConversation = { ...existing, ...data };
                const shouldBubbleToTop = data.updated_at !== undefined || data.last_message !== undefined;

                if (!shouldBubbleToTop) {
                    return {
                        conversations: state.conversations.map((conversation) =>
                            String(conversation.id) === String(id) ? updatedConversation : conversation
                        )
                    };
                }

                const remaining = state.conversations.filter(c => String(c.id) !== String(id));

                return {
                    conversations: [updatedConversation, ...remaining]
                };
            }),
            deleteConversation: (id) => set((state) => ({
                conversations: state.conversations.filter((c) => c.id !== id),
                activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
            })),
            setMessages: (messages) => set({ messages }),
            appendMessage: (message) => set((state) => {
                // Prevent duplicate messages
                if (state.messages.some(m => String(m.id) === String(message.id))) {
                    return state;
                }
                return { messages: [...state.messages, message] };
            }),
            setComposeOpen: (isOpen, prefillData = null) => set({ isComposeOpen: isOpen, composeData: prefillData }),
            setVideoMeetingOpen: (isOpen) => set({ isVideoMeetingOpen: isOpen }),
            setPendingVideoCallConversationId: (id) => set({ pendingVideoCallConversationId: id }),
            setCounts: (counts) => set({ counts }),
            toggleCheckConversation: (id) => set((state) => ({
                checkedConversationIds: state.checkedConversationIds.includes(id) 
                    ? state.checkedConversationIds.filter(i => i !== id) 
                    : [...state.checkedConversationIds, id]
            })),
            toggleCheckAll: (ids) => set((state) => ({
                checkedConversationIds: state.checkedConversationIds.length === ids.length ? [] : ids
            })),
            clearChecked: () => set({ checkedConversationIds: [] }),
            bulkDeleteConversations: (ids) => set((state) => ({
                conversations: state.conversations.filter((c) => !ids.includes(c.id)),
                checkedConversationIds: []
            })),
            setSearchQuery: (query) => set({ searchQuery: query }),
            setFullscreen: (val) => set({ isFullscreen: val }),
            adjustCounts: (updates) => set((state) => {
                const newCounts = { ...state.counts };
                for (const [key, value] of Object.entries(updates)) {
                    newCounts[key as keyof ChatCounts] = Math.max(0, (newCounts[key as keyof ChatCounts] ?? 0) + (value as number));
                }
                return { counts: newCounts };
            }),
            setOnlineUsers: (users) => set({ onlineUsers: users }),
            setLoading: (loading) => set({ isLoading: loading }),
            setEncryptionConfig: (config) => set({ encryptionConfig: config }),
            setTyping: (conversationId, user, isTyping) => set((state) => {
                const key = String(conversationId);
                const current = state.typingUsers[key] || [];
                const updated = isTyping 
                    ? [...current.filter(u => u.id !== user.id), user]
                    : current.filter(u => u.id !== user.id);
                
                return {
                    typingUsers: {
                        ...state.typingUsers,
                        [key]: updated
                    }
                };
            }),
            clearTyping: (conversationId) => set((state) => {
                if (conversationId === undefined) {
                    return { typingUsers: {} };
                }

                const nextTypingUsers = { ...state.typingUsers };
                delete nextTypingUsers[String(conversationId)];

                return { typingUsers: nextTypingUsers };
            }),

            // New Premium Action Implementations
            setActiveTab: (tab) => set({ activeTab: tab }),
            setInfoSidebarOpen: (isOpen) => set({ isInfoSidebarOpen: isOpen }),
            setSearching: (isSearching) => set({ isSearching }),
            setGlobalSearchResults: (results) => set({ globalSearchResults: results }),
            setSidebarCollapsed: (val) => set({ isSidebarCollapsed: val }),
        }),
        {
            name: 'hive-chat-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed }),
        }
    )
);
