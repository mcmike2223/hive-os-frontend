"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Joyride, type EventData, type Step, STATUS, EVENTS, type TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

interface TourContextType {
    startTour: (steps: Step[], type?: 'welcome' | 'system') => void;
    stopTour: () => void;
    currentStepTarget: string | null;
    currentStep: Step | null;
    stepIndex: number;
    isActive: boolean;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
    const context = useContext(TourContext);
    if (!context) throw new Error("useTour must be used within a TourProvider");
    return context;
};

const CustomTooltip = React.forwardRef<HTMLDivElement, TooltipRenderProps & { totalSteps?: number }>(
    ({ index, step, backProps, closeProps, primaryProps, skipProps, tooltipProps, isLastStep, totalSteps }, ref) => {
        const { t, locale } = useTranslation();

        if (!step) return null;

        const total = totalSteps ?? 0;
        const current = index + 1;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

        const safeTooltipProps = tooltipProps as React.HTMLAttributes<HTMLDivElement>;

        const combinedStyle: React.CSSProperties = {
            ...(safeTooltipProps.style ?? {}),
            zIndex: 1000000,
            backgroundColor: 'hsl(var(--card))',
            borderRadius: '1.5rem',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            transition: 'opacity 0.2s ease-in-out',
        };

        return (
            <div
                {...tooltipProps}
                ref={ref}
                style={combinedStyle}
                className="w-[380px] p-6 border-2 border-primary/30 flex flex-col relative overflow-hidden bg-card text-card-foreground shadow-2xl"
            >
                {/* 🚀 BRANDED GLOW ACCENT */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
                <div className="absolute -top-24 -right-24 h-48 w-48 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-5 right-5 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors border border-transparent hover:border-destructive/20"
                    {...closeProps}
                >
                    <X className="h-4 w-4" />
                </Button>

                <div className="mb-6 mt-2 pr-6">
                    {total > 0 && (
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-primary">
                            {t("tour.step_counter", "Step {current} of {total}")
                                .replace("{current}", String(current))
                                .replace("{total}", String(total))}
                        </p>
                    )}
                    {step.title && (
                        <h3 className="font-space font-black text-xl tracking-tight mb-3 text-foreground flex items-center gap-3">
                            <span className="relative flex h-3 w-3 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                            </span>
                            {step.title}
                        </h3>
                    )}
                    <div className="text-sm text-muted-foreground font-medium leading-relaxed tracking-wide">
                        {step.content}
                    </div>
                </div>

                {total > 0 && (
                    <div
                        className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={current}
                        aria-valuemin={1}
                        aria-valuemax={total}
                        aria-label={t("tour.progress", "Tour progress")}
                    >
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                <div className="flex items-center justify-between border-t border-border/50 pt-5 mt-auto relative z-10">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-foreground/5 px-3 rounded-xl transition-colors"
                        {...skipProps}
                    >
                        {t("tour.dismiss", "Dismiss")}
                    </Button>

                    <div className="flex items-center gap-2">
                        {index > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl text-xs font-bold px-4 border-border/60 hover:bg-muted/50 transition-colors active:scale-95 flex items-center gap-1.5"
                                {...backProps}
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                {t("tour.back", "Back")}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            className="h-9 rounded-xl text-xs font-black px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                            {...primaryProps}
                        >
                            {isLastStep ? (
                                <>
                                    <Check className="h-3.5 w-3.5" />
                                    {t("tour.finish", "Finish")}
                                </>
                            ) : (
                                <>
                                    {t("tour.next", "Next")}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
);
CustomTooltip.displayName = "CustomTooltip";

export const TourProvider = ({ children }: { children: React.ReactNode }) => {
    const { locale } = useTranslation();
    const [isMounted, setIsMounted] = useState(false);
    const [run, setRun] = useState(false);
    const [steps, setSteps] = useState<Step[]>([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [tourType, setTourType] = useState<'welcome' | 'system'>('system');
    const tabTransitionTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setIsMounted(true);
        return () => {
            if (tabTransitionTimer.current) clearTimeout(tabTransitionTimer.current);
        };
    }, []);

    const switchTabSync = useCallback((switchTab: string | undefined, tabSelector?: string): boolean => {
        if (!switchTab && !tabSelector) return false;

        const possibleTriggers = [
            tabSelector,
            `#tour-tab-${switchTab}`,
            `#settings-tab-${switchTab}`,
            `#tour-profile-tab-${switchTab}`,
            `button[value="${switchTab}"]`,
            `[data-tab="${switchTab}"]`,
            `[data-value="${switchTab}"]`,
            `button[role="tab"][id*="${switchTab}"]`
        ].filter(Boolean) as string[];

        for (const selector of possibleTriggers) {
            const el = document.querySelector<HTMLElement>(selector);
            if (el) {
                const isSelected = el.getAttribute('aria-selected') === 'true' ||
                                   el.getAttribute('data-state') === 'active' ||
                                   el.classList.contains('active');
                if (!isSelected) {
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    el.click();
                    return true;
                }
                return false;
            }
        }
        return false;
    }, []);

    const startTour = useCallback((newSteps: Step[], type: 'welcome' | 'system' = 'system') => {
        setTourType(type);
        setSteps(newSteps.map(step => ({ ...step, skipBeacon: true })));
        setStepIndex(0);

        if (newSteps.length > 0) {
            const firstStep = newSteps[0];
            const stepData = firstStep?.data as Record<string, any> | undefined;
            const didSwitch = switchTabSync(stepData?.switchTab, stepData?.tabSelector);

            if (didSwitch) {
                setTimeout(() => setRun(true), 350);
                return;
            }
        }

        setTimeout(() => setRun(true), 200);
    }, [switchTabSync]);

    const stopTour = useCallback(() => {
        setRun(false);
        setStepIndex(0);
        if (tabTransitionTimer.current) clearTimeout(tabTransitionTimer.current);
    }, []);

    const syncTourCompletion = async () => {
        try {
            const { getAccessToken } = await import("@/lib/runtime-context");
            const token = getAccessToken();
            if (!token) return;

            const { getBackendApiRoot, getTenantHeaders, isTenantSession } = await import("@/lib/runtime-context");
            const baseUrl = getBackendApiRoot();
            const endpoint = isTenantSession() ? `${baseUrl}/tenant/profile/tour-complete` : `${baseUrl}/profile/tour-complete`;

            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    ...getTenantHeaders()
                }
            });
        } catch (error) {
            console.error("Failed to sync tour completion:", error);
        }
    };

    const handleJoyrideEvent = (data: EventData) => {
        const { status, type, action, index, step } = data;

        if (type === EVENTS.STEP_AFTER) {
            const nextIndex = index + (action === 'prev' ? -1 : 1);

            if (nextIndex >= 0 && nextIndex < steps.length) {
                const nextStep = steps[nextIndex];
                const nextStepData = nextStep?.data as Record<string, any> | undefined;
                const didSwitch = switchTabSync(nextStepData?.switchTab, nextStepData?.tabSelector);

                if (didSwitch) {
                    if (tabTransitionTimer.current) clearTimeout(tabTransitionTimer.current);
                    tabTransitionTimer.current = setTimeout(() => {
                        setStepIndex(nextIndex);
                    }, 300);
                    return;
                }
            }

            setStepIndex(nextIndex);
        } else if (type === EVENTS.TARGET_NOT_FOUND) {
            const stepData = step?.data as Record<string, any> | undefined;
            const didSwitch = switchTabSync(stepData?.switchTab, stepData?.tabSelector);

            if (didSwitch) {
                if (tabTransitionTimer.current) clearTimeout(tabTransitionTimer.current);
                tabTransitionTimer.current = setTimeout(() => {
                    const retryTarget = typeof step.target === 'string' ? document.querySelector(step.target) : step.target;
                    if (retryTarget) {
                        return;
                    }
                    setStepIndex(index + (action === 'prev' ? -1 : 1));
                }, 300);
                return;
            }

            setStepIndex(index + (action === 'prev' ? -1 : 1));
        } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            const isFinished = status === STATUS.FINISHED;
            setRun(false);
            setStepIndex(0);
            if (tabTransitionTimer.current) clearTimeout(tabTransitionTimer.current);

            if (tourType === 'welcome') {
                localStorage.setItem('hive_welcome_tour_completed', 'true');
                if (isFinished) syncTourCompletion();
            } else {
                localStorage.setItem('hive_tour_completed', 'true');
            }
        }
    };

    const currentStep = steps[stepIndex] || null;
    const currentStepTarget = currentStep?.target as string | null;

    return (
        <TourContext.Provider value={{ startTour, stopTour, currentStepTarget, currentStep, stepIndex, isActive: run }}>
            {children}
            {isMounted && (
                <Joyride
                    key={locale}
                    steps={steps}
                    run={run}
                    stepIndex={stepIndex}
                    onEvent={handleJoyrideEvent}
                    continuous={true}
                    scrollToFirstStep={true}
                    options={{
                        buttons: ["skip", "back", "close", "primary"],
                        overlayClickAction: false,
                        scrollOffset: 140,
                        showProgress: false,
                        zIndex: 999999,
                        overlayColor: "rgba(0, 0, 0, 0.65)",
                        primaryColor: "hsl(var(--primary))",
                        backgroundColor: "hsl(var(--card))",
                        textColor: "hsl(var(--foreground))",
                        spotlightRadius: 24,
                        spotlightPadding: 14,
                    }}
                    tooltipComponent={(props: TooltipRenderProps) => (
                        <CustomTooltip {...props} totalSteps={steps.length} />
                    )}
                    floatingOptions={{
                        hideArrow: false,
                        shiftOptions: { padding: 16 },
                    }}
                />
            )}
        </TourContext.Provider>
    );
};
