export interface ShotData {
  id: number | string;
  matchId?: string;
  rodada?: string | number;
  homeTeam: string;
  awayTeam: string;
  team: string;
  playerName: string;
  x: number;
  y: number;
  min: number;
  xG: number;
  xGOT: number;
  eventType: string;
  situation: string;
  bodyPart?: string;
  onGoal: {
    x: number | null;
    y: number | null;
  };
}

export interface StatsData {
  total: number;
  goals: number;
  xG: string;
  xGOT: string;
  placement: string;
  balance: string;
  accuracy: string;
}

export interface MatchOption {
  id: string;
  label: string;
}

export interface HeatZone {
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
  intensity: number;
  avgXG: number;
  totalXG: number;
  goals: number;
}

// Augment window to support the CDN loaded XLSX library
declare global {
  interface Window {
    XLSX: any;
  }
}