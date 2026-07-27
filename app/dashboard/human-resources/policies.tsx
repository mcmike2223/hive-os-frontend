"use client";

import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  CirclePlus,
  Download,
  FileText,
  FolderOpen,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { PdfViewer } from "@/components/ui/pdf-viewer";
import { authenticatedDownload } from "@/lib/authenticated-download";
import { getAuthHeaders, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { HrPolicy, hrFetch, hrUploadFetch } from "@/modules/humanresources/api";

const POLICY_FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";
const POLICY_FILE_DESCRIPTION = "PDF, Word (.doc/.docx), or Excel (.xls/.xlsx)";
const POLICY_FILE_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx"];

const CATEGORIES = [
  { id: "all", label: "All Policies" },
  { id: "conduct", label: "Conduct & Governance" },
  { id: "general", label: "General & Handbook" },
  { id: "it_security", label: "IT & Data Security" },
  { id: "benefits", label: "Health & Benefits" },
  { id: "safety", label: "Occupational Safety" },
  { id: "operations", label: "Operations & Travel" },
];

const CATEGORY_COLORS: Record<string, string> = {
  conduct:
    "border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200",
  general:
    "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200",
  it_security:
    "border-purple-700 bg-purple-50 text-purple-900 dark:border-purple-400 dark:bg-purple-950 dark:text-purple-200",
  benefits:
    "border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200",
  safety:
    "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-200",
  operations:
    "border-cyan-700 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-200",
};

type PolicyForm = {
  code: string;
  title: string;
  category: string;
  description: string;
  version: string;
  effective_date: string;
  is_active: boolean;
};

const EMPTY_FORM: PolicyForm = {
  code: "",
  title: "",
  category: "general",
  description: "",
  version: "1.0",
  effective_date: new Date().toISOString().slice(0, 10),
  is_active: true,
};

type PickedFile = {
  name?: string;
  original_name?: string;
  size?: number;
  mime_type?: string;
  media_details?: {
    public_url?: string;
    url?: string;
    name?: string;
    download_name?: string;
    size?: number;
    mime_type?: string;
  };
  url?: string;
  path?: string;
};

const extractPathFromUrl = (url: string | undefined | null) => {
  if (!url) return null;
  const storageIndex = url.indexOf("/storage/");
  if (storageIndex !== -1) {
    return url.substring(storageIndex + 9);
  }
  return url.replace(/^\/+/, "");
};

const isAllowedPolicyFile = (name: string) => {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return POLICY_FILE_EXTENSIONS.includes(extension);
};

export function HrPoliciesPanel({ canManage }: { canManage: boolean }) {
  const scopeKey = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<HrPolicy | null>(null);
  const [previewPolicy, setPreviewPolicy] = useState<HrPolicy | null>(null);
  const [downloadingPolicyId, setDownloadingPolicyId] = useState<number | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [managerFile, setManagerFile] = useState<{
    path: string;
    name: string;
    size?: number;
    mime_type?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  const { data: policies = [], isLoading } = useQuery<HrPolicy[]>({
    queryKey: ["hr-policies", scopeKey, categoryFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());
      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const payload = await hrFetch<HrPolicy[] | { data?: HrPolicy[] }>(
        `/policies${queryStr}`,
        { cache: "no-store" },
      );
      return Array.isArray(payload) ? payload : payload.data ?? [];
    },
  });

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setForm({
      ...EMPTY_FORM,
      code: `POL-${Math.floor(100 + Math.random() * 900)}`,
    });
    setFile(null);
    setManagerFile(null);
    setError("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (policy: HrPolicy) => {
    setEditingPolicy(policy);
    setForm({
      code: policy.code,
      title: policy.title,
      category: policy.category,
      description: policy.description ?? "",
      version: policy.version ?? "1.0",
      effective_date: policy.effective_date ?? new Date().toISOString().slice(0, 10),
      is_active: policy.is_active,
    });
    setFile(null);
    setManagerFile(null);
    setError("");
    setDialogOpen(true);
  };

  const handleSelectFromManager = (picked: PickedFile) => {
    const rawUrl = picked.media_details?.url || picked.url || picked.path;
    const path = picked.path || extractPathFromUrl(rawUrl) || rawUrl || "";
    const name =
      picked.original_name ||
      picked.media_details?.download_name ||
      picked.media_details?.name ||
      picked.name ||
      "";
    const mimeType = picked.mime_type || picked.media_details?.mime_type;
    const size = picked.size ?? picked.media_details?.size;

    if (!path) {
      toast.error("Could not determine file path from selection.");
      return;
    }
    if (!name || !isAllowedPolicyFile(name)) {
      toast.error(`Policy attachments must be ${POLICY_FILE_DESCRIPTION}.`);
      return;
    }

    setManagerFile({
      path,
      name,
      size,
      mime_type: mimeType,
    });
    setFile(null); // Reset direct local upload if picker is chosen
    setIsFileManagerOpen(false);
    toast.success(`Selected file from File Manager: ${name}`);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("code", form.code);
      formData.append("title", form.title);
      formData.append("category", form.category);
      formData.append("description", form.description);
      formData.append("version", form.version);
      formData.append("effective_date", form.effective_date);
      formData.append("is_active", form.is_active ? "1" : "0");

      if (file) {
        formData.append("file", file);
      } else if (managerFile) {
        formData.append("file_path", managerFile.path);
        formData.append("file_name", managerFile.name);
        if (managerFile.size) formData.append("file_size", String(managerFile.size));
        if (managerFile.mime_type) formData.append("mime_type", managerFile.mime_type);
      }

      if (editingPolicy) {
        formData.append("_method", "PUT");
        return hrUploadFetch<HrPolicy | { data: HrPolicy }>(
          `/policies/${editingPolicy.id}`,
          formData,
          "POST",
        );
      }
      return hrUploadFetch<HrPolicy | { data: HrPolicy }>("/policies", formData, "POST");
    },
    onSuccess: async (payload) => {
      const savedPolicy = "data" in payload ? payload.data : payload;

      await queryClient.invalidateQueries({
        queryKey: ["hr-policies"],
        refetchType: "active",
      });

      const normalizedSearch = search.trim().toLowerCase();
      const matchesCategory =
        categoryFilter === "all" || savedPolicy.category === categoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        [savedPolicy.title, savedPolicy.code, savedPolicy.description ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        );

      if (matchesCategory && matchesSearch) {
        queryClient.setQueryData<HrPolicy[]>(
          ["hr-policies", scopeKey, categoryFilter, search],
          (current) => {
            const withoutSaved = (current ?? []).filter(
              (policy) => policy.id !== savedPolicy.id,
            );
            return [savedPolicy, ...withoutSaved];
          },
        );
      }

      toast.success(editingPolicy ? "HR Policy updated." : "HR Policy published.");
      setDialogOpen(false);
      setFile(null);
      setManagerFile(null);
      setError("");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save HR policy.");
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrFetch(`/policies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("HR Policy deleted.");
      queryClient.invalidateQueries({ queryKey: ["hr-policies"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete HR policy.");
    },
  });

  const handlePolicyDialogOpenChange = (open: boolean) => {
    if (!open && isFileManagerOpen) {
      return;
    }
    setDialogOpen(open);
  };

  const isPdfPolicy = (policy: HrPolicy) =>
    policy.mime_type?.toLowerCase() === "application/pdf" ||
    policy.file_name?.toLowerCase().endsWith(".pdf") === true;

  const handlePolicyDownload = async (policy: HrPolicy) => {
    if (!policy.download_url) return;

    setDownloadingPolicyId(policy.id);
    try {
      await authenticatedDownload(policy.download_url, {
        filename: policy.file_name || `${policy.title}.document`,
        headers: getAuthHeaders(),
      });
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error
          ? downloadError.message
          : "The policy document could not be downloaded.",
      );
    } finally {
      setDownloadingPolicyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-300 dark:border-slate-600">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xl font-black text-foreground">
                <BookOpen className="h-6 w-6 text-amber-500 dark:text-amber-400" />
                HR Policies & Operating Manuals
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Manage organizational policies, codes of conduct, safety guidelines, and employee handbooks.
              </p>
            </div>
            {canManage && (
              <Button type="button" onClick={handleOpenCreate} className="h-11 font-bold">
                <CirclePlus className="mr-2 h-4 w-4" />
                Publish Policy
              </Button>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                    categoryFilter === cat.id
                      ? "bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="min-w-[240px] space-y-1.5">
              <Label htmlFor="policy-search" className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Search policies
              </Label>
              <div className="relative">
                <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
                <Input
                  id="policy-search"
                  type="search"
                  placeholder="Title, code, or description"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <Card className="border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
          <FileText className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No HR policies found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {search || categoryFilter !== "all"
              ? "No policies match your search filters."
              : "Publish organizational policies, handbooks, and compliance guidelines."}
          </p>
          {canManage && (
            <Button type="button" onClick={handleOpenCreate} className="mt-4">
              <CirclePlus className="mr-2 h-4 w-4" />
              Create First Policy
            </Button>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-500 bg-card shadow-sm dark:border-slate-400">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <caption className="sr-only">
              HR policies, effective dates, attached documents, publication status, and available actions.
            </caption>
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <tr>
                <th scope="col" className="px-4 py-3 font-black">Policy</th>
                <th scope="col" className="px-4 py-3 font-black">Category</th>
                <th scope="col" className="px-4 py-3 font-black">Version</th>
                <th scope="col" className="px-4 py-3 font-black">Effective date</th>
                <th scope="col" className="px-4 py-3 font-black">Document</th>
                <th scope="col" className="px-4 py-3 font-black">Status</th>
                {canManage && <th scope="col" className="px-4 py-3 text-right font-black">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {policies.map((policy) => (
                <tr key={policy.id} className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <th scope="row" className="min-w-[340px] max-w-xl px-4 py-4 font-normal">
                    <span className="block text-base font-black text-foreground">{policy.title}</span>
                    <span className="mt-1 block font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                      {policy.code.toUpperCase()}
                    </span>
                    {policy.description && (
                      <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {policy.description}
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider",
                        CATEGORY_COLORS[policy.category] ?? "border-slate-500 bg-slate-100 text-slate-900",
                      )}
                    >
                      {policy.category.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono font-bold text-slate-700 dark:text-slate-200">
                    v{policy.version}
                  </td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                    {policy.effective_date ?? "Not set"}
                  </td>
                  <td className="px-4 py-4">
                    {policy.download_url ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          isPdfPolicy(policy)
                            ? setPreviewPolicy(policy)
                            : void handlePolicyDownload(policy)
                        }
                        disabled={downloadingPolicyId === policy.id}
                        className="h-8 max-w-[200px] justify-start rounded-lg border-amber-700 px-3 text-xs font-bold text-amber-800 hover:bg-amber-50 hover:text-amber-950 dark:border-amber-400 dark:text-amber-200 dark:hover:bg-amber-950 dark:hover:text-amber-100"
                      >
                        {isPdfPolicy(policy) ? (
                          <FileText aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Download aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">
                          {downloadingPolicyId === policy.id
                            ? "Downloading..."
                            : isPdfPolicy(policy)
                              ? "View PDF"
                              : "Download"}
                        </span>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">No attachment</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                      policy.is_active
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200"
                        : "border-slate-500 bg-slate-100 text-slate-800 dark:border-slate-400 dark:bg-slate-900 dark:text-slate-200",
                    )}>
                      {policy.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(policy)}
                          className="min-h-11"
                        >
                          <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete policy "${policy.title}"?`)) {
                              deleteMutation.mutate(policy.id);
                            }
                          }}
                          className="min-h-11 border-red-600 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog for Publish / Edit HR Policy */}
      <Dialog open={dialogOpen} onOpenChange={handlePolicyDialogOpenChange}>
        <DialogContent
          className="max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (isFileManagerOpen) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit HR Policy" : "Publish HR Policy"}</DialogTitle>
            <DialogDescription>
              Create or update company policies, manuals, and compliance documentation.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="space-y-4"
          >
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                className="rounded-lg border border-red-600 bg-red-50 p-3 text-sm text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-100"
              >
                <p className="font-bold">The policy could not be saved.</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pol-code">Policy Code *</Label>
                <Input
                  id="pol-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pol-cat">Category *</Label>
                <select
                  id="pol-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pol-title">Policy Title *</Label>
              <Input
                id="pol-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pol-desc">Description / Summary</Label>
              <Textarea
                id="pol-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pol-ver">Version</Label>
                <Input
                  id="pol-ver"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pol-eff">Effective Date</Label>
                <Input
                  id="pol-eff"
                  type="date"
                  value={form.effective_date}
                  onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="text-sm font-bold text-foreground">Policy attachment document</p>
              <p id="policy-file-help" className="text-xs text-slate-600 dark:text-slate-300">
                Accepted formats: {POLICY_FILE_DESCRIPTION}. Maximum size: 10 MB.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFileManagerOpen(true)}
                  className="h-10 justify-start font-semibold text-slate-800 dark:text-slate-200"
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-amber-500" />
                  Select from File Manager
                </Button>

                {managerFile && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-50 p-2 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">Manager file selected: {managerFile.name}</span>
                  </div>
                )}

                <div className="relative flex items-center justify-center text-xs uppercase tracking-wider text-slate-400 my-1">
                  <span className="bg-background px-2">or upload file directly</span>
                </div>

                <Label htmlFor="pol-file">Upload policy document</Label>
                <Input
                  id="pol-file"
                  type="file"
                  accept={POLICY_FILE_ACCEPT}
                  aria-describedby="policy-file-help"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (!selected) {
                      setFile(null);
                      return;
                    }
                    if (!isAllowedPolicyFile(selected.name)) {
                      e.target.value = "";
                      setFile(null);
                      setError(`Policy attachment must be ${POLICY_FILE_DESCRIPTION}.`);
                      requestAnimationFrame(() => errorRef.current?.focus());
                      return;
                    }
                    setError("");
                    setFile(selected);
                    setManagerFile(null);
                  }}
                  className="h-10"
                />

                {editingPolicy?.file_name && !file && !managerFile && (
                  <p className="text-xs text-slate-500">Current file: {editingPolicy.file_name}</p>
                )}
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingPolicy ? "Update Policy" : "Publish Policy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewPolicy !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPolicy(null);
        }}
      >
        <DialogContent className="flex h-[95vh] w-[98vw] max-w-[98vw] sm:max-w-[98vw] flex-col gap-0 overflow-hidden border-slate-500 bg-background p-0 shadow-2xl dark:border-slate-400">
          <DialogHeader className="shrink-0 border-b border-slate-300 px-6 py-4 pr-14 text-left dark:border-slate-600">
            <DialogTitle>
              {previewPolicy ? `Policy PDF: ${previewPolicy.title}` : "Policy PDF"}
            </DialogTitle>
            <DialogDescription>
              Secure preview. Use the viewer toolbar to print, enlarge, or download this document.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-slate-100 p-2 dark:bg-slate-950 sm:p-3">
            {previewPolicy?.download_url ? (
              <PdfViewer
                src={previewPolicy.download_url}
                fetchUrl={previewPolicy.download_url}
                fetchHeaders={getAuthHeaders()}
                downloadUrl={previewPolicy.download_url}
                title={previewPolicy.file_name || `${previewPolicy.title}.pdf`}
                className="h-full min-h-0 w-full rounded-xl border-slate-500 dark:border-slate-400"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* File Manager Modal Dialog */}
      <Dialog open={isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
        <DialogContent className="flex h-[85vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-[2.5rem] border-border/50 bg-background p-0 shadow-2xl">
          <DialogTitle className="sr-only">Select Policy Document from File Manager</DialogTitle>
          <div className="z-10 flex shrink-0 flex-wrap items-center gap-4 border-b border-border/50 bg-card/60 px-6 py-5 backdrop-blur-xl sm:px-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 shadow-inner">
              <FileText aria-hidden="true" className="h-6 w-6 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black tracking-tight text-foreground">Select Policy Document</h2>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                Browse or upload {POLICY_FILE_DESCRIPTION} files only.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFileManagerOpen(false)}
              className="min-h-11"
            >
              Return to policy form
            </Button>
          </div>
          <div className="file-picker-wrapper relative flex-1 overflow-hidden bg-muted/10 p-4 sm:p-6">
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  .file-picker-wrapper > div > div:nth-child(1), .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; }
                  .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }
                `,
              }}
            />
            <FileManagerClient
              isPickerMode={true}
              onFileSelect={handleSelectFromManager}
              acceptedFileTypes={POLICY_FILE_ACCEPT}
              acceptedFileDescription={POLICY_FILE_DESCRIPTION}
              access={{
                canRead: true,
                canManage: true,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
