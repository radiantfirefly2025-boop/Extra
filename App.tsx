
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
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);
  const [dateTime, setDateTime] = useState({ day: '', date: '' });
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const wakeLockRef = useRef<any>(null);

  // Screen Wake Lock Logic with detailed error handling for Android
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLockActive(true);
        setWakeLockError(null);
        
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err: any) {
        console.warn(`WakeLock failed: ${err.name} - ${err.message}`);
        setWakeLockActive(false);
        if (err.name === 'NotAllowedError') {
          setWakeLockError("Permission Policy Restricted. Use browser settings to allow 'Wake Lock'.");
        }
      }
    }
  }, []);

  // Entry point for Android - must be a direct result of user interaction
  const startAOD = async () => {
    // 1. Mark as started
    setHasStarted(true);
    
    // 2. Request Fullscreen (Essential for Android AOD feel)
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen blocked");
    }

    // 3. Request Wake Lock immediately
    await requestWakeLock();
  };

  // Battery Status
  useEffect(() => {
    if ('getBattery' in navigator) {
      // @ts-ignore
      navigator.getBattery().then((bat: any) => {
        const updateBattery = () => {
          setBattery({ level: Math.round(bat.level * 100), charging: bat.charging });
        };
        updateBattery();
        bat.addEventListener('levelchange', updateBattery);
        bat.addEventListener('chargingchange', updateBattery);
      });
    }
  }, []);

  // Burn-in Protection: Shift pixels every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setOffset({
        x: Math.floor(Math.random() * 10) - 5,
        y: Math.floor(Math.random() * 10) - 5,
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasStarted) {
        requestWakeLock();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [hasStarted, requestWakeLock]);

  // Clock Logic
  const calculateSecondsRemaining = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const secondsSinceMidnight = (hours * 3600) + (minutes * 60) + seconds;
    const remaining = 86400 - secondsSinceMidnight;
    
    const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    setDateTime({
      day: dayFormatter.format(now).toUpperCase(),
      date: dateFormatter.format(now)
    });

    return remaining;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(calculateSecondsRemaining());
    }, 1000);
    setSecondsRemaining(calculateSecondsRemaining());
    return () => clearInterval(timer);
  }, [calculateSecondsRemaining]);

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
      const interval = setInterval(fetchInsight, 1800000);
      return () => clearInterval(interval);
    }
  }, [hasStarted, fetchInsight]);

  const sortedTodos = useMemo(() => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return [...todos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.priority !== b.priority) return priorityWeight[b.priority] - priorityWeight[a.priority];
      return b.createdAt - a.createdAt;
    });
  }, [todos]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos([{
      id: crypto.randomUUID(),
      text: newTodo.trim(),
      completed: false,
      createdAt: Date.now(),
      priority: newPriority
    }, ...todos]);
    setNewTodo('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        await requestWakeLock();
      } catch (e) {
        console.error("Manual toggle failed", e);
      }
    } else {
      document.exitFullscreen();
    }
  };

  if (!hasStarted) {
    return (
      <div 
        onClick={startAOD}
        className="h-screen w-full bg-black flex flex-col items-center justify-center cursor-pointer p-6"
      >
        <div className="text-zinc-500 animate-pulse mb-4 tracking-[0.3em] text-[10px] uppercase font-bold">Initializing AOD Mode</div>
        <div className="mono text-7xl text-white font-bold mb-4">{secondsRemaining}</div>
        <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl text-center max-w-xs transition-all hover:bg-white/10 active:scale-95">
          <p className="text-zinc-300 text-sm font-semibold">Tap to Start Experience</p>
          <p className="text-zinc-600 text-[10px] mt-2 leading-relaxed">
            Requests permission to stay awake and enter fullscreen for OLED protection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black overflow-hidden relative selection:bg-white/20">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/5 to-black pointer-events-none"></div>

      {/* Main Clock Section */}
      <div 
        className={`flex-1 flex flex-col items-center justify-center p-8 transition-all duration-1000 ${isSidebarOpen ? 'md:pr-0' : ''}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <div className="text-center z-10">
          <div className="flex items-center justify-center gap-4 mb-6">
            <p className="text-zinc-600 font-bold tracking-[0.4em] text-[10px] uppercase">
              {dateTime.day} • {dateTime.date}
            </p>
            {battery && (
              <div className="flex items-center gap-1 text-zinc-700 text-[10px] font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>
                {battery.level}% {battery.charging && '⚡'}
              </div>
            )}
          </div>
          
          <div className="relative inline-block">
            <h1 className="mono text-8xl sm:text-9xl md:text-[13rem] font-bold tracking-tighter leading-none text-white transition-all duration-300 select-none">
              {secondsRemaining}
            </h1>
          </div>

          <div className="flex flex-col items-center gap-3 mt-8">
            <p className="text-zinc-700 font-bold tracking-[0.2em] uppercase text-[9px] md:text-xs">
              Daily Seconds Countdown
            </p>
            
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 ${wakeLockActive ? 'border-green-500/20 bg-green-500/5 text-green-500' : 'border-zinc-800 text-zinc-700'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${wakeLockActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-800'}`}></div>
                <span className="text-[10px] font-bold uppercase tracking-widest">{wakeLockActive ? 'Always-On' : 'Sleep-Safe'}</span>
              </div>
              {wakeLockError && (
                <div className="text-red-900 text-[9px] font-bold bg-red-500/5 px-3 py-1 rounded-full border border-red-900/20 max-w-[200px] truncate">
                  {wakeLockError}
                </div>
              )}
            </div>
          </div>

          {insight && !isSidebarOpen && (
            <div className="mt-16 max-w-sm mx-auto p-5 rounded-2xl border border-white/5 bg-white/[0.01] animate-in fade-in zoom-in duration-1000">
              <p className="text-zinc-500 text-sm italic font-medium leading-relaxed">
                "{insight.tip}"
              </p>
            </div>
          )}
        </div>

        {/* Floating Controls */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 transition-opacity hover:opacity-100 opacity-10 z-30">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-4 rounded-2xl border transition-all ${isSidebarOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path x1="13" x2="21" y1="12" y2="12"/><path d="M13 18h8"/></svg>
          </button>
          <button 
            onClick={toggleFullscreen}
            className={`p-4 rounded-2xl border transition-all ${isFullscreen ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-zinc-500 border-white/10 hover:text-white'}`}
          >
            {isFullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar - Optimized for Android Scroll */}
      <div className={`
        fixed md:relative top-0 right-0 h-full bg-black/95 md:bg-zinc-950/20 backdrop-blur-3xl border-l border-white/5 transition-all duration-500 ease-in-out z-20
        ${isSidebarOpen ? 'w-full md:w-80 lg:w-96 translate-x-0' : 'translate-x-full md:w-0'}
      `}>
        <div className={`h-full flex flex-col p-8 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-[10px] font-black tracking-[0.4em] text-zinc-600 uppercase">Intentions</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-500 p-2 hover:bg-white/5 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <form onSubmit={addTodo} className="mb-10 space-y-4">
            <input 
              type="text" 
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="What must happen now?"
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-white/20 transition-all text-white placeholder:text-zinc-800 font-medium"
            />
            <div className="flex gap-2 p-1.5 bg-white/[0.02] rounded-2xl border border-white/5">
              {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewPriority(p)}
                  className={`flex-1 py-2 text-[9px] uppercase font-black tracking-widest rounded-xl transition-all ${
                    newPriority === p ? 'bg-white/10 text-white' : 'text-zinc-700 hover:text-zinc-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </form>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none pb-24">
            {sortedTodos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10 space-y-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                <p className="text-xs uppercase tracking-widest font-bold italic">Idle state detected</p>
              </div>
            ) : (
              sortedTodos.map(todo => (
                <div 
                  key={todo.id}
                  className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all active:scale-[0.98] ${
                    todo.completed ? 'bg-black/20 border-white/5 opacity-30' : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <button 
                    onClick={() => toggleTodo(todo.id)}
                    className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                      todo.completed ? 'bg-zinc-800 border-zinc-700' : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    {todo.completed && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M20 6 9 17l-5-5"/></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate transition-all ${todo.completed ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{todo.text}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${todo.completed ? 'bg-zinc-800' : todo.priority === 'high' ? 'bg-red-500' : todo.priority === 'medium' ? 'bg-amber-500' : 'bg-zinc-500'}`}></div>
                      <span className="text-[9px] uppercase font-black text-zinc-700">{todo.priority}</span>
                    </div>
                  </div>
                  <button onClick={() => removeTodo(todo.id)} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-800 hover:text-red-900 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-auto pt-8 border-t border-white/5 bg-black/50 backdrop-blur-md">
             <div className="flex justify-between items-end mb-3">
               <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Efficiency</span>
               <span className="text-xs font-mono text-zinc-400">{todos.length > 0 ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) : 0}%</span>
             </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-zinc-600 transition-all duration-1000 ease-out" 
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
