// components/ui/pdf-viewer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Download, ExternalLink, Printer, FileText, Loader2, Maximize, Minimize, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authenticatedDownload } from '@/lib/authenticated-download';

interface PdfViewerProps {
  src: string;
  title?: string;
  className?: string;
  fetchUrl?: string;
  fetchHeaders?: Record<string, string>;
  downloadUrl?: string;
  allowDownload?: boolean;   // LMS Feature: Toggle downloading
  allowPrint?: boolean;      // LMS Feature: Toggle printing
  requireTime?: number;      // LMS Feature: Seconds required before marking complete
  onComplete?: () => void;   // LMS Feature: Fires when requireTime is met
}

export function PdfViewer({ 
  src, 
  title = "PDF Document", 
  className, 
  fetchUrl,
  fetchHeaders,
  downloadUrl,
  allowDownload = true, 
  allowPrint = true,
  requireTime = 0,
  onComplete
}: PdfViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const revokeObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    if (!fetchUrl) {
      revokeObjectUrl();
      setResolvedSrc(src);
      setErrorMessage(null);
      setIsLoading(true);

      return () => {
        active = false;
        revokeObjectUrl();
      };
    }

    setIsLoading(true);
    setErrorMessage(null);
    setResolvedSrc('');

    (async () => {
      try {
        const response = await fetch(fetchUrl, {
          headers: fetchHeaders ?? {},
        });

        if (!response.ok) {
          throw new Error(response.status === 401 || response.status === 403
            ? 'Secure preview authorization failed.'
            : 'Failed to load the PDF preview.');
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        revokeObjectUrl();
        objectUrlRef.current = objectUrl;
        setResolvedSrc(objectUrl);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Failed to load the PDF preview.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      revokeObjectUrl();
    };
  }, [src, fetchUrl, JSON.stringify(fetchHeaders ?? {})]);

  // LMS Tracking Timer
  useEffect(() => {
    if (requireTime === 0 || isCompleted || isLoading) return;

    const timer = setInterval(() => {
      setTimeSpent((prev) => {
        const newTime = prev + 1;
        if (newTime >= requireTime) {
          setIsCompleted(true);
          if (onComplete) onComplete();
          clearInterval(timer);
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [requireTime, isCompleted, isLoading, onComplete]);

  const handlePrint = () => {
    if (!allowPrint || !resolvedSrc) return;
    const printWindow = window.open(resolvedSrc, '_blank');
    if (printWindow) {
      printWindow.onload = () => printWindow.print();
    }
  };

  const triggerDownload = async () => {
    if (!allowDownload) return;

    const secureDownloadTarget = downloadUrl ?? fetchUrl;

    if (secureDownloadTarget) {
      try {
        await authenticatedDownload(secureDownloadTarget, {
          filename: title,
          headers: fetchHeaders,
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to download this document.');
      }

      return;
    }

    if (!resolvedSrc) {
      return;
    }

    const link = document.createElement('a');
    link.href = resolvedSrc;
    link.download = title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Listen for ESC key to exit fullscreen gracefully
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex flex-col border border-border/50 overflow-hidden shadow-inner w-full bg-card transition-all duration-300", 
        isFullscreen ? "rounded-none fixed inset-0 z-[100] h-screen" : "rounded-[2rem] h-full min-h-[600px]",
        className
      )}
      onContextMenu={(e) => { if (!allowDownload) e.preventDefault(); }} // Basic right-click prevention
    >
      
      {/* Custom PDF Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30 shrink-0">
        <div className="flex items-center gap-3 px-2 overflow-hidden">
          <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 relative">
            <FileText className="h-4 w-4 text-red-500" />
            {isCompleted && (
              <span className="absolute -top-1 -right-1 bg-background rounded-full">
                <CheckCircle className="h-3 w-3 text-emerald-500 fill-emerald-500/20" />
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate" title={title}>{title}</span>
            {requireTime > 0 && !isCompleted && (
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Reading... {timeSpent}s / {requireTime}s
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Reading Mode"}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          {allowPrint && (
            <Button variant="ghost" size="icon" onClick={handlePrint} className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors hidden sm:flex" title="Print Document">
              <Printer className="h-4 w-4" />
            </Button>
          )}

          {allowDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (resolvedSrc) window.open(resolvedSrc, '_blank', 'noopener,noreferrer');
              }}
              disabled={!resolvedSrc}
              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors hidden sm:flex"
              title="Open PDF in New Tab"
              aria-label="Open PDF in New Tab"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
          
          {allowDownload && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={triggerDownload} 
              className="h-8 ml-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold shadow-sm transition-all hover:shadow-md"
            >
              <Download className="h-3 w-3 sm:mr-2" /> <span className="hidden sm:inline">Download</span>
            </Button>
          )}
        </div>
      </div>

      {/* PDF Content Area */}
      <div className="relative flex-1 w-full bg-muted/10">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10 transition-opacity duration-300">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
            <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Rendering Document...</p>
          </div>
        )}

        {errorMessage && !isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center">
            <FileText className="h-10 w-10 text-red-500/70" />
            <p className="text-sm font-bold text-foreground">Preview unavailable</p>
            <p className="max-w-md text-xs text-muted-foreground">{errorMessage}</p>
            {allowDownload ? (
              <Button onClick={triggerDownload} className="rounded-xl">
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            ) : null}
          </div>
        ) : resolvedSrc ? (
          <iframe 
            src={`${resolvedSrc}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`} 
            className="w-full h-full border-none absolute inset-0" 
            title={title}
            onLoad={() => setIsLoading(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
