import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Edit3, Copy, Check, FileText, FolderOpen, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const translations = {
  en: {
    title: "Anime Garden",
    dashboard: "Trackers",
    history: "History",
    settings: "Settings",
    addTracker: "New Tracker",
    syncInterval: "Auto-sync active",
    subTarget: "Anime Name",
    mode: "Mode",
    lastSync: "Last Sync",
    actions: "Actions",
    noTrackers: "No trackers.",
    archiveMode: "Archive",
    monitorMode: "Monitor",
    autoTracking: "Auto",
    waiting: "Syncing...",
    newSub: "New Tracker",
    editSub: "Edit Tracker",
    configTracker: "Configure your tracker",
    animeTitle: "Anime Title",
    rssUrl: "RSS URL",
    keywords: "Keywords",
    downloadHist: "Download history",
    histDesc: "All existing items",
    monitorDesc: "Future only",
    discard: "Cancel",
    activate: "Activate",
    update: "Update",
    ariaStatus: "Downloader Settings",
    ariaRpc: "Internal RPC URL",
    ariaSecret: "RPC Secret",
    storage: "Download Path",
    selectFolder: "Select Folder",
    threads: "Max Threads",
    openAriaNg: "Web Monitor",
    saveSettings: "Save Settings",
    downloadStatus: "Status",
    episodeTitle: "Episode",
    timestamp: "Time",
    status_submitted: "Success",
    status_skipped: "Skipped",
    status_failed: "Failed",
    status_pending: "Wait",
    settingsSaved: "Settings saved!",
    connectionTip: "Using high-performance Rust core.",
    copyAll: "Copy All",
    exportTxt: "Export .txt",
    copied: "Copied!",
    clearHistory: "Clear History",
    confirmClear: "Clear all records?",
    systemInfo: "Desktop Pro",
    engineVersion: "App Version",
    nodeStatus: "Engine Status",
    online: "Online",
    saveError: "Save failed: "
  },
  cn: {
    title: "动漫花园",
    dashboard: "订阅列表",
    history: "下载历史",
    settings: "系统设置",
    addTracker: "添加追踪",
    syncInterval: "自动监控已开启",
    subTarget: "动画名称",
    mode: "模式",
    lastSync: "最后同步",
    actions: "操作",
    noTrackers: "暂无订阅。",
    archiveMode: "补完",
    monitorMode: "追踪",
    autoTracking: "自动",
    waiting: "同步中...",
    newSub: "添加订阅",
    editSub: "编辑订阅",
    configTracker: "配置规则",
    animeTitle: "动画名称",
    rssUrl: "RSS 链接",
    keywords: "关键字",
    downloadHist: "下载历史集数",
    histDesc: "下载所有匹配项",
    monitorDesc: "仅追踪新番",
    discard: "取消",
    activate: "激活",
    update: "更新",
    ariaStatus: "内置下载器设置",
    ariaRpc: "内部 RPC 地址",
    ariaSecret: "认证密钥",
    storage: "下载保存路径",
    selectFolder: "选择目录",
    threads: "最大并发线程",
    openAriaNg: "打开网页监控",
    saveSettings: "保存配置",
    downloadStatus: "状态",
    episodeTitle: "剧集名称",
    timestamp: "时间",
    status_submitted: "成功",
    status_skipped: "跳过",
    status_failed: "失败",
    status_pending: "等待",
    settingsSaved: "已保存！",
    connectionTip: "提示：桌面版使用内置 Rust 引擎解析与下载。",
    copyAll: "复制全部",
    exportTxt: "导出为 .txt",
    copied: "已复制",
    clearHistory: "清空历史",
    confirmClear: "确定要清空历史记录吗？",
    systemInfo: "桌面专业版",
    engineVersion: "系统版本",
    nodeStatus: "核心状态",
    online: "运行中",
    saveError: "保存失败："
  },
  jp: {
    title: "アニメガーデン",
    dashboard: "トラッカー",
    history: "履歴",
    settings: "設定",
    addTracker: "新規追加",
    syncInterval: "自動監視中",
    subTarget: "タイトル",
    mode: "モード",
    lastSync: "最終同期",
    actions: "操作",
    noTrackers: "なし。",
    archiveMode: "アーカイブ",
    monitorMode: "監視",
    autoTracking: "自動",
    waiting: "同期中...",
    newSub: "新規登録",
    editSub: "登録編集",
    configTracker: "設定",
    animeTitle: "タイトル",
    rssUrl: "RSS URL",
    keywords: "キーワード",
    downloadHist: "履歴取得",
    histDesc: "既存分も取得",
    monitorDesc: "今後の分のみ",
    discard: "キャンセル",
    activate: "有効化",
    update: "更新",
    ariaStatus: "ダウンロード設定",
    ariaRpc: "内部 RPC URL",
    ariaSecret: "トークン",
    storage: "保存先パス",
    selectFolder: "フォルダ選択",
    threads: "スレッド数",
    openAriaNg: "モニタ",
    saveSettings: "保存",
    downloadStatus: "状态",
    episodeTitle: "タイトル",
    timestamp: "日時",
    status_submitted: "成功",
    status_skipped: "スキップ",
    status_failed: "失敗",
    status_pending: "保留",
    settingsSaved: "保存完了！",
    connectionTip: "高性能Rustエンジンを使用中。",
    copyAll: "全コピー",
    exportTxt: ".txt出力",
    copied: "完了",
    clearHistory: "履歴をクリア",
    confirmClear: "全ての履歴を削除しますか？",
    systemInfo: "デスクトップ版",
    engineVersion: "バージョン",
    nodeStatus: "ステータス",
    online: "動作中",
    saveError: "保存に失敗しました："
  }
};

type Lang = 'en' | 'cn' | 'jp';
type View = 'dashboard' | 'history' | 'settings';

interface Subscription {
  id: number;
  name: string;
  url: string;
  is_active: boolean;
  download_history: boolean;
  last_checked_at?: string;
  filters?: { keyword: string, filter_type: string }[];
}

function Logo() {
  return (
    <div className="relative w-8 h-8 group">
      <svg viewBox="0 0 100 100" className="w-full h-full transition-transform duration-300 group-hover:scale-105">
        <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#4F46E5" /></linearGradient></defs>
        <rect width="100" height="100" rx="24" fill="url(#lg)" />
        <path d="M40 35 L70 50 L40 65 Z" fill="white" />
      </svg>
    </div>
  );
}

function App() {
  const queryClient = useQueryClient();
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'en');
  const [view, setView] = useState<View>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [newSub, setNewSub] = useState({ name: '', url: '', download_history: false, keywords: '' });
  const [editSettings, setEditSettings] = useState({ aria2_rpc_url: '', aria2_rpc_secret: '', download_path: '', max_threads: '5' });
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isBatchCopied, setIsBatchCopied] = useState(false);

  const t = translations[lang];
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);

  const { data: subscriptions } = useQuery({ queryKey: ['subscriptions'], queryFn: async () => await invoke("get_subscriptions"), enabled: view === 'dashboard' });
  const { data: historyList } = useQuery({ queryKey: ['history'], queryFn: async () => await invoke("get_history"), enabled: view === 'history' });
  const { data: appSettings } = useQuery({ queryKey: ['settings'], queryFn: async () => await invoke("get_settings"), enabled: view === 'settings' });

  useEffect(() => { if (appSettings) setEditSettings(appSettings as any); }, [appSettings]);

  const selectFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setEditSettings({ ...editSettings, download_path: selected as string });
  };

  const saveSettingsMutation = useMutation({ mutationFn: (data: typeof editSettings) => invoke("save_settings", { settings: data }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); alert(t.settingsSaved); } });
  
  const upsertMutation = useMutation({
    mutationFn: (sub: typeof newSub) => {
      const filters = sub.keywords ? sub.keywords.split(',').map(kw => ({ keyword: kw.trim(), filter_type: 'include' })) : [];
      const { keywords, ...rest } = sub;
      const payload = { ...rest, id: editId, filters };
      return invoke("upsert_subscription", { sub: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      closeModal();
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }), 1000);
    },
    onError: (err: any) => {
      alert(`${t.saveError}${err}`);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({id, active}: {id: number, active: boolean}) => invoke("toggle_subscription", { id, active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }), 1500);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke("delete_subscription", { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
  });
  const clearHistoryMutation = useMutation({
    mutationFn: () => invoke("clear_history"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] })
  });

  const openEdit = (sub: Subscription) => {
    setEditId(sub.id);
    setNewSub({
      name: sub.name,
      url: sub.url,
      download_history: sub.download_history,
      keywords: sub.filters?.map(f => f.keyword).join(', ') || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setNewSub({ name: '', url: '', download_history: false, keywords: '' });
  };

  const copyToClipboard = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text);
    if (typeof id === 'number') { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } else { setIsBatchCopied(true); setTimeout(() => setIsBatchCopied(false), 2000); }
  };

  const exportAsTxt = () => { if (!historyList) return; const content = (historyList as any[]).map((item: any) => item.magnet_link).join('\n'); const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `magnets.txt`; link.click(); };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-700 font-sans antialiased selection:bg-blue-100 h-screen flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0">
        <div onClick={() => setView('dashboard')} className="flex items-center gap-2.5 cursor-pointer group"><Logo /><div><h1 className="text-sm font-bold tracking-tight text-slate-900">{t.title}</h1><p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest leading-none">Desktop v1.5</p></div></div>
        <div className="flex items-center gap-4">
          <nav className="flex bg-slate-100 p-0.5 rounded-lg">{(['dashboard', 'history', 'settings'] as View[]).map((v) => (<button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t[v]}</button>))}</nav>
          <div className="flex bg-slate-100 p-0.5 rounded-lg">{(['en', 'cn', 'jp'] as Lang[]).map((l) => (<button key={l} onClick={() => setLang(l)} className={`w-7 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${lang === l ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{l}</button>))}</div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-300">
        {view === 'dashboard' && (
          <><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.dashboard}</h2><button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm active:scale-95 text-[12px]"><Plus size={16} strokeWidth={3} /> {t.addTracker}</button></div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"><table className="w-full text-left border-collapse text-[13px]"><thead className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[9px] font-bold uppercase tracking-wider"><tr><th className="px-6 py-3">{t.subTarget}</th><th className="px-6 py-3">{t.mode}</th><th className="px-6 py-3">{t.lastSync}</th><th className="px-6 py-3 text-right">{t.actions}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{(subscriptions as any[])?.map((sub: any) => (<tr key={sub.id} className={`hover:bg-slate-50/50 transition-colors group ${!sub.is_active ? 'opacity-50' : ''}`}><td className="px-6 py-4 font-semibold text-slate-800">{sub.name}<div className="text-[10px] text-slate-400 truncate max-w-xs font-normal mt-0.5">{sub.url}</div></td><td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${sub.download_history ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{sub.download_history ? t.archiveMode : t.monitorMode}</span></td><td className="px-6 py-4 text-[11px] text-slate-400 tabular-nums">{sub.last_checked_at || t.waiting}</td><td className="px-6 py-4 text-right"><div className="flex justify-end items-center gap-3"><label className="relative inline-flex items-center cursor-pointer scale-90"><input type="checkbox" className="sr-only peer" checked={sub.is_active} onChange={() => toggleMutation.mutate({id: sub.id, active: !sub.is_active})} /><div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div></label><button onClick={() => openEdit(sub)} className="p-1.5 text-slate-300 hover:text-blue-500 transition-all"><Edit3 size={16} /></button><button onClick={() => deleteMutation.mutate(sub.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button></div></td></tr>))}</tbody></table></div></>
        )}

        {view === 'history' && (
          <><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.history}</h2><div className="flex gap-2"><button onClick={() => { if(window.confirm(t.confirmClear)) clearHistoryMutation.mutate(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 font-bold text-[11px]"><Trash2 size={14}/> {t.clearHistory}</button><button onClick={() => copyToClipboard((historyList as any[])?.map((i:any) => i.magnet_link).join('\n') || '', 'batch')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all shadow-sm ${isBatchCopied ? 'bg-green-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{isBatchCopied ? <Check size={14}/> : <Copy size={14}/>} {isBatchCopied ? t.copied : t.copyAll}</button><button onClick={exportAsTxt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11px] transition-all shadow-sm"><FileText size={14}/> {t.exportTxt}</button></div></div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">{(historyList as any[])?.map((item: any) => (<div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 group"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${item.status === 'submitted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : item.status === 'skipped' ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{item.status}</span><span className="text-[10px] text-slate-300 tabular-nums">{item.created_at}</span></div><h3 className="text-[13px] font-semibold text-slate-700 truncate pr-4">{item.title}</h3></div><div className="flex items-center gap-2"><button onClick={() => copyToClipboard(item.magnet_link, item.id)} className={`p-2 rounded-lg transition-all ${copiedId === item.id ? 'bg-green-50 text-green-600' : 'text-slate-300 hover:bg-slate-100'}`}>{copiedId === item.id ? <Check size={14}/> : <Copy size={14}/>}</button></div></div>))}</div></>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl animate-in fade-in duration-500"><h2 className="text-xl font-bold text-slate-900 tracking-tight mb-6">{t.settings}</h2>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm"><Zap size={18} className="text-blue-600" /> {t.ariaStatus}</div>
                <div className="space-y-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.storage}</label>
                    <div className="flex gap-2"><input type="text" readOnly className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600" value={editSettings.download_path} /><button onClick={selectFolder} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center gap-2"><FolderOpen size={14}/> {t.selectFolder}</button></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.threads}</label><input type="number" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-xs" value={editSettings.max_threads} onChange={e => setEditSettings({...editSettings, max_threads: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.ariaSecret}</label><input type="password" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-xs" value={editSettings.aria2_rpc_secret} onChange={e => setEditSettings({...editSettings, aria2_rpc_secret: e.target.value})} /></div>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 flex gap-4"><button onClick={() => saveSettingsMutation.mutate(editSettings)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs shadow-sm transition-all">{t.saveSettings}</button></div>
              <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300"><div>{t.engineVersion}: v1.5.0-Desktop</div><div>{t.nodeStatus}: <span className="text-green-500">{t.online}</span></div></div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 p-6 space-y-6">
            <div className="flex justify-between items-center"><div><h3 className="font-bold text-xl text-slate-900">{editId ? t.editSub : t.newSub}</h3><p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">{t.configTracker}</p></div><button onClick={closeModal} className="text-slate-300 hover:text-slate-900 text-2xl">×</button></div>
            <div className="space-y-4">
              <div className="space-y-1.5"><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.animeTitle}</label><input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl outline-none font-semibold text-slate-800 text-sm" value={newSub.name} onChange={e => setNewSub({...newSub, name: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.rssUrl}</label><input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl outline-none font-semibold text-slate-800 text-[11px] font-mono" value={newSub.url} onChange={e => setNewSub({...newSub, url: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.keywords}</label><input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl outline-none font-semibold text-slate-800 text-sm" placeholder="简繁内封, 1080P" value={newSub.keywords} onChange={e => setNewSub({...newSub, keywords: e.target.value})} /></div>
            </div>
            {!editId && (<div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${newSub.download_history ? 'bg-orange-50/50 border-orange-100' : 'bg-blue-50/50 border-blue-100'}`} onClick={() => setNewSub({...newSub, download_history: !newSub.download_history})}><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 pointer-events-none" checked={newSub.download_history} readOnly /><div className="flex-1"><span className={`block text-xs font-bold uppercase ${newSub.download_history ? 'text-orange-900' : 'text-blue-900'}`}>{t.downloadHist}</span><p className="text-[10px] font-bold opacity-60 leading-none mt-1">{newSub.download_history ? t.histDesc : t.monitorDesc}</p></div></div>)}
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-50"><button onClick={closeModal} className="px-6 py-3 text-[11px] font-bold text-slate-400 hover:text-slate-700 uppercase tracking-widest">{t.discard}</button><button onClick={() => upsertMutation.mutate(newSub)} disabled={!newSub.name || !newSub.url || upsertMutation.isPending} className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-30 flex items-center gap-3 shadow-lg active:scale-95 transition-all hover:bg-blue-700">{upsertMutation.isPending && <Loader2 size={18} className="animate-spin" />} {editId ? t.update : t.activate}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
