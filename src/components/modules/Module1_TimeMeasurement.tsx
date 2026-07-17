'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { Play, Square, Timer, Save, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function Module1_TimeMeasurement() {
  const activeFile = useChartStore(s => s.activeFile());
  const updateTimeMeasurement = useChartStore(s => s.updateTimeMeasurement);

  // Stop watch state
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0); // in ms
  const [laps, setLaps] = useState<{ id: string; lapNumber: number; timeMs: number }[]>(() => {
    if (activeFile?.timeMeasurement?.laps) {
      return activeFile.timeMeasurement.laps.map(l => ({
        id: l.id,
        lapNumber: l.lapNumber,
        timeMs: l.timeSeconds * 1000,
      }));
    }
    return [];
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);

  // Stopwatch logic
  useEffect(() => {
    if (isRunning) {
      lastTickRef.current = Date.now() - time;
      timerRef.current = setInterval(() => {
        setTime(Date.now() - lastTickRef.current);
      }, 10);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, time]);

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      setIsRunning(true);
    }
  };

  const handleLap = () => {
    if (isRunning) {
      const prevLapsTotal = laps.reduce((acc, l) => acc + l.timeMs, 0);
      const lapTime = time - prevLapsTotal;
      setLaps([...laps, { id: uuidv4(), lapNumber: laps.length + 1, timeMs: lapTime }]);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
    setLaps([]);
  };

  // Calculations
  const lapTimesSeconds = laps.map(l => l.timeMs / 1000);
  const minTime = lapTimesSeconds.length > 0 ? Math.min(...lapTimesSeconds) : 0;
  const maxTime = lapTimesSeconds.length > 0 ? Math.max(...lapTimesSeconds) : 0;
  const avgTime = lapTimesSeconds.length > 0 ? lapTimesSeconds.reduce((a, b) => a + b, 0) / lapTimesSeconds.length : 0;
  const fluctuation = maxTime - minTime;
  const totalTime = time / 1000;

  const handleSaveToStore = () => {
    updateTimeMeasurement({
      laps: laps.map(l => ({ id: l.id, lapNumber: l.lapNumber, timeSeconds: l.timeMs / 1000 })),
      minTime: Number(minTime.toFixed(1)),
      maxTime: Number(maxTime.toFixed(1)),
      avgTime: Number(avgTime.toFixed(1)),
      fluctuation: Number(fluctuation.toFixed(1)),
      // takt time can be updated from another input if needed
    });
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const msParts = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${msParts.toString().padStart(2, '0')}`;
  };

  if (!activeFile) {
    return <div className="p-8 text-center text-slate-500">Please open a file from the sidebar to use Module 1.</div>;
  }

  return (
    <div className="flex-1 flex flex-col items-center bg-slate-50 min-h-screen p-8">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Module 1: Digital Time Measurement</h1>
            <p className="text-sm text-slate-500">Continuous Lapping UI for Standard Operation</p>
          </div>
          <button 
            onClick={handleSaveToStore}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Save size={18} />
            Save to Data Foundation
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stopwatch Section */}
          <div className="bg-slate-900 rounded-3xl p-8 flex flex-col items-center justify-center shadow-xl text-white">
            <div className="text-6xl font-mono mb-8 tabular-nums tracking-tight font-light">
              {formatTime(time)}
            </div>

            <div className="flex gap-4 mb-8">
              <button
                onClick={toggleTimer}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRunning ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                }`}
              >
                {isRunning ? <Square size={32} /> : <Play size={32} className="ml-1" />}
              </button>
              
              <button
                onClick={handleLap}
                disabled={!isRunning}
                className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 transition-all"
              >
                <Timer size={32} />
              </button>

              <button
                onClick={handleReset}
                className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all"
              >
                <RefreshCw size={28} />
              </button>
            </div>

            <div className="w-full">
              <h3 className="text-slate-400 font-semibold mb-3 border-b border-slate-800 pb-2">Recorded Laps</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {laps.slice().reverse().map((lap) => {
                  const isMin = minTime === lap.timeMs / 1000;
                  return (
                    <div key={lap.id} className={`flex justify-between items-center p-3 rounded-lg ${isMin ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
                      <span className="font-medium text-sm">Lap {lap.lapNumber}</span>
                      <span className="font-mono text-lg">{formatTime(lap.timeMs)}</span>
                    </div>
                  );
                })}
                {laps.length === 0 && (
                  <div className="text-center text-slate-600 py-4 italic">No laps recorded yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Timer className="text-blue-500" /> Auto-Calculation (Real-time)
            </h2>
            
            <div className="grid grid-cols-2 gap-4 flex-1">
              {/* Total Time */}
              <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Time</span>
                <span className="text-2xl font-mono text-slate-800 font-bold">{totalTime.toFixed(1)}s</span>
              </div>

              {/* Min Time */}
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-100 rounded-full transition-transform group-hover:scale-150 opacity-50"></div>
                <span className="text-emerald-700 font-bold text-sm relative z-10 flex items-center gap-1">
                  Min Time 
                  <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">Base</span>
                </span>
                <span className="text-3xl font-mono text-emerald-600 font-black mt-1 relative z-10">{minTime.toFixed(1)}s</span>
              </div>

              {/* Max Time */}
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex flex-col justify-center">
                <span className="text-rose-700 font-bold text-sm">Max Time</span>
                <span className="text-3xl font-mono text-rose-600 font-black mt-1">{maxTime.toFixed(1)}s</span>
              </div>

              {/* Avg Time */}
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col justify-center">
                <span className="text-blue-700 font-bold text-sm">Average Time</span>
                <span className="text-2xl font-mono text-blue-600 font-bold mt-1">{avgTime.toFixed(1)}s</span>
              </div>

              {/* Fluctuation */}
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col justify-center">
                <span className="text-amber-700 font-bold text-sm">Fluctuation</span>
                <span className="text-2xl font-mono text-amber-600 font-bold mt-1">{fluctuation.toFixed(1)}s</span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 leading-relaxed">
              <strong>Smart Selection:</strong> The lowest recorded cycle time (Min Time) will be automatically highlighted and forwarded to other modules as the benchmark for efficiency.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
