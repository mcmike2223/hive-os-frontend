"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

export interface User {
  id: number | string;
  name: string;
  email: string;
  avatar_url?: string;
  chat_public_key?: string | null;
  chat_key_fingerprint?: string | null;
}

interface UserMultiSelectProps {
  id: string;
  placeholder?: string;
  selectedUsers: User[];
  onChange: (users: User[]) => void;
}

export function UserMultiSelect({ id, placeholder = "Search users...", selectedUsers, onChange }: UserMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/directory/users?search=${encodeURIComponent(query)}`);
        let usersList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

        const q = query.toLowerCase().trim();
        if (q === 'all' || "all users".startsWith(q) || "everyone".startsWith(q)) {
            usersList = [
                { id: 'all', name: 'All Users (Everyone)', email: 'Broadcast to everyone in the company' },
                ...usersList
            ];
        }

        setResults(usersList);
      } catch {
        console.error("Failed to fetch users");
      } finally {
        setLoading(false);
      }
    };

    const debounceId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounceId);
  }, [query]);

  const handleSelect = (user: User) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      onChange([...selectedUsers, user]);
    }
    setQuery("");
    setOpen(false);
  };

  const handleRemove = (id: number | string) => {
    onChange(selectedUsers.filter(u => u.id !== id));
  };

  const listboxId = `${id}-options`;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-2 border rounded-md p-2 bg-background focus-within:ring-2 focus-within:ring-ring">
        {selectedUsers.map(user => (
          <Badge key={user.id} variant="secondary" className="flex items-center gap-1 bg-muted">
            {user.name}
            <button
              type="button"
              aria-label={`Remove ${user.name}`}
              className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => handleRemove(user.id)}
            >
              <X aria-hidden="true" className="h-3 w-3" data-icon="inline-start" />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open && Boolean(query)}
          className="flex-1 bg-transparent outline-none min-w-[120px] text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground"
          placeholder={selectedUsers.length === 0 ? placeholder : ""}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { if(query) setOpen(true); }}
        />
      </div>

      {open && query && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Matching users"
          className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-md shadow-md z-50 overflow-hidden max-h-[220px] overflow-y-auto"
        >
          {loading && (
            <div className="p-3 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" data-icon="inline-start" /> Searching...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No users found.
            </div>
          )}

          {!loading && results.map((user) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={selectedUsers.some((selected) => selected.id === user.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring flex flex-col"
              onClick={() => handleSelect(user)}
            >
              <span className="font-semibold">{user.name}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
