import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card } from './components/Card';
import * as Icons from './components/Icons';
import { processRawJson } from './utils/dataProcessor';
import { ShotData, HeatZone } from './types';

// Constants
const SPREADSHEET_ID = "1y9qrL1Rnr6CE-K2R_nTO1Ez2UPCXlaSkOZhesIiYIeY";
const YEARS = ["camp bras 2026", "2025", "2024", "2023"];

// --- COLOR PALETTE CONFIGURATION ---
const PALETTE = {
  // Brand / Action (Data Points)
  brand: '#00E0FF',      // "No Alvo" - Cyan Electric
  goal: '#D2FF00',       // "Gol" - Neon Volt (High Visibility)
  miss: '#FF4B6B',       // "Fora" - Vibrant Coral
  
  // UI Accents
  accent: '#58A6FF',     // Active Buttons / Links
  
  // Theme Colors (Modern UI Layers)
  bg: '#0B0E14',         // Main Background
  card: '#161B22',       // Surface (Cards)
  border: '#21262D',     // Borders (Subtle)
  
  // Text
  text: '#F0F6FC',       // Primary Text
  textMuted: '#8B949E',  // Secondary Text
  
  // Map Specifics
  mapContainer: '#0B0E14', // Match Main BG
  mapFill: '#161B22',      // Pitch color (Surface)
  mapLines: '#30363D',     // Lines (Slightly lighter than border for visibility)
  
  // Heatmap
  heatLow: '#4F46E5',    // Indigo
  heatHigh: '#FB22FF'    // Magenta Neon
};

// --- HELPER FUNCTIONS (Defined at top to avoid ReferenceError) ---
const formatStat = (val: number | string) => {
  if (typeof val === 'number') return val.toLocaleString('pt-BR');
  if (typeof val === 'string' && val.includes('%')) return val.replace('.', ',');
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(num) ? val : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (num: number | undefined | null, digits = 2) => {
  if (num === undefined || num === null || isNaN(num)) return "-";
  return num.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export default function App() {
  // State
  const [data, setData] = useState<ShotData[]>([]);
  const [selectedYear, setSelectedYear] = useState(YEARS[0]);
  const [dataSource, setDataSource] = useState<"drive" | "local">("drive"); 
  
  // Filters
  const [selectedTeam, setSelectedTeam] = useState(""); 
  const [selectedPlayer, setSelectedPlayer] = useState(""); 
  const [selectedMatch, setSelectedMatch] = useState("");
  
  // Penalty Mode: 'all' (default), 'none' (Sem Pênaltis), 'only' (Apenas Pênaltis)
  const [penaltyMode, setPenaltyMode] = useState<'all' | 'none' | 'only'>('all');

  const [categories, setCategories] = useState({ goal: true, target: true, miss: true });
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]); 
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  // Interaction State
  const [hoveredShot, setHoveredShot] = useState<ShotData | null>(null);
  const [detailsShot, setDetailsShot] = useState<ShotData | null>(null);
  const [selectedZone, setSelectedZone] = useState<HeatZone | null>(null);
  const [selectedTimelineBin, setSelectedTimelineBin] = useState<any | null>(null);
  const [hoveredZone, setHoveredZone] = useState<HeatZone | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const [loading, setLoading] = useState(false);
  const [libReady, setLibReady] = useState(false);
  const [error, setError] = useState("");

  // Load XLSX library dynamically
  useEffect(() => {
    if (window.XLSX) { 
      setLibReady(true); 
      return; 
    }
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setLibReady(true);
    script.onerror = () => setError("Failed to load Excel processing library.");
    document.head.appendChild(script);
  }, []);

  // Fetch Data
  const fetchDriveData = useCallback(async (year: string) => {
    setLoading(true);
    setError("");
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(year)}&t=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch data from Google Drive.");
      
      const csvText = await response.text();
      const XLSX = window.XLSX;
      if (!XLSX) throw new Error("Excel processor not loaded.");

      const wb = XLSX.read(csvText, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(ws);
      
      const processed = processRawJson(rawJson);
      setData(processed);
      setSelectedTeam("");
      setSelectedPlayer("");
      setSelectedMatch("");
    } catch (err: any) {
      setError(err.message || "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (libReady && dataSource === "drive") {
      fetchDriveData(selectedYear);
    }
  }, [libReady, fetchDriveData, selectedYear, dataSource]);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !window.XLSX) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const XLSX = window.XLSX;
        const bData = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(bData, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(ws);
        const processed = processRawJson(rawJson);
        setData(processed);
        setDataSource("local");
      } catch (err) {
        setError("Error reading local file.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(prev + delta, 1), 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1 || showHeatmap) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleResetView = () => { setZoomLevel(1); setPan({ x: 0, y: 0 }); };

  // --- Coordinated Filters ---
  
  // 1. Teams: Filtered by Player, Match AND Penalty Mode
  const teams = useMemo(() => {
    const validData = data.filter(d => {
      if (selectedPlayer !== "" && d.playerName !== selectedPlayer) return false;
      if (selectedMatch !== "" && d.matchId?.toString() !== selectedMatch) return false;
      
      // Apply Penalty Logic to Filter Options
      const isPenalty = d.situation.includes('penalty');
      if (penaltyMode === 'none' && isPenalty) return false;
      if (penaltyMode === 'only' && !isPenalty) return false;
      
      return true;
    });
    return [...new Set(validData.map(d => d.team))].filter(Boolean).sort();
  }, [data, selectedPlayer, selectedMatch, penaltyMode]);
  
  // 2. Players: Filtered by Team, Match AND Penalty Mode
  const players = useMemo(() => {
    const validData = data.filter(d => {
      if (selectedTeam !== "" && d.team !== selectedTeam) return false;
      if (selectedMatch !== "" && d.matchId?.toString() !== selectedMatch) return false;
      
      // Apply Penalty Logic to Filter Options
      const isPenalty = d.situation.includes('penalty');
      if (penaltyMode === 'none' && isPenalty) return false;
      if (penaltyMode === 'only' && !isPenalty) return false;

      return true;
    });
    return [...new Set(validData.map(d => d.playerName))].filter(Boolean).sort();
  }, [data, selectedTeam, selectedMatch, penaltyMode]);

  // 3. Matches: Filtered by Team, Player AND Penalty Mode
  const matches = useMemo(() => {
    const validData = data.filter(d => {
      if (selectedTeam !== "" && d.team !== selectedTeam) return false;
      if (selectedPlayer !== "" && d.playerName !== selectedPlayer) return false;
      
      // Apply Penalty Logic to Filter Options
      const isPenalty = d.situation.includes('penalty');
      if (penaltyMode === 'none' && isPenalty) return false;
      if (penaltyMode === 'only' && !isPenalty) return false;

      return true;
    });
    const unique: { id: string, label: string }[] = [];
    const seen = new Set();
    validData.forEach(d => {
      if (d.matchId && !seen.has(d.matchId)) {
        seen.add(d.matchId);
        unique.push({ id: d.matchId.toString(), label: `${d.rodada || '?'} - ${d.homeTeam} x ${d.awayTeam}` });
      }
    });
    return unique.sort((a, b) => a.label.localeCompare(b.label));
  }, [data, selectedTeam, selectedPlayer, penaltyMode]);

  // Helper to clear filters
  const clearFilters = () => {
    setSelectedTeam("");
    setSelectedPlayer("");
    setSelectedMatch("");
  };
  const hasActiveFilters = selectedTeam !== "" || selectedPlayer !== "" || selectedMatch !== "";

  const filteredShots = useMemo(() => {
    return data.filter(d => {
      if (selectedTeam !== "" && d.team !== selectedTeam) return false;
      if (selectedPlayer !== "" && d.playerName !== selectedPlayer) return false;
      if (selectedMatch !== "" && d.matchId?.toString() !== selectedMatch) return false;
      
      // Penalty Logic
      const isPenalty = d.situation.includes('penalty');
      if (penaltyMode === 'none' && isPenalty) return false;
      if (penaltyMode === 'only' && !isPenalty) return false;

      if (d.min < timeRange[0] || d.min > timeRange[1]) return false;
      
      if (d.eventType === 'goal') return categories.goal;
      if (d.xGOT && d.xGOT > 0) return categories.target;
      return categories.miss;
    });
  }, [data, selectedTeam, selectedPlayer, selectedMatch, categories, penaltyMode, timeRange]);

  // --- Statistics ---
  const stats = useMemo(() => {
    const emptyStats = { total: 0, goals: 0, xG: "0.00", xGOT: "0.00", placement: "0.00", balance: "0.00", accuracy: "0%" };
    
    const calculate = (arr: ShotData[], totalBaseLength: number) => {
      if (arr.length === 0) return emptyStats;
      const goals = arr.filter(s => s.eventType === 'goal').length;
      const xG = arr.reduce((acc, s) => acc + (s.xG || 0), 0);
      const xGOT = arr.reduce((acc, s) => acc + (s.xGOT || 0), 0);
      const onTarget = arr.filter(s => s.xGOT && s.xGOT > 0).length;
      
      return {
        total: arr.length,
        goals,
        xG: xG.toFixed(2),
        xGOT: xGOT.toFixed(2),
        placement: (xGOT - xG).toFixed(2),
        balance: (goals - xG).toFixed(2),
        accuracy: totalBaseLength > 0 ? ((onTarget / totalBaseLength) * 100).toFixed(1) + '%' : '0%'
      };
    };

    if (!data || data.length === 0) return { base: emptyStats, current: emptyStats };

    const baseData = data.filter(d => {
      if (selectedTeam !== "" && d.team !== selectedTeam) return false;
      if (selectedPlayer !== "" && d.playerName !== selectedPlayer) return false;
      if (selectedMatch !== "" && d.matchId?.toString() !== selectedMatch) return false;
      
      // Penalty Logic (Applied to Base Data too)
      const isPenalty = d.situation.includes('penalty');
      if (penaltyMode === 'none' && isPenalty) return false;
      if (penaltyMode === 'only' && !isPenalty) return false;

      if (d.min < timeRange[0] || d.min > timeRange[1]) return false;
      return true;
    });

    const currentData = baseData.filter(d => {
      if (d.eventType === 'goal') return categories.goal;
      if (d.xGOT && d.xGOT > 0) return categories.target;
      return categories.miss;
    });

    return { base: calculate(baseData, baseData.length), current: calculate(currentData, baseData.length) };
  }, [data, selectedTeam, selectedPlayer, selectedMatch, penaltyMode, timeRange, categories]);

  // --- Heatmap Logic ---
  const heatZones = useMemo<HeatZone[]>(() => {
    if (!showHeatmap) return [];
    const zones: HeatZone[] = [];
    const stepX = 5.25; const stepY = 6.8;  
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        const xMin = 52.5 + (i * stepX); const xMax = xMin + stepX;
        const yMin = j * stepY; const yMax = yMin + stepY;
        const shotsInZone = filteredShots.filter(s => s.x >= xMin && s.x < xMax && s.y >= yMin && s.y < yMax);
        const count = shotsInZone.length;
        if (count > 0) {
          const totalXG = shotsInZone.reduce((acc, s) => acc + s.xG, 0);
          const goals = shotsInZone.filter(s => s.eventType === 'goal').length;
          zones.push({ x: xMin, y: yMin, w: stepX, h: stepY, count, intensity: 0, avgXG: totalXG / count, totalXG, goals });
        }
      }
    }
    const max = Math.max(...zones.map(z => z.count), 1);
    return zones.map(z => ({ ...z, intensity: z.count / max }));
  }, [filteredShots, showHeatmap]);

  // --- Timeline Data (Histogram) ---
  const timelineData = useMemo(() => {
    const start = timeRange[0];
    const end = timeRange[1];
    const duration = Math.max(end - start, 1);
    
    // Dynamic bin size adjustment
    let binSize = 1;
    if (duration > 90) binSize = 5;
    else if (duration > 45) binSize = 3;
    else if (duration > 20) binSize = 2;
    
    const bins = [];
    let maxVal = 0;

    for (let t = start; t < end; t += binSize) {
      const tNext = Math.min(t + binSize, end);
      const binShots = filteredShots.filter(s => s.min >= t && s.min < tNext);
      const xG = binShots.reduce((sum, s) => sum + s.xG, 0);
      const goals = binShots.filter(s => s.eventType === 'goal').length;
      
      bins.push({ t, tNext, xG, goals, count: binShots.length });
      if (xG > maxVal) maxVal = xG;
    }
    
    return { bins, maxVal: Math.max(maxVal, 0.5) }; 
  }, [filteredShots, timeRange]);

  const handlePointHover = (e: React.MouseEvent, shot: ShotData) => {
    if (!shot || hoveredShot?.id === shot.id) return;
    setHoveredShot(shot);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleZoneHover = (e: React.MouseEvent, zone: HeatZone) => {
    setHoveredZone(zone);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const aiInsight = useMemo(() => {
    const balance = parseFloat(stats.current.balance);
    const accuracy = parseFloat(stats.current.accuracy.replace('%', ''));
    let messages = [];

    if (balance > 0.5) messages.push("Desempenho ofensivo acima do esperado (Gols > xG).");
    else if (balance < -0.5) messages.push("Sub-performance nas finalizações (Gols < xG).");
    else messages.push("Conversão de gols alinhada com a probabilidade estatística.");

    if (accuracy > 40) messages.push("Alta precisão nos chutes ao gol.");
    else if (accuracy < 25) messages.push("Dificuldade em acertar o alvo nas finalizações.");

    if (filteredShots.some(s => s.xGOT > 0.7 && s.eventType !== 'goal')) messages.push("Goleiro adversário realizou defesas difíceis.");

    return messages.join(" ");
  }, [stats, filteredShots]);

  const statsList = [
    { label: 'Chutes', base: stats.base.total, cur: stats.current.total, Icon: Icons.BarChart },
    { label: 'Gols', base: stats.base.goals, cur: stats.current.goals, Icon: Icons.Trophy, color: PALETTE.goal },
    { label: 'xG Acumulado', base: stats.base.xG, cur: stats.current.xG, Icon: Icons.Target },
    { label: 'xGOT Acumulado', base: stats.base.xGOT, cur: stats.current.xGOT, color: PALETTE.brand, Icon: Icons.Target },
    { label: 'Valor Agregado (xGOT-xG)', base: stats.base.placement, cur: stats.current.placement, Icon: Icons.Sparkles, color: Number(stats.base.placement) >= 0 ? PALETTE.brand : PALETTE.miss },
    { label: 'Saldo (G-xG)', base: stats.base.balance, cur: stats.current.balance, Icon: Icons.ArrowSwap, color: Number(stats.base.balance) >= 0 ? '#10b981' : PALETTE.miss }
  ];

  // Helper styles
  const cardStyle = { backgroundColor: PALETTE.card, borderColor: PALETTE.border, color: PALETTE.text };
  const inputStyle = { backgroundColor: '#21262D', borderColor: PALETTE.border, color: PALETTE.text }; // Updated input style
  
  return (
    <div className="min-h-screen font-sans select-none overflow-x-hidden" style={{ backgroundColor: PALETTE.bg, color: PALETTE.text }}>
      
      {/* Detail Modal */}
      {detailsShot && (
        <div className="fixed inset-0 z-[150] backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setDetailsShot(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl relative" style={cardStyle} onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetailsShot(null)} className="absolute top-4 right-4 hover:opacity-70 transition-opacity p-2">
              <Icons.X size={20} />
            </button>
            <div className="mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: PALETTE.brand }}>{detailsShot.eventType}</span>
              <h2 className="text-2xl font-black uppercase italic leading-none mt-1" style={{ color: PALETTE.text }}>{detailsShot.playerName}</h2>
              <p className="text-xs font-bold uppercase mt-1" style={{ color: PALETTE.textMuted }}>{detailsShot.team}</p>
            </div>

            {/* Mini Goal Visualization */}
            {detailsShot.onGoal && detailsShot.onGoal.x !== null && (detailsShot.eventType === 'goal' || detailsShot.xGOT > 0) && (
              <div className="mb-5 relative rounded-xl border overflow-hidden shadow-lg p-3 bg-[#0B0E14]" style={{ borderColor: PALETTE.border }}>
                  <div className="relative w-full aspect-[7.32/2.44] mx-auto">
                        <div className="absolute top-0 bottom-0 left-[2px] w-[2px] bg-white/60 rounded-t-sm" />
                        <div className="absolute top-0 bottom-0 right-[2px] w-[2px] bg-white/60 rounded-t-sm" />
                        <div className="absolute top-0 left-[2px] right-[2px] h-[2px] bg-white/60 rounded-sm" />
                        
                        <svg viewBox="0 0 100 33.3" className="w-full h-full relative z-10 overflow-visible">
                          <defs>
                              <pattern id="net-modal" width="3" height="3" patternUnits="userSpaceOnUse">
                                  <path d="M 3 0 L 0 0 0 4" fill="none" stroke="#ffffff15" strokeWidth="0.1"/>
                              </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#net-modal)" />
                          
                          <circle 
                              cx={(detailsShot.onGoal.x! / 2) * 100} 
                              cy={33.3 - (detailsShot.onGoal.y! / 0.67) * 33.3} 
                              r={3.5} 
                              fill={detailsShot.eventType === 'goal' ? PALETTE.goal : PALETTE.brand}
                              stroke="#ffffff"
                              strokeWidth="0.8"
                              className="shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                          />
                        </svg>
                        
                        <div className="absolute bottom-0 left-[2px] right-[2px] h-[1px] bg-emerald-500/40" />
                  </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-2 italic" style={{ color: PALETTE.textMuted }}>Detalhes da Partida</p>
                <p className="text-sm font-bold">{detailsShot.rodada ? `Rodada ${detailsShot.rodada} - ` : ''}{detailsShot.homeTeam} x {detailsShot.awayTeam}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Icons.Clock size={12} className="opacity-70" />
                  <span className="text-xs font-mono opacity-70">{detailsShot.min}' min</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                    <p className="text-[8px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>Tipo</p>
                    <p className="text-xs font-bold capitalize truncate" title={detailsShot.situation}>{detailsShot.situation || "N/A"}</p>
                </div>
                <div className="p-2.5 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                    <p className="text-[8px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>Corpo</p>
                    <p className="text-xs font-bold capitalize truncate" title={detailsShot.bodyPart}>{detailsShot.bodyPart || "N/A"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>xG</p>
                   <p className="text-xl font-mono font-black">{formatNumber(detailsShot.xG)}</p>
                </div>
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>xGOT</p>
                   <p className={`text-xl font-mono font-black`} style={{ color: detailsShot.xGOT > 0 ? PALETTE.brand : PALETTE.textMuted }}>{detailsShot.xGOT > 0 ? formatNumber(detailsShot.xGOT) : '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone Detail Modal */}
      {selectedZone && (
        <div className="fixed inset-0 z-[150] backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setSelectedZone(null)}>
          <div className="border rounded-2xl p-6 w-full max-w-xs shadow-2xl relative" style={cardStyle} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedZone(null)} className="absolute top-4 right-4 hover:opacity-70 transition-opacity">
              <Icons.X size={20} />
            </button>
            <div className="mb-6 border-b pb-4" style={{ borderColor: PALETTE.border }}>
              <span className="text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2" style={{ color: PALETTE.heatHigh }}><Icons.Flame size={12}/> Análise de Zona</span>
              <h2 className="text-xl font-black uppercase italic leading-none mt-2">Dados da Região</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>Volume</p>
                   <p className="text-2xl font-mono font-black">{selectedZone.count}</p>
                </div>
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>Gols</p>
                   <p className="text-2xl font-mono font-black" style={{ color: PALETTE.goal }}>{selectedZone.goals}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                 <div className="flex justify-between items-end mb-1">
                   <p className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: PALETTE.textMuted }}>xG Acumulado</p>
                   <span className="text-xs font-mono font-bold" style={{ color: PALETTE.brand }}>{formatNumber(selectedZone.totalXG)}</span>
                 </div>
                 <div className="flex justify-between items-end border-t pt-2 mt-2" style={{ borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: PALETTE.textMuted }}>Média xG / Chute</p>
                   <span className="text-xs font-mono font-bold" style={{ color: PALETTE.textMuted }}>{formatNumber(selectedZone.avgXG, 3)}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Detail Modal */}
      {selectedTimelineBin && (
        <div className="fixed inset-0 z-[150] backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setSelectedTimelineBin(null)}>
          <div className="border rounded-2xl p-6 w-full max-w-xs shadow-2xl relative" style={cardStyle} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedTimelineBin(null)} className="absolute top-4 right-4 hover:opacity-70 transition-opacity">
              <Icons.X size={20} />
            </button>
            <div className="mb-6 border-b pb-4" style={{ borderColor: PALETTE.border }}>
              <span className="text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2" style={{ color: PALETTE.brand }}><Icons.Activity size={12}/> Análise Temporal</span>
              <h2 className="text-xl font-black uppercase italic leading-none mt-2">Janela: {selectedTimelineBin.t}' - {selectedTimelineBin.tNext}'</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>Gols</p>
                   <p className="text-2xl font-mono font-black" style={{ color: PALETTE.goal }}>{selectedTimelineBin.goals}</p>
                </div>
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest mb-1 italic" style={{ color: PALETTE.textMuted }}>xG Total</p>
                   <p className="text-2xl font-mono font-black" style={{ color: PALETTE.brand }}>{formatNumber(selectedTimelineBin.xG)}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                 <div className="flex justify-between items-end mb-1">
                   <p className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: PALETTE.textMuted }}>Saldo (Gols - xG)</p>
                   <span className={`text-lg font-mono font-black ${selectedTimelineBin.goals - selectedTimelineBin.xG >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {selectedTimelineBin.goals - selectedTimelineBin.xG > 0 ? '+' : ''}{formatNumber(selectedTimelineBin.goals - selectedTimelineBin.xG)}
                   </span>
                 </div>
              </div>
              <div className="p-3 rounded-xl border text-center" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderColor: PALETTE.border }}>
                   <p className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: PALETTE.textMuted }}>Volume de Chutes: <span className="text-white ml-1 text-xs">{selectedTimelineBin.count}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltips */}
      {hoveredShot && !detailsShot && !isDragging && (
        <div className="fixed z-[100] border p-3 rounded-lg shadow-2xl pointer-events-none transition-opacity duration-150" style={{ top: mousePos.y + 20, left: mousePos.x + 20, backgroundColor: PALETTE.card, borderColor: PALETTE.border, color: PALETTE.text }}>
          <p className="text-xs font-black uppercase tracking-tight">{hoveredShot.playerName}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-bold mt-1">
            <span className="uppercase font-black" style={{ color: PALETTE.textMuted }}>xG:</span>
            <span className="text-right">{formatNumber(hoveredShot.xG)}</span>
            {hoveredShot.xGOT > 0 && <><span className="uppercase font-black" style={{ color: PALETTE.textMuted }}>xGOT:</span><span className="text-right" style={{ color: PALETTE.brand }}>{formatNumber(hoveredShot.xGOT)}</span></>}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-6 border-b pb-6" style={{ borderColor: PALETTE.border }}>
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl shadow-lg" style={{ backgroundColor: PALETTE.brand, color: '#000', boxShadow: `0 10px 15px -3px ${PALETTE.brand}40` }}><Icons.Dashboard /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Scout Intelligence</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] mt-1 italic leading-none" style={{ color: PALETTE.textMuted }}>Mapa de Chutes Brasileirão</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-center">
          <div className="flex p-1 rounded-xl border items-center" style={{ backgroundColor: inputStyle.backgroundColor, borderColor: PALETTE.border }}>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent text-[10px] font-black uppercase px-4 py-1.5 outline-none cursor-pointer border-none focus:ring-0" style={{ color: PALETTE.brand }}>
              {YEARS.map(y => <option key={y} value={y}>{y.replace('camp bras ', '')}</option>)}
            </select>
            <button onClick={() => fetchDriveData(selectedYear)} className="p-2 transition-colors border-l" style={{ color: PALETTE.textMuted, borderColor: PALETTE.border }} title="Sync Now">
              <Icons.Refresh />
            </button>
            <button onClick={() => setDataSource("local")} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ml-1`} style={dataSource === "local" ? { backgroundColor: PALETTE.accent, color: '#fff' } : { color: PALETTE.textMuted }}>
              <Icons.Upload /> Local XLSX
            </button>
          </div>
          {dataSource === "local" && <input type="file" className="hidden" id="localXlsx" accept=".xlsx" onChange={handleFileUpload} />}
          {dataSource === "local" && (
             <label htmlFor="localXlsx" className="cursor-pointer text-xs underline decoration-slate-600 underline-offset-2" style={{ color: PALETTE.textMuted }}>Select File</label>
          )}
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto p-3 border border-rose-500/50 bg-rose-900/10 text-rose-500 text-xs font-bold mb-6 rounded-lg flex items-center gap-3">
            <Icons.Activity size={14} /> {error}
        </div>
      )}

      {data.length > 0 && (
        <div className="max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.5s_ease-out]">
          
          {/* Controls & Stats Bar */}
          <Card className="p-5 flex flex-col justify-center" style={cardStyle}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4 border-b pb-4" style={{ borderColor: PALETTE.border }}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase ml-1" style={{ color: PALETTE.textMuted }}>Equipe</label>
                  <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="rounded-lg px-3 py-1.5 text-xs font-bold outline-none min-w-[140px] border transition-colors" style={inputStyle}>
                    <option value="">Todas</option>
                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase ml-1" style={{ color: PALETTE.textMuted }}>Atleta</label>
                  <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} className="rounded-lg px-3 py-1.5 text-xs font-bold outline-none min-w-[140px] border transition-colors" style={inputStyle}>
                    <option value="">Todos</option>
                    {players.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase ml-1" style={{ color: PALETTE.textMuted }}>Partida</label>
                  <select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)} className="rounded-lg px-3 py-1.5 text-xs font-bold outline-none min-w-[180px] max-w-[220px] border transition-colors" style={inputStyle}>
                    <option value="">Todas</option>
                    {matches.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="p-2 mt-4 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition-all flex items-center justify-center" title="Limpar Filtros">
                    <Icons.X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-center mt-2 mb-5">
              {statsList.map((s, i) => (
                <div key={i} className="p-4 flex flex-col justify-between border rounded-xl transition-all shadow-inner group" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <s.Icon className="transition-colors" size={12} style={{ color: PALETTE.textMuted }} />
                    <p className="text-[8px] uppercase font-black tracking-widest leading-none italic" style={{ color: PALETTE.textMuted }}>{s.label}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black tracking-tighter leading-none">{formatStat(s.base)}</p>
                    <div className="flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-md w-fit mx-auto border" style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderColor: PALETTE.border }}>
                      <span className="text-[10px] font-bold uppercase tracking-tighter leading-none italic" style={{ color: PALETTE.textMuted }}>Sel:</span>
                      <span className={`text-sm font-black leading-none`} style={{ color: s.color || PALETTE.brand }}>{formatStat(s.cur)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4" style={{ borderColor: PALETTE.border }}>
              <div className="flex gap-2">
                {[ { id: 'goal', label: 'Gols', color: PALETTE.goal }, { id: 'target', label: 'No Alvo', color: PALETTE.brand }, { id: 'miss', label: 'Fora', color: PALETTE.miss } ].map(cat => (
                  <button key={cat.id} onClick={() => setCategories(prev => ({...prev, [cat.id]: !prev[cat.id as keyof typeof prev]}))} className={`px-4 py-1.5 rounded-xl border transition-all flex items-center gap-2`} style={categories[cat.id as keyof typeof categories] ? { backgroundColor: PALETTE.card, borderColor: PALETTE.accent, boxShadow: `0 0 10px ${PALETTE.accent}30` } : { backgroundColor: 'transparent', borderColor: 'transparent', opacity: 0.5 }}>
                      <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] font-black uppercase tracking-tighter italic leading-none" style={{ color: categories[cat.id as keyof typeof categories] ? PALETTE.text : PALETTE.textMuted }}>{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPenaltyMode(prev => prev === 'none' ? 'all' : 'none')}
                  className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-2`} 
                  style={penaltyMode === 'none' ? { backgroundColor: PALETTE.card, borderColor: PALETTE.accent, boxShadow: `0 0 10px ${PALETTE.accent}30`, color: PALETTE.text } : { backgroundColor: inputStyle.backgroundColor, borderColor: PALETTE.border, color: PALETTE.text }}
                >
                  <span className="text-[10px] font-black uppercase tracking-tighter italic leading-none">Sem Pênaltis</span>
                </button>

                <button 
                  onClick={() => setPenaltyMode(prev => prev === 'only' ? 'all' : 'only')}
                  className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-2`} 
                  style={penaltyMode === 'only' ? { backgroundColor: PALETTE.card, borderColor: PALETTE.accent, boxShadow: `0 0 10px ${PALETTE.accent}30`, color: PALETTE.text } : { backgroundColor: inputStyle.backgroundColor, borderColor: PALETTE.border, color: PALETTE.text }}
                >
                  <span className="text-[10px] font-black uppercase tracking-tighter italic leading-none">Apenas Pênaltis</span>
                </button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-center">
            {/* Pitch Map */}
            <div className="space-y-6">
              <Card className="p-6 relative" style={cardStyle}>
                <div className="flex items-center justify-between mb-6 border-b pb-4 font-black italic uppercase tracking-widest text-sm leading-none" style={{ borderColor: PALETTE.border }}>
                  <div className="flex items-center gap-3"><Icons.Shield size={18} /> Mapa de Chutes</div>
                  <div className="flex items-center gap-2">
                    {!showHeatmap && (
                      <div className="flex rounded-lg border p-0.5 mr-2" style={{ backgroundColor: inputStyle.backgroundColor, borderColor: PALETTE.border }}>
                        <button onClick={() => handleZoom(-0.5)} className="p-1.5 rounded transition-colors disabled:opacity-30 hover:bg-white/5" disabled={zoomLevel <= 1}><Icons.ZoomOut size={14}/></button>
                        <span className="text-[9px] font-mono flex items-center px-1 font-bold w-6 justify-center" style={{ color: PALETTE.brand }}>{zoomLevel}x</span>
                        <button onClick={() => handleZoom(0.5)} className="p-1.5 rounded transition-colors disabled:opacity-30 hover:bg-white/5" disabled={zoomLevel >= 4}><Icons.ZoomIn size={14}/></button>
                        {(zoomLevel > 1 || pan.x !== 0 || pan.y !== 0) && (
                          <button onClick={handleResetView} className="ml-1 p-1.5 rounded transition-colors border-l hover:bg-rose-500/10" style={{ color: PALETTE.miss, borderColor: PALETTE.border }} title="Reset Zoom & Pan"><Icons.Refresh size={12} /></button>
                        )}
                      </div>
                    )}
                    <button onClick={() => {setShowHeatmap(!showHeatmap); handleResetView();}} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all flex items-center gap-1.5 border`} style={showHeatmap ? { backgroundColor: PALETTE.heatHigh, borderColor: PALETTE.heatHigh, color: '#fff', boxShadow: `0 0 10px ${PALETTE.heatHigh}40` } : { backgroundColor: inputStyle.backgroundColor, borderColor: PALETTE.border, color: PALETTE.text }}>
                      <Icons.Flame size={12}/> Heatmap
                    </button>
                  </div>
                </div>
                
                <div 
                   className={`relative rounded-xl border overflow-hidden shadow-2xl ${zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
                   style={{ backgroundColor: PALETTE.mapContainer, borderColor: PALETTE.border }}
                   onMouseDown={handleMouseDown}
                   onMouseMove={handleMouseMove}
                   onMouseUp={handleMouseUp}
                   onMouseLeave={handleMouseUp}
                >
                  <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`, transformOrigin: 'center center', transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} className="w-full h-auto select-none">
                    <svg viewBox="52.5 0 52.5 68" className="w-full h-auto drop-shadow-2xl pointer-events-none" shapeRendering="geometricPrecision">
                      <rect x="52.5" y="0" width="52.5" height="68" fill={PALETTE.mapFill} />
                      
                      {/* Heatmap Layer */}
                      {showHeatmap && heatZones.map((zone, idx) => (
                        <rect 
                          key={`heat-${idx}`} x={zone.x} y={zone.y} width={zone.w} height={zone.h} 
                          fill={zone.intensity > 0.5 ? PALETTE.heatHigh : PALETTE.heatLow} 
                          fillOpacity={zone.intensity * 0.8} 
                          onClick={(e) => { if (!isDragging) { e.stopPropagation(); setSelectedZone(zone); } }}
                          onMouseEnter={(e) => handleZoneHover(e, zone)} onMouseLeave={() => setHoveredZone(null)}
                          className="pointer-events-auto cursor-pointer hover:brightness-125 transition-all duration-200"
                        />
                      ))}

                      {/* Lines */}
                      <g stroke={PALETTE.mapLines} strokeWidth={0.8 / zoomLevel} fill="none">
                        <line x1="105" y1="0" x2="105" y2="68" />
                        <line x1="52.5" y1="0" x2="105" y2="0" />
                        <line x1="52.5" y1="68" x2="105" y2="68" />
                        <line x1="52.5" y1="0" x2="52.5" y2="68" strokeDasharray={`${2/zoomLevel},${2/zoomLevel}`} />
                        <rect x="88.5" y="13.85" width="16.5" height="40.3" strokeWidth={0.5 / zoomLevel} />
                        <rect x="99.5" y="24.85" width="5.5" height="18.3" strokeWidth={0.5 / zoomLevel} />
                        <path d="M 88.5 25 A 9 9 0 0 0 88.5 43" strokeWidth={0.5 / zoomLevel} />
                      </g>
                      <circle cx="94" cy="34" r={0.6 / zoomLevel} fill={PALETTE.mapLines} />

                      {/* Shots Layer */}
                      {filteredShots.map((shot, idx) => {
                        if (showHeatmap) return null;
                        const isGoal = shot.eventType === 'goal';
                        const radius = Math.max(0.8, Math.sqrt(shot.xG) * 5);
                        
                        return (
                          <circle 
                            key={`pt-pitch-${shot.id}-${idx}`} 
                            cx={shot.x} cy={68 - shot.y} 
                            r={radius / Math.sqrt(zoomLevel)}
                            fill={isGoal ? PALETTE.goal : (shot.xGOT > 0 ? PALETTE.brand : PALETTE.miss)} 
                            fillOpacity={0.8} // Fixed opacity per requirement
                            stroke={shot.situation.includes('penalty') ? "#ffffff" : "#000000"} 
                            strokeWidth={0.2 / zoomLevel}
                            className="pointer-events-auto cursor-pointer hover:fill-white hover:stroke-white transition-colors duration-200"
                            onMouseEnter={(e) => !isDragging && handlePointHover(e, shot)} 
                            onMouseLeave={() => setHoveredShot(null)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { if(!isDragging) { e.stopPropagation(); setDetailsShot(shot); } }}
                          />
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </Card>
            </div>

            {/* Goal Map */}
            <div className="space-y-6 text-center">
              <Card className="p-6" style={cardStyle}>
                <div className="flex items-center justify-between mb-6 border-b pb-4 font-black italic tracking-widest text-sm uppercase leading-none" style={{ borderColor: PALETTE.border }}>
                  <div className="flex items-center gap-3"><Icons.Target size={20} style={{ color: PALETTE.brand }} /> Mapa de Chutes ao Gol</div>
                </div>
                <div className="relative p-6 rounded-xl border shadow-inner overflow-hidden" style={{ backgroundColor: PALETTE.mapContainer, borderColor: PALETTE.border }}>
                  <div className="relative mx-auto aspect-[7.32/2.44] w-full max-w-[480px]">
                    <div className="absolute bottom-[-1px] left-[-15%] right-[-15%] h-[1px] bg-emerald-500/50" />
                    <div className="absolute left-[-2px] top-0 bottom-0 w-[4.5px] bg-white rounded-t shadow-lg" />
                    <div className="absolute right-[-2px] top-0 bottom-0 w-[4.5px] bg-white rounded-t shadow-lg" />
                    <div className="absolute top-[-2px] left-[-2px] right-[-2px] h-[4.5px] bg-white rounded shadow-lg" />
                    <svg viewBox="0 0 100 33.3" className="w-full h-full overflow-visible relative">
                      <defs><pattern id="net" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M 3 0 L 0 0 0 4" fill="none" stroke="#ffffff08" strokeWidth="0.1"/></pattern></defs>
                      <rect width="100%" height="100%" fill="url(#net)" />
                      {filteredShots.filter(s => s.onGoal.x !== null && s.xGOT > 0).map((shot, idx) => {
                        const posX = (shot.onGoal.x! / 2) * 100;
                        const posY = 33.3 - (shot.onGoal.y! / 0.67) * 33.3;
                        const isGoal = shot.eventType === 'goal';
                        const radius = Math.max(1.5, Math.sqrt(shot.xGOT) * 6);
                        const isPenalty = shot.situation.includes('penalty');

                        return (
                          <g key={`goal-pt-${shot.id}-${idx}`}>
                            <circle cx={posX} cy={posY} r={radius} 
                                fill={isGoal ? PALETTE.goal : PALETTE.brand} fillOpacity={0.8}
                                stroke={isPenalty ? "#ffffff" : "#000000"} strokeWidth={0.2}
                                onMouseMove={(e) => handlePointHover(e, shot)} onMouseLeave={() => setHoveredShot(null)}
                                onClick={(e) => { e.stopPropagation(); setDetailsShot(shot); }}
                                className="cursor-pointer transition-colors duration-200 hover:fill-white hover:stroke-white"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </Card>

              {/* Execution Accuracy Bar */}
              <Card className="p-5 flex flex-col justify-center gap-4" style={{ backgroundColor: `${PALETTE.goal}05`, borderColor: PALETTE.border, color: PALETTE.text }}>
                <div className="flex items-center gap-2 mb-2 font-black italic tracking-widest uppercase text-[10px]" style={{ color: PALETTE.goal }}>
                  <Icons.Activity size={16} /> Precisão de Pontaria
                </div>
                <div className="space-y-4 text-center px-4 border-t pt-4" style={{ borderColor: `${PALETTE.goal}20` }}>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-1 leading-none italic" style={{ color: PALETTE.textMuted }}>
                    <span>On Target / Total Base</span>
                    <span className="text-base font-black leading-none" style={{ color: PALETTE.text }}>{stats.base.accuracy.replace('.', ',')}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden border shadow-inner" style={{ backgroundColor: '#0f172a', borderColor: PALETTE.border }}>
                    <div className="h-full transition-all duration-1000 ease-out" style={{ width: stats.base.accuracy, backgroundColor: PALETTE.brand }} />
                  </div>
                </div>
              </Card>

              {/* Time Range Slider */}
              <Card className="p-4" style={cardStyle}>
                <div className="flex justify-between items-center mb-3 text-[10px] font-black uppercase tracking-widest leading-none italic" style={{ color: PALETTE.textMuted }}>
                  <div className="flex items-center gap-1.5"><Icons.Clock size={12} /> Período da Partida</div>
                  <span className="px-2 py-0.5 rounded border font-mono italic tracking-tighter leading-none" style={{ backgroundColor: `${PALETTE.brand}10`, color: PALETTE.brand, borderColor: `${PALETTE.brand}20` }}>{timeRange[0]}' - {timeRange[1] >= 100 ? "90+'" : `${timeRange[1]}'`}</span>
                </div>
                <div className="relative h-1 rounded-full flex items-center group mt-2" style={{ backgroundColor: '#1e293b' }}>
                  <input type="range" min="0" max="100" value={timeRange[0]} onChange={(e) => setTimeRange([parseInt(e.target.value), timeRange[1]])} className="absolute w-full appearance-none bg-transparent pointer-events-none z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:cursor-pointer" style={{ '--thumb-color': PALETTE.brand } as any} />
                  <input type="range" min="0" max="100" value={timeRange[1]} onChange={(e) => setTimeRange([timeRange[0], parseInt(e.target.value)])} className="absolute w-full appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:cursor-pointer" style={{ '--thumb-color': PALETTE.brand } as any} />
                  <div className="absolute h-full rounded-full" style={{ left: `${timeRange[0]}%`, right: `${100 - timeRange[1]}%`, backgroundColor: `${PALETTE.brand}60` }} />
                </div>
              </Card>

              {/* Timeline Histogram (NEW) */}
              <Card className="p-4" style={cardStyle}>
                  <div className="flex justify-between items-center mb-4 border-b pb-2" style={{ borderColor: PALETTE.border }}>
                      <div className="flex items-center gap-2 font-black italic uppercase tracking-widest text-[10px]" style={{ color: PALETTE.textMuted }}>
                          <Icons.Activity size={12} /> Timeline de Ameaça (xG & Gols)
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-bold">
                           <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{backgroundColor: PALETTE.brand}}></div> xG</div>
                           <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{backgroundColor: PALETTE.goal}}></div> Gols</div>
                      </div>
                  </div>
                  
                  <div className="h-24 w-full relative select-none">
                      {timelineData.bins.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-[10px] italic opacity-50">Sem dados no período</div>
                      ) : (
                          <svg viewBox={`0 0 ${timelineData.bins.length * 10} 50`} preserveAspectRatio="none" className="w-full h-full">
                              {timelineData.bins.map((bin, i) => {
                                  const height = (bin.xG / timelineData.maxVal) * 45; 
                                  const barH = Math.max(height, 0.5); 
                                  const x = i * 10;
                                  const width = 8;
                                  
                                  return (
                                      <g key={i} className="group cursor-pointer" onClick={() => setSelectedTimelineBin(bin)}>
                                           <rect x={x} y="0" width={10} height="50" fill="transparent" />
                                           <rect 
                                              x={x + 1} 
                                              y={50 - barH} 
                                              width={width} 
                                              height={barH} 
                                              rx="2"
                                              fill={PALETTE.brand} 
                                              fillOpacity={0.6}
                                              className="transition-all duration-300 group-hover:fill-opacity-100 group-hover:fill-cyan-400"
                                           />
                                           {bin.goals > 0 && (
                                              <circle cx={x + 1 + width/2} cy={50 - barH - 3} r="2" fill={PALETTE.goal} stroke={PALETTE.bg} strokeWidth="0.5" className="animate-pulse" />
                                           )}
                                           <title>{`${bin.t}'-${bin.tNext}'`}</title>
                                      </g>
                                  );
                              })}
                          </svg>
                      )}
                  </div>
                  
                  {/* Dynamic Time Axis */}
                  <div className="relative h-4 w-full mt-2 select-none pointer-events-none">
                      {[0, 15, 30, 45, 60, 75, 90, 100].map((mark) => {
                          if (mark < timeRange[0] || mark > timeRange[1]) return null;
                          
                          const pos = ((mark - timeRange[0]) / (timeRange[1] - timeRange[0])) * 100;
                          let label = `${mark}'`;
                          if (mark === 100) label = "90+'";
                          
                          // Smart alignment to avoid cutting off edges
                          let alignClass = "-translate-x-1/2";
                          if (pos < 5) alignClass = "-translate-x-0";
                          if (pos > 95) alignClass = "-translate-x-full";

                          return (
                              <div key={mark} className={`absolute top-0 flex flex-col items-center ${alignClass}`} style={{ left: `${pos}%` }}>
                                  <div className="w-px h-1.5 bg-slate-500/50 mb-0.5" />
                                  <span className="text-[9px] font-mono font-bold text-slate-500 leading-none">{label}</span>
                              </div>
                          );
                      })}
                  </div>
              </Card>
            </div>
          </div>

          {/* AI Insights Box */}
          <Card className="p-6" style={cardStyle}>
             <div className="flex items-center gap-3 mb-4 font-black italic uppercase tracking-widest text-sm leading-none border-b pb-4" style={{ color: PALETTE.brand, borderColor: PALETTE.border }}>
                <Icons.Sparkles size={18} /> AI Scouting Insights
             </div>
             <div className="p-4 rounded-xl border flex items-start gap-4" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border }}>
                <div className="p-2 rounded-full mt-1" style={{ backgroundColor: `${PALETTE.brand}20`, color: PALETTE.brand }}>
                   <Icons.Activity size={20} />
                </div>
                <div>
                   <h3 className="text-sm font-bold uppercase italic mb-1" style={{ color: PALETTE.text }}>Análise de Performance</h3>
                   <p className="text-xs font-medium leading-relaxed" style={{ color: PALETTE.textMuted }}>{aiInsight}</p>
                </div>
             </div>
          </Card>

          {/* Detailed Log */}
          <Card style={cardStyle}>
            <div className="p-4 border-b flex items-center justify-between font-bold uppercase text-[10px] tracking-widest italic leading-none" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: PALETTE.border, color: PALETTE.textMuted }}>
              <div className="flex items-center gap-2 tracking-tighter leading-none italic">
                <Icons.BarChart size={14} /> Log Analítico de Lances
              </div>
              <span>{filteredShots.length} registros</span>
            </div>
            <div className="overflow-x-auto max-h-80 custom-scrollbar">
              <table className="w-full text-left text-[11px] border-collapse font-bold">
                <thead className="sticky top-0 z-10 font-black uppercase tracking-tighter border-b italic shadow-lg" style={{ backgroundColor: PALETTE.card, color: PALETTE.textMuted, borderColor: PALETTE.border }}>
                  <tr>
                    <th className="p-3 px-4 tracking-tighter">Atleta</th>
                    <th className="p-3 tracking-tighter">Equipe</th>
                    <th className="p-3 text-center font-black italic leading-none" style={{ color: PALETTE.brand }}>xG</th>
                    <th className="p-3 text-center font-black italic leading-none" style={{ color: PALETTE.brand }}>xGOT</th>
                    <th className="p-3 text-center">Minuto</th>
                    <th className="p-3 text-center">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {filteredShots.slice().reverse().map((s, i) => {
                    const isMiss = s.eventType === 'miss' || s.eventType === 'blocked';
                    return (
                      <tr key={i} className="transition-colors group cursor-default hover:bg-white/5" style={{ backgroundColor: 'transparent' }}>
                        <td className="p-3 px-4 transition-colors italic leading-none group-hover:text-white">{s.playerName}</td>
                        <td className="p-3 text-[9px] uppercase font-black tracking-widest leading-none" style={{ color: PALETTE.textMuted }}>{s.team}</td>
                        <td className="p-3 text-center font-mono leading-none" style={{ color: PALETTE.textMuted }}>{formatNumber(s.xG)}</td>
                        <td className="p-3 text-center font-mono leading-none" style={{ color: PALETTE.textMuted }}>{s.xGOT ? formatNumber(s.xGOT) : '-'}</td>
                        <td className="p-3 text-center font-mono italic leading-none" style={{ color: PALETTE.textMuted }}>{s.min}'</td>
                        <td className="p-3 uppercase font-black text-[9px] text-center tracking-tighter leading-none">
                          <span 
                            className="px-2 py-1 rounded"
                            style={{ 
                                color: isMiss ? PALETTE.miss : (s.eventType === 'goal' ? PALETTE.goal : PALETTE.brand),
                                backgroundColor: isMiss ? `${PALETTE.miss}15` : 'transparent' 
                            }}
                          >
                            {s.eventType}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 backdrop-blur-xl flex items-center justify-center z-[200]" style={{ backgroundColor: `${PALETTE.bg}E6` }}>
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 border-2 rounded-full animate-spin shadow-lg" style={{ borderColor: `${PALETTE.brand}40`, borderTopColor: PALETTE.brand, boxShadow: `0 0 15px ${PALETTE.brand}40` }} />
            <div className="text-center font-black">
              <p className="text-xl tracking-tighter animate-pulse uppercase leading-none mb-1 italic" style={{ color: PALETTE.brand }}>Processando Chutes</p>
              <p className="text-[10px] font-bold italic tracking-widest uppercase" style={{ color: PALETTE.textMuted }}>Validando Dados</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}