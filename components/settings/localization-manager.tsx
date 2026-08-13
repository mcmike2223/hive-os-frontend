"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useLocalization } from '@/store/use-localization';
import { useTranslation } from '@/store/use-translation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  HardDriveDownload, Plus, Search, Trash2, Edit3, 
  ArrowLeft, CheckCircle2, Globe, KeyRound, Loader2, FileJson, Folder, Bug
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';
import { SettingsPanelSkeleton } from "@/components/ui/loading-states";
import { getAccessToken, getBackendApiRoot } from "@/lib/runtime-context";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const getApiUrl = () => {
  return getBackendApiRoot();
};

export function LocalizationManager() {
  const { 
    languages, baseTranslations, targetTranslations, activeTargetCode, 
    isLoading, fetchLanguages, loadTargetLanguage, addLanguage, deleteLanguage, 
    saveTranslation, addSystemKey, deleteSystemKey, publish, setDefaultLanguage 
  } = useLocalization();

  const { t } = useTranslation();

  const [view, setView] = useState<'list' | 'editor'>('list');
  const [modals, setModals] = useState({ lang: false, key: false });
  const [form, setForm] = useState({ langName: '', langCode: '', group: 'global', key: '', value: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFileGroup, setActiveFileGroup] = useState<string>('All');

  // 🚀 FALLBACK STATE: Bypasses the store if the store is broken
  const [fallbackBase, setFallbackBase] = useState<Record<string, string>>({});
  const [fallbackTarget, setFallbackTarget] = useState<Record<string, string>>({});
  const [isFallbackLoading, setIsFallbackLoading] = useState(false);

  useEffect(() => { 
    fetchLanguages(); 
  }, [fetchLanguages]);

  // 🚀 BULLETPROOF LANGUAGE EXTRACTION (Fixed strict TS checking)
  const safeLanguages = Array.isArray(languages) ? languages : ((languages as any)?.data || []);
  const sourceLang = safeLanguages.find((l: any) => l.is_default) || safeLanguages[0];

  // 🚀 BULLETPROOF TRANSLATION PARSER
  // Intercepts empty arrays, nested objects, and paginated data to force a clean { key: value } dictionary
  const parseTranslations = (raw: any): Record<string, string> => {
    if (!raw) return {};
    
    // Handle array of objects [{key: 'foo', value: 'bar'}]
    if (Array.isArray(raw)) {
        const res: Record<string, string> = {};
        raw.forEach(item => { if (item?.key) res[item.key] = item.value || ''; });
        return res;
    }
    
    // Handle nested { data: ... }
    if (raw.data) {
        if (Array.isArray(raw.data)) {
            const res: Record<string, string> = {};
            raw.data.forEach((item: any) => { if (item?.key) res[item.key] = item.value || ''; });
            return res;
        }
        if (typeof raw.data === 'object') return raw.data;
    }
    
    // Handle flat object {"auth.login": "Login"}
    if (typeof raw === 'object') return raw;
    
    return {};
  };

  const actualBaseTranslations = useMemo(() => parseTranslations(baseTranslations), [baseTranslations]);
  const actualTargetTranslations = useMemo(() => parseTranslations(targetTranslations), [targetTranslations]);

  // 🚀 THE DIRECT FETCH OVERRIDE
  // If the store is empty, this reaches out to your backend directly and grabs the keys!
  useEffect(() => {
    if (view === 'editor' && activeTargetCode) {
        const manualFetch = async () => {
            setIsFallbackLoading(true);
            try {
                const token = getAccessToken();
                
                // Fetch Target Language
                const targetRes = await fetch(`${getApiUrl()}/localization/languages/${activeTargetCode}/translations`, { headers: { Authorization: `Bearer ${token}` }});
                const targetJson = await targetRes.json();
                setFallbackTarget(parseTranslations(targetJson));

                // Fetch Master Language (if they are different)
                if (sourceLang && sourceLang.code !== activeTargetCode) {
                    const baseRes = await fetch(`${getApiUrl()}/localization/languages/${sourceLang.code}/translations`, { headers: { Authorization: `Bearer ${token}` }});
                    const baseJson = await baseRes.json();
                    setFallbackBase(parseTranslations(baseJson));
                } else {
                    setFallbackBase(parseTranslations(targetJson));
                }
            } catch (err) {
                console.error("Fallback fetch failed", err);
            } finally {
                setIsFallbackLoading(false);
            }
        };
        manualFetch();
    }
  }, [view, activeTargetCode, sourceLang]);

  // Combine Keys from Store AND Fallback
  const finalBase = Object.keys(actualBaseTranslations).length > 0 ? actualBaseTranslations : fallbackBase;
  const finalTarget = Object.keys(actualTargetTranslations).length > 0 ? actualTargetTranslations : fallbackTarget;

  const allKeys = useMemo(() => {
    return Array.from(new Set([
      ...Object.keys(finalBase),
      ...Object.keys(finalTarget)
    ])).sort();
  }, [finalBase, finalTarget]);

  const fileGroups = useMemo(() => {
    const groups = new Set<string>();
    allKeys.forEach(k => {
      const parts = k.split('.');
      groups.add(parts.length > 1 ? parts[0] : 'global');
    });
    return ['All', ...Array.from(groups).sort()];
  }, [allKeys]);

  const handleAddKeySubmit = async () => {
    if (!form.key || !form.value) return toast.error(t('localization.toast_key_req', "Key and source text are required"));
    if (!form.group) return toast.error(t('localization.toast_group_req', "File group cannot be empty"));
    
    const safeGroup = form.group.trim().toLowerCase();
    const safeKey = form.key.trim().toLowerCase().replace(/\s+/g, '_');
    const fullKey = safeGroup === 'global' ? safeKey : `${safeGroup}.${safeKey}`;
    
    try {
      await addSystemKey(fullKey, form.value);
      toast.success(`${t('localization.toast_key_added', "Key added to")} ${safeGroup}.json.`);
      
      // Inject instantly into fallback UI to prevent needing a refresh
      setFallbackBase(prev => ({...prev, [fullKey]: form.value}));
      if (activeTargetCode === sourceLang?.code) {
          setFallbackTarget(prev => ({...prev, [fullKey]: form.value}));
      }

      setForm({ langName: '', langCode: '', group: 'global', key: '', value: '' });
      setModals({ ...modals, key: false });
    } catch (err: unknown) { 
      toast.error(getErrorMessage(err)); 
    }
  };

  const executeDeleteKey = async (key: string) => {
    try {
      await deleteSystemKey(key);
      toast.success(`'${key}' ${t('localization.toast_key_purged', 'purged.')}`);
      
      // Remove instantly from fallback UI
      const newBase = {...finalBase}; delete newBase[key]; setFallbackBase(newBase);
      const newTarget = {...finalTarget}; delete newTarget[key]; setFallbackTarget(newTarget);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const executeDeleteLanguage = async (code: string, name: string) => {
    try {
      await deleteLanguage(code);
      toast.success(`'${name}' ${t('localization.toast_lang_purged', 'completely purged from the system.')}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePublish = () => {
    toast.promise(publish(), { 
      loading: t('localization.toast_compiling', 'Compiling JSON Files...'), 
      success: t('localization.toast_published', 'Folders & Files Published Successfully!'), 
      error: t('localization.toast_failed', 'Compilation Failed') 
    });
  };

  // ==========================================
  // VIEW 1: LANGUAGE LIST
  // ==========================================
  if (view === 'list') {
    if (isLoading && safeLanguages.length === 0) {
      return <SettingsPanelSkeleton />;
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> {t('localization.title', 'Matrix Manager')}
          </h2>
          <Button onClick={handlePublish} className="rounded-xl shadow-lg">
            <HardDriveDownload className="h-4 w-4 mr-2" /> {t('localization.publish_project', 'Publish Project')}
          </Button>
        </div>

        <div className="border border-border/50 rounded-[2.5rem] bg-card overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-5 bg-muted/30 text-[11px] font-black uppercase text-muted-foreground border-b border-border/50 tracking-widest">
            <div className="col-span-6 pl-4">{t('localization.system_folders', 'System Language Folders')}</div>
            <div className="col-span-6 text-right pr-4">{t('global.actions', 'Actions')}</div>
          </div>
          <div className="divide-y divide-border/50">
            {(
              safeLanguages.map((lang: any) => (
                <div key={lang.code} className="grid grid-cols-12 items-center p-5 hover:bg-muted/5 transition-all">
                  <div className="col-span-6 flex items-center gap-4 pl-4">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase">
                      <Folder className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{lang.name} <span className="text-muted-foreground font-mono text-xs ml-1">(/{lang.code})</span></p>
                      {lang.is_default && <Badge className="bg-blue-600 hover:bg-blue-700 text-[11px] h-4 mt-1 tracking-widest border-none shadow-sm">{t('localization.master_source', 'MASTER SOURCE')}</Badge>}
                    </div>
                  </div>
                  <div className="col-span-6 flex justify-end gap-2 pr-4">
                    {!lang.is_default && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => setDefaultLanguage(lang.code)} className="hover:text-blue-600" title={t('localization.set_master', "Set as Master Source")}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" title={t('localization.purge_lang_tooltip', "Purge Language")}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem] bg-background/95 backdrop-blur-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('localization.purge_lang_title', 'Purge Language Matrix?')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('localization.purge_lang_desc', 'CRITICAL WARNING: Are you sure you want to completely purge the')} <strong>{lang.name}</strong> {t('localization.purge_lang_desc2', 'language matrix? This will destroy all translations and physical files for this language. This action cannot be undone.')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">{t('global.cancel', 'Cancel')}</AlertDialogCancel>
                              <AlertDialogAction 
                                className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
                                onClick={() => executeDeleteLanguage(lang.code, lang.name)}
                              >
                                {t('global.purge', 'Confirm Purge')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { loadTargetLanguage(lang.code); setView('editor'); }} className="text-primary hover:bg-primary/10" title={t('localization.edit_dict', "Edit Dictionary")}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <button onClick={() => setModals({ ...modals, lang: true })} className="w-full p-6 text-left text-xs text-primary hover:bg-primary/5 font-black flex items-center tracking-widest transition-all">
              <Plus className="h-4 w-4 mr-2" /> {t('localization.register_new', 'REGISTER NEW LANGUAGE FOLDER')}
            </button>
          </div>
        </div>

        {/* Add Language Modal */}
        {modals.lang && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md transition-all">
            <div className="bg-card w-full max-w-sm p-8 rounded-[3rem] shadow-2xl border border-border animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold mb-6 tracking-tight">{t('localization.create_lang', 'Create Language')}</h3>
              <div className="space-y-4 mb-8">
                <Input placeholder={t('localization.lang_name_placeholder', "Language Name (e.g. Amharic)")} value={form.langName} onChange={e => setForm({...form, langName: e.target.value})} className="h-12 rounded-2xl" />
                <Input placeholder={t('localization.iso_code_placeholder', "ISO Code (e.g. am)")} value={form.langCode} onChange={e => setForm({...form, langCode: e.target.value})} className="h-12 rounded-2xl" />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 h-12 rounded-2xl" onClick={() => { setModals({ ...modals, lang: false }); setForm({...form, langName: '', langCode: ''}); }}>{t('global.cancel', 'Cancel')}</Button>
                <Button className="flex-1 h-12 rounded-2xl shadow-md" onClick={() => { addLanguage(form.langName, form.langCode); setModals({ ...modals, lang: false }); }}>{t('localization.establish', 'Establish')}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: TRANSLATION EDITOR
  // ==========================================
  const filteredKeys = allKeys.filter(k => {
    const baseVal = String(finalBase[k] || '');
    const targetVal = String(finalTarget[k] || '');

    const matchesSearch = k.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          baseVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          targetVal.toLowerCase().includes(searchQuery.toLowerCase());
    
    const parts = k.split('.');
    const group = parts.length > 1 ? parts[0] : 'global';
    const matchesGroup = activeFileGroup === 'All' || group === activeFileGroup;

    return matchesSearch && matchesGroup;
  });

  return (
    <div className="space-y-4 animate-in slide-in-from-right-8 duration-500">
      
      <div className="flex items-center gap-4 bg-card border border-border/50 p-4 rounded-[2.5rem] shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => { setView('list'); setSearchQuery(''); }} className="rounded-full h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h3 className="font-bold text-sm">{safeLanguages.find((l: any) => l.code === activeTargetCode)?.name} {t('localization.node', 'Node')}</h3>
          <p className="text-[11px] text-muted-foreground uppercase font-black tracking-widest">{t('localization.folder', 'Folder:')} /{activeTargetCode}</p>
        </div>
        
        <div className="flex-1" />

        <div className="relative w-64 mr-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t('localization.filter_matrix', "Filter matrix...")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-2xl bg-muted/40 border-none h-10 text-xs" />
        </div>

        <Button 
          variant="outline" 
          onClick={handlePublish} 
          className="rounded-2xl h-10 px-4 font-bold text-xs uppercase tracking-tighter border-primary/20 text-primary hover:bg-primary/5 transition-transform active:scale-95 shadow-sm"
        >
          <HardDriveDownload className="h-4 w-4 mr-2" /> {t('localization.publish_btn', 'Publish')}
        </Button>

        <Button onClick={() => setModals({ ...modals, key: true })} className="rounded-2xl h-10 px-5 bg-primary text-primary-foreground shadow-md font-bold text-xs uppercase tracking-tighter transition-transform active:scale-95">
          <Plus className="h-4 w-4 mr-2" /> {t('localization.add_key_btn', 'Add Key')}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[650px]">
        {/* FILE SIDEBAR */}
        <div className="col-span-3 border border-border/50 rounded-[3rem] bg-card p-4 overflow-y-auto shadow-sm">
          <h4 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest mb-4 pl-2">{t('localization.json_files', 'JSON Files')}</h4>
          <div className="space-y-1">
            {fileGroups.map(group => (
              <button
                key={group}
                onClick={() => setActiveFileGroup(group)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-all ${activeFileGroup === group ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <FileJson className="h-4 w-4 shrink-0" /> 
                <span className="truncate">{group === 'All' ? t('localization.all_files', 'All Files') : `${group}.json`}</span>
              </button>
            ))}
          </div>
        </div>

        {/* EDITOR AREA */}
        <div className="col-span-9 border border-border/50 rounded-[3rem] bg-card overflow-hidden flex flex-col shadow-sm relative">
          
          {/* Fallback Loader Overlay */}
          {isFallbackLoading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          <div className="grid grid-cols-12 p-5 bg-muted/30 border-b border-border/50 text-[11px] font-black uppercase text-muted-foreground tracking-widest shrink-0">
            <div className="col-span-3 pl-4">{t('localization.system_id', 'System Identifier')}</div>
            <div className="col-span-4 text-center">{t('localization.master', 'Master')} ({sourceLang?.code})</div>
            <div className="col-span-5 text-right pr-6">{t('localization.entry', 'Entry')}</div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {filteredKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2 opacity-50">
                <FileJson className="h-10 w-10 mb-2" />
                <p className="text-sm font-medium">{t('localization.no_keys', 'No system keys found in this view')}</p>
                <p className="text-[11px] uppercase font-mono tracking-widest opacity-50 mt-2">
                  <Bug className="h-3 w-3 inline mr-1" /> DEBUG: Raw keys in memory: {allKeys.length}
                </p>
              </div>
            ) : (
              filteredKeys.map(key => {
                const displayKey = activeFileGroup !== 'All' ? key.split('.').slice(1).join('.') || key : key;
                return (
                  <div key={key} className="grid grid-cols-12 items-center p-3 rounded-[1.5rem] hover:bg-muted/20 group transition-all duration-200">
                    <div className="col-span-3 font-mono text-[11px] text-muted-foreground/70 truncate pl-2 pr-2" title={key}>
                      {displayKey}
                    </div>
                    <div className="col-span-4 text-[13px] font-semibold text-center px-4 leading-relaxed line-clamp-2" title={finalBase[key]}>
                      {finalBase[key] || <span className="text-muted-foreground/50 italic">Missing</span>}
                    </div>
                    <div className="col-span-5 relative">
                      <Input 
                        defaultValue={finalTarget[key] || ''} 
                        onBlur={(e) => {
                            saveTranslation(key, e.target.value);
                            // Manually update fallback state so UI stays synced
                            setFallbackTarget(prev => ({...prev, [key]: e.target.value}));
                        }}
                        placeholder={t('localization.input_string', "Input string...")}
                        className="h-11 text-sm rounded-2xl bg-background border-border/40 focus:ring-4 focus:ring-primary/5 transition-all shadow-sm pr-10"
                      />
                      {activeTargetCode === sourceLang?.code && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" size="icon" 
                              className="absolute right-1 top-1 h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              title={t('localization.purge_key_tooltip', "Purge Key")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem] bg-background/95 backdrop-blur-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('localization.purge_key_title', 'Purge System Key?')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('localization.purge_key_desc', 'Are you sure you want to permanently delete')} <strong>{key}</strong> {t('localization.purge_key_desc2', 'from the global system? This will remove it from all language matrices.')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">{t('global.cancel', 'Cancel')}</AlertDialogCancel>
                              <AlertDialogAction 
                                className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
                                onClick={() => executeDeleteKey(key)}
                              >
                                {t('global.purge', 'Confirm Purge')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Key Modal */}
      {modals.key && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-xl animate-in fade-in">
          <div className="bg-card w-full max-w-md p-10 rounded-[3.5rem] shadow-2xl border border-border animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 bg-primary/10 rounded-[1.25rem] flex items-center justify-center text-primary">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">{t('localization.add_key_title', 'Add Key to File')}</h3>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mt-0.5">{t('localization.global_sys_key', 'Global System Key')}</p>
              </div>
            </div>
            
            <div className="space-y-5 mb-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase ml-1 text-muted-foreground tracking-widest">{t('localization.file_name', 'File Name')}</label>
                  <Input placeholder={t('localization.file_name_placeholder', "e.g. auth")} value={form.group} onChange={e => setForm({...form, group: e.target.value})} className="h-14 rounded-2xl font-mono text-xs border-muted-foreground/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase ml-1 text-muted-foreground tracking-widest">{t('localization.key_name', 'Key Name')}</label>
                  <Input placeholder={t('localization.key_name_placeholder', "e.g. login_title")} value={form.key} onChange={e => setForm({...form, key: e.target.value})} className="h-14 rounded-2xl font-mono text-xs border-muted-foreground/20" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase ml-1 text-muted-foreground tracking-widest">{t('localization.master_value', 'Master Value')} ({sourceLang?.code})</label>
                <Input placeholder={t('localization.master_value_placeholder', "The text to translate...")} value={form.value} onChange={e => setForm({...form, value: e.target.value})} className="h-14 rounded-2xl text-sm border-muted-foreground/20" />
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => { setModals({ ...modals, key: false }); setForm({ ...form, key: '', value: '' }); }}>{t('localization.discard', 'Discard')}</Button>
              <Button className="flex-1 h-14 rounded-2xl shadow-xl font-bold bg-primary text-primary-foreground transition-transform active:scale-95" onClick={handleAddKeySubmit}>{t('localization.inject_key', 'Inject Key')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
