"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Download,
  ScrollText,
  ShieldCheck,
  FlaskConical
} from "lucide-react";
import { format } from "date-fns";

import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchInventoryBatchCoa } from "@/modules/inventory/api";
import { useTranslation } from "@/store/use-translation";
import { authenticatedDownload } from "@/lib/authenticated-download";
import { getAccessToken, getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";

interface QaCoaModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: number | null;
}

export function QaCoaModal({ isOpen, onClose, batchId }: QaCoaModalProps) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = React.useState(false);

  const coaQuery = useQuery({
    queryKey: ["inventory", "product-batches", batchId, "coa"],
    queryFn: () => fetchInventoryBatchCoa(batchId!),
    enabled: isOpen && !!batchId,
  });

  const handleDownload = async () => {
    if (!batchId) return;
    
    try {
      setIsDownloading(true);
      const token = getAccessToken();
      const baseUrl = getBackendApiRoot();
      const tenantHeaders = getTenantHeaders();
      
      await authenticatedDownload(
        `${baseUrl}/inventory/product-batches/${batchId}/coa?format=pdf`,
        {
          filename: `CoA_Batch_${batchId}.pdf`,
          headers: {
            Authorization: `Bearer ${token}`,
            ...tenantHeaders
          }
        }
      );
    } catch (error) {
      console.error("CoA download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const coa = coaQuery.data;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl rounded-[3rem] border-border/40 bg-background/95 p-0 backdrop-blur-3xl shadow-2xl">
        {/* Certificate Header */}
        <div className="relative overflow-hidden border-b border-border/10 px-10 py-8 bg-primary/5 rounded-t-[3rem]">
          <div className="absolute -right-8 -top-8 rotate-12 text-primary/5">
             <ScrollText className="h-40 w-40" />
          </div>
          
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-card shadow-lg border border-border/50">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black tracking-tighter">
                  {t("inventory.qa.coa_title", "Certificate of Analysis")}
                </DialogTitle>
                <DialogDescription className="text-sm font-bold opacity-60 uppercase tracking-widest mt-1">
                  {t("inventory.qa.batch_id", "Batch Reference")}: <span className="text-primary">#{coa?.batch.batch_number || batchId}</span>
                </DialogDescription>
                {coa?.batch.product_name ? (
                  <p className="mt-1 text-sm text-muted-foreground">{coa.batch.product_name}</p>
                ) : null}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-10 py-10 space-y-10">
          {coaQuery.isLoading ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
              <p className="text-sm font-bold text-muted-foreground animate-pulse">{t("inventory.qa.generating_report", "Generating compliance report...")}</p>
            </div>
          ) : coaQuery.isError ? (
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-rose-500 mb-4" />
              <p className="text-lg font-black text-rose-600">{t("inventory.qa.coa_failed", "Failed to retrieve CoA")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("inventory.qa.coa_failed_desc", "Please ensure quality results have been recorded for this batch.")}</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-3xl border border-border/40 bg-muted/20 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("inventory.qa.compliance_score", "Compliance Score")}</p>
                  <p className="text-4xl font-black tracking-tighter text-primary">{coa?.compliance.score}%</p>
                </div>
                <div className="rounded-3xl border border-border/40 bg-muted/20 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("inventory.qa.tests_badge", "Tests Conducted")}</p>
                  <p className="text-4xl font-black tracking-tighter">
                    {coa?.compliance.passed_tests} <span className="text-xl text-muted-foreground font-medium">/ {coa?.compliance.total_tests}</span>
                  </p>
                </div>
              </div>

              {(coa?.tested_by || coa?.tested_at || coa?.sample_size || coa?.notes) ? (
                <div className="grid gap-4 rounded-3xl border border-border/40 bg-muted/15 p-6 md:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <p><span className="font-bold">Tested By:</span> {coa?.tested_by || "-"}</p>
                    <p><span className="font-bold">Tested At:</span> {coa?.tested_at ? format(new Date(coa.tested_at), "PPP p") : "-"}</p>
                    <p><span className="font-bold">Sample Size:</span> {coa?.sample_size || "-"}</p>
                    <p><span className="font-bold">Release Decision:</span> {coa?.batch.release_decision || "-"}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-bold text-foreground">Lab Notes</p>
                    <p className="mt-2 whitespace-pre-wrap">{coa?.notes || "No notes recorded."}</p>
                  </div>
                </div>
              ) : null}

              {/* Status Banner */}
              <div className={`flex items-center gap-4 rounded-3xl p-6 border ${coa?.batch.qa_status === 'qa_passed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' : 'bg-rose-500/10 border-rose-500/30 text-rose-700'}`}>
                {coa?.batch.qa_status === 'qa_passed' ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 shrink-0" />
                    <div>
                      <p className="font-black text-xl tracking-tight">{t("inventory.qa.status_released", "Released for Dispatch")}</p>
                      <p className="text-sm font-medium opacity-80">{t("inventory.qa.status_released_desc", "This batch meets all microbiological and chemical safety standards.")}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 shrink-0" />
                    <div>
                      <p className="font-black text-xl tracking-tight">{t("inventory.qa.status_quarantined", "Batch Quarantined")}</p>
                      <p className="text-sm font-medium opacity-80">{t("inventory.qa.status_quarantined_desc", "Compliance failure detected. Batch cannot be released for sale.")}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Detailed Results */}
              <div className="space-y-6">
                {(coa?.compliance.stage_summary?.length ?? 0) > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {coa?.compliance.stage_summary.map((stage) => (
                      <div key={stage.stage} className="rounded-2xl border border-border/40 bg-muted/20 p-4">
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{stage.stage_label}</p>
                        <p className="mt-2 text-2xl font-black">{stage.passed_tests}/{stage.total_tests}</p>
                        <p className="text-xs text-muted-foreground">
                          {stage.failed_tests > 0
                            ? `${stage.failed_tests} failed`
                            : stage.pending_tests > 0
                              ? `${stage.pending_tests} pending`
                              : "all checks completed"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2">
                   <FlaskConical className="h-4 w-4" />
                   {t("inventory.qa.detailed_analysis", "Detailed Analysis")}
                </h3>
                <div className="grid gap-3">
                  {coa?.results.map((result, i) => (
                    <div key={i} className="group flex items-center justify-between rounded-[1.5rem] border border-border/40 bg-card p-4 transition-all hover:bg-muted/30">
                      <div className="space-y-0.5">
                        <p className="font-bold tracking-tight text-foreground">{result.test_name}</p>
                        {result.stage_label ? (
                          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">{result.stage_label}</p>
                        ) : null}
                        <p className="text-xs font-medium text-muted-foreground">{result.recorded_at ? format(new Date(result.recorded_at), "PPP p") : "-"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-mono font-black ${result.is_passed ? 'text-emerald-600' : 'text-rose-600'}`}>{result.test_value}</p>
                          <Badge variant="ghost" className="h-auto p-0 font-bold text-[11px] opacity-40 uppercase tracking-widest">{result.is_passed ? t("inventory.qa.pass", "Pass") : t("inventory.qa.fail", "Fail")}</Badge>
                        </div>
                        {result.is_passed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}
                      </div>
                    </div>
                  ))}
                  
                  {coa?.compliance.missing_tests.map((test, i) => (
                    <div key={`missing-${i}`} className="flex items-center justify-between rounded-[1.5rem] border border-dashed border-yellow-500/20 bg-yellow-500/5 p-4">
                      <div className="space-y-0.5 opacity-60">
                        <p className="font-bold tracking-tight text-yellow-800/80">{test}</p>
                        <p className="text-[11px] font-black uppercase tracking-widest text-yellow-600/60">{t("inventory.qa.missing", "Missing Test")}</p>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-yellow-500/50" />
                    </div>
                  ))}

                  {coa?.compliance.mandatory_failures.map((test, i) => (
                    <div key={`failure-${i}`} className="flex items-center justify-between rounded-[1.5rem] border border-dashed border-rose-500/20 bg-rose-500/5 p-4">
                      <div className="space-y-0.5 opacity-80">
                        <p className="font-bold tracking-tight text-rose-700">{test}</p>
                        <p className="text-[11px] font-black uppercase tracking-widest text-rose-600/70">Mandatory failure</p>
                      </div>
                      <XCircle className="h-5 w-5 text-rose-500/70" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer with Actions */}
        <DialogFooter className="px-10 py-8 bg-muted/20 border-t border-border/10 rounded-b-[3rem]">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="rounded-full px-8 font-bold text-muted-foreground hover:bg-white transition-all shadow-sm"
          >
            {t("inventory.common.close", "Close Review")}
          </Button>
          <Button 
            className="rounded-full bg-primary px-8 font-black tracking-tight shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            disabled={coaQuery.isLoading || coaQuery.isError || isDownloading}
            onClick={handleDownload}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isDownloading ? t("inventory.common.downloading", "Downloading...") : t("inventory.qa.download_btn", "Download PDF CoA")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
