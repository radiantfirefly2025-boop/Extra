
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TodoItem, AIInsight, Priority } from './types';
import { getProductivityInsight } from './services/geminiService';

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(86400);
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    const saved = localStorage.getItem('tempo_todos');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTodo, setNewTodo] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [insight, setInsight] = useState<(AIInsight & { source: string }) | null>(() => {
    const saved = localStorage.getItem('tempo_last_insight');
    return saved ? { ...JSON.parse(saved), source: 'cache' } : null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [dateTime, setDateTime] = useState({ day: '', date: '' });
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => setWakeLockActive(false));
      } catch (err) {
        setWakeLockActive(false);
      }
    }
  }, []);

  const startAOD = async () => {
    setHasStarted(true);
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch (e) {}
    await requestWakeLock();
  };

  useEffect(() => {
    if ('getBattery' in navigator) {
      // @ts-ignore
      navigator.getBattery().then((bat: any) => {
        const update = () => setBattery({ level: Math.round(bat.level * 100), charging: bat.charging });
        update();
        bat.addEventListener('levelchange', update);
        bat.addEventListener('chargingchange', update);
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset({ x: Math.floor(Math.random() * 8) - 4, y: Math.floor(Math.random() * 8) - 4 });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hasStarted) return;
    const reLock = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    const fsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('visibilitychange', reLock);
    document.addEventListener('fullscreenchange', fsChange);
    return () => {
      document.removeEventListener('visibilitychange', reLock);
      document.removeEventListener('fullscreenchange', fsChange);
    };
  }, [hasStarted, requestWakeLock]);

  const calculateTime = useCallback(() => {
    const now = new Date();
    const remaining = 86400 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
    setDateTime({
      day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now).toUpperCase(),
      date: new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(now)
    });
    return remaining;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSecondsRemaining(calculateTime()), 1000);
    setSecondsRemaining(calculateTime());
    return () => clearInterval(timer);
  }, [calculateTime]);

  useEffect(() => {
    localStorage.setItem('tempo_todos', JSON.stringify(todos));
  }, [todos]);

  const fetchInsight = useCallback(async () => {
    const res = await getProductivityInsight(secondsRemaining, todos.filter(t => !t.completed).length);
    setInsight(res);
  }, [secondsRemaining, todos]);

  useEffect(() => {
    if (hasStarted) {
      fetchInsight();
      const interval = setInterval(fetchInsight, 3600000); // 1 hour fetch
      return () => clearInterval(interval);
    }
  }, [hasStarted, fetchInsight]);

  const sortedTodos = useMemo(() => {
    const weight = { high: 3, medium: 2, low: 1 };
    return [...todos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return weight[b.priority] - weight[a.priority] || b.createdAt - a.createdAt;
    });
  }, [todos]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos([{ id: crypto.randomUUID(), text: newTodo.trim(), completed: false, createdAt: Date.now(), priority: newPriority }, ...todos]);
    setNewTodo('');
  };

  if (!hasStarted) {
    return (
      <div onClick={startAOD} className="h-screen w-full bg-black flex flex-col items-center justify-center cursor-pointer p-6">
        <div className="text-zinc-500 animate-pulse mb-4 tracking-[0.3em] text-[10px] uppercase font-bold">TEMPO PWA v2</div>
        <div className="mono text-7xl text-white font-bold mb-4">{secondsRemaining}</div>
        <div className="bg-white/5 border border-white/10 px-8 py-5 rounded-2xl text-center max-w-xs transition-all hover:bg-white/10 active:scale-95 shadow-2xl">
          <p className="text-zinc-300 text-sm font-semibold">Initialize Immersive Clock</p>
          <p className="text-zinc-600 text-[9px] mt-2 leading-relaxed tracking-wider uppercase font-bold">
            Stay Awake • Offline Support • Stoic Insights
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black overflow-hidden relative selection:bg-white/10">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/10 to-transparent pointer-events-none"></div>

      <div 
        className={`flex-1 flex flex-col items-center justify-center p-8 transition-all duration-1000 ${isSidebarOpen ? 'md:pr-0' : ''}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <div className="text-center z-10">
          <div className="flex items-center justify-center gap-4 mb-6">
            <p className="text-zinc-600 font-bold tracking-[0.5em] text-[9px] uppercase">
              {dateTime.day} • {dateTime.date}
            </p>
            {battery && (
              <div className="flex items-center gap-1.5 text-zinc-700 text-[10px] font-black">
                <span className={battery.level < 20 ? 'text-red-900' : ''}>{battery.level}%</span>
                {battery.charging && <span className="text-green-900 animate-pulse">⚡</span>}
              </div>
            )}
          </div>
          
          <div className="relative inline-block px-4">
            <h1 className="mono text-[22vw] md:text-[14rem] font-bold tracking-tighter leading-none text-white drop-shadow-2xl transition-all">
              {secondsRemaining}
            </h1>
          </div>

          <div className="flex flex-col items-center gap-3 mt-10">
            <p className="text-zinc-800 font-black tracking-[0.3em] uppercase text-[9px]">Seconds Available</p>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-700 ${wakeLockActive ? 'border-green-500/20 bg-green-500/5 text-green-500' : 'border-zinc-900 text-zinc-800'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${wakeLockActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-900'}`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest">{wakeLockActive ? 'Stay Awake active' : 'Sleep-Safe mode'}</span>
              </div>
              {insight && (
                <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${insight.source === 'api' ? 'border-blue-900/30 text-blue-500' : 'border-zinc-900 text-zinc-700'}`}>
                  {insight.source}
                </div>
              )}
            </div>
          </div>

          {insight && !isSidebarOpen && (
            <div className="mt-16 max-w-sm mx-auto p-6 rounded-3xl border border-white/5 bg-white/[0.01] animate-in fade-in duration-1000">
              <p className="text-zinc-500 text-sm font-medium leading-relaxed italic">"{insight.tip}"</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-5 transition-opacity hover:opacity-100 opacity-10 z-30">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-5 rounded-3xl border transition-all ${isSidebarOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-zinc-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 18h8"/></svg>
          </button>
          <button 
            onClick={() => isFullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()}
            className={`p-5 rounded-3xl border transition-all ${isFullscreen ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-zinc-600 border-white/10'}`}
          >
            {isFullscreen ? 
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg> :
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
            }
          </button>
        </div>
      </div>

      <div className={`
        fixed md:relative top-0 right-0 h-full bg-black/98 md:bg-zinc-950/40 backdrop-blur-3xl border-l border-white/5 transition-all duration-500 ease-in-out z-40
        ${isSidebarOpen ? 'w-full md:w-96 translate-x-0' : 'translate-x-full md:w-0'}
      `}>
        <div className={`h-full flex flex-col p-10 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-[11px] font-black tracking-[0.5em] text-zinc-700 uppercase">Intentions</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-600 p-2 hover:bg-white/5 rounded-2xl transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <form onSubmit={addTodo} className="mb-10 space-y-5">
            <input 
              type="text" 
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Next milestone?"
              className="w-full bg-white/[0.03] border border-white/5 rounded-3xl py-5 px-6 text-sm focus:outline-none focus:border-white/10 transition-all text-white placeholder:text-zinc-800 font-medium"
            />
            <div className="flex gap-2 p-1.5 bg-white/[0.02] rounded-3xl border border-white/5">
              {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewPriority(p)}
                  className={`flex-1 py-2.5 text-[9px] uppercase font-black tracking-widest rounded-2xl transition-all ${
                    newPriority === p ? 'bg-white/10 text-white shadow-xl' : 'text-zinc-800 hover:text-zinc-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </form>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none pb-32">
            {todos.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 opacity-20">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Intentions set</p>
              </div>
            )}
            {sortedTodos.map(todo => (
              <div 
                key={todo.id}
                className={`group flex items-center gap-5 p-5 rounded-3xl border transition-all active:scale-[0.97] ${
                  todo.completed ? 'bg-black/40 border-white/5 opacity-20' : 'bg-white/[0.02] border-white/5'
                }`}
              >
                <button 
                  onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))}
                  className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                    todo.completed ? 'bg-zinc-800 border-zinc-700' : 'border-zinc-800'
                  }`}
                >
                  {todo.completed && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-zinc-400"><path d="M20 6 9 17l-5-5"/></svg>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${todo.completed ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{todo.text}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${todo.completed ? 'bg-zinc-900' : todo.priority === 'high' ? 'bg-red-900' : todo.priority === 'medium' ? 'bg-amber-900' : 'bg-zinc-800'}`}></div>
                    <span className="text-[9px] uppercase font-black text-zinc-800">{todo.priority} priority</span>
                  </div>
                </div>
                <button onClick={() => setTodos(todos.filter(t => t.id !== todo.id))} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-900 hover:text-red-950 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-10 border-t border-white/5">
             <div className="flex justify-between items-end mb-4 px-2">
               <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Momentum</span>
               <span className="text-xs font-mono text-zinc-500 font-bold">{todos.length > 0 ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) : 0}%</span>
             </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-zinc-800 transition-all duration-1000" 
                style={{ width: `${todos.length > 0 ? (todos.filter(t => t.completed).length / todos.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
