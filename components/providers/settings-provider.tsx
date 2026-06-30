"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { SystemOffline } from "@/components/auth/system-offline";
import { clearHiveSession, handleAuthFailureResponse } from "@/lib/auth-sync";
import { getAccessToken, getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";

// 🚀 Interfaces
export interface SystemSettings {
    support_email: string;
    support_phone: string;
    system_email_name: string;
    system_email_address: string;
    default_timezone: string;
    default_currency: string;
    date_format: string;
    time_format: string;
    max_upload_size: number;
    max_upload_unit: string;
    session_timeout_minutes: number;
    maintenance_mode: boolean;
    enable_registration: boolean;
    require_2fa: boolean;
}

interface SettingsContextType {
    settings: SystemSettings | null;
    isLoading: boolean;
}

// 🛡️ THE MISSING LINE: Restoring the Context definition
const SettingsContext = createContext<SettingsContextType>({ settings: null, isLoading: true });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [hasCheckedUser, setHasCheckedUser] = useState(false);
    const workspaceScope = getWorkspaceScopeKey();

    useEffect(() => {
        try {
            const userStr = localStorage.getItem("hive_user");
            const context = localStorage.getItem("hive_context");
            if (userStr && context === "central") {
                const user = JSON.parse(userStr);
                const roles = user.roles || [];
                // Check for Admin roles or the primary owner ID
                if (roles.includes("Super Admin") || roles.includes("Admin") || user.id === 1) {
                    setIsSuperAdmin(true);
                } else {
                    setIsSuperAdmin(false);
                }
            } else {
                setIsSuperAdmin(false);
            }
        } catch (e) {
            setIsSuperAdmin(false);
        } finally {
            setHasCheckedUser(true);
        }
    }, [pathname]);

    const { data, isLoading } = useQuery({
        queryKey: ["globalSystemSettings", workspaceScope],
        queryFn: async () => {
            const token = getAccessToken();

            if (!token) {
                return { data: null };
            }

            const res = await fetch(`${getBackendApiRoot()}/settings/general`, {
                headers: getAuthHeaders(),
            });

            if (await handleAuthFailureResponse(res)) {
                return { data: null };
            }

            if (!res.ok) throw new Error("Failed to fetch settings");
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const settings = data?.data as SystemSettings | null;

    const handleEmergencyLogout = () => {
        clearHiveSession();
        router.push("/sign-in");
    };

    if (!hasCheckedUser && !isLoading) {
        return <div className="h-screen w-screen bg-background" />;
    }

    // 🚀 MAINTENANCE INTERCEPTOR
    if (settings?.maintenance_mode && pathname !== '/sign-in' && !isSuperAdmin) {
        return (
            <SystemOffline 
                supportEmail={settings.support_email || 'admin@hive-os.com'} 
                onLogout={handleEmergencyLogout} 
            />
        );
    }

    return (
        <SettingsContext.Provider value={{ settings, isLoading }}>
            {/* Admin Warning Bar (Pulsing Red) */}
            {settings?.maintenance_mode && isSuperAdmin && (
                <div className="fixed top-0 inset-x-0 z-[100] flex flex-col items-center pointer-events-none">
                    <div className="h-1.5 w-full bg-destructive animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                    <div className="bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-b-lg shadow-md flex items-center gap-2 pointer-events-auto">
                        <ShieldAlert className="h-3 w-3" />
                        Maintenance Mode Active: Bypassed via SuperAdmin Clearance
                    </div>
                </div>
            )}
            {children}
        </SettingsContext.Provider>
    );
}

// 🚀 Restoring the Hook
export const useSystemSettings = () => useContext(SettingsContext);
