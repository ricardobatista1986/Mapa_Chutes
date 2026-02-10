import { ShotData } from "../types";

/**
 * Parses numeric values safely, handling commas/decimals and mixed separators.
 */
export const parseNum = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  
  // Convert to string and trim
  let s = String(val).trim();
  
  // Replace comma with dot
  s = s.replace(',', '.');

  // Handle multiple dots (keep last one)
  const parts = s.split('.');
  if (parts.length > 2) {
    const decimal = parts.pop();
    const integer = parts.join('');
    s = integer + '.' + decimal;
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// Mapping for standardizing team names across columns
const TEAM_ALIASES: Record<string, string> = {
  "Red Bull Bragantino": "RB Bragantino",
  "Athletico Paranaense": "Athletico-PR",
  "Atlético Mineiro": "Atlético-MG",
  "Atlético Goianiense": "Atlético-GO",
  "America Mineiro": "América-MG",
  "América Mineiro": "América-MG",
  "Vasco da Gama": "Vasco",
  "Botafogo FR": "Botafogo"
};

/**
 * Processes the raw JSON from XLSX into structured ShotData.
 */
export const processRawJson = (rawJson: any[]): ShotData[] => {
  return rawJson
    .filter(row => {
      // STRICT FILTER: Ignore formula lines or ghost headers
      const playerName = row.playerName || row.jogador || row.fullName || "";
      const matchId = row.matchId?.toString().trim();
      return playerName.length > 2 && matchId && matchId !== "0" && matchId !== "NaN";
    })
    .map((row, index) => {
      const findVal = (aliases: string[]) => {
        const key = Object.keys(row).find(k => {
          const cleanK = k.toString().trim().toLowerCase();
          return aliases.some(a => a.toLowerCase() === cleanK);
        });
        return key ? row[key] : null;
      };

      let onGoal = { x: null as number | null, y: null as number | null };
      const rawOnGoal = findVal(['onGoalShot', 'on_goal_shot']);
      
      if (rawOnGoal) {
        try {
          const parsed = typeof rawOnGoal === 'string' 
            ? JSON.parse(rawOnGoal.replace(/'/g, '"')) 
            : rawOnGoal;
          onGoal.x = parseNum(parsed.x); 
          onGoal.y = parseNum(parsed.y); 
        } catch (e) {
          onGoal.x = parseNum(findVal(['onGoalX', 'goalCrossedY']));
          onGoal.y = parseNum(findVal(['onGoalY', 'goalCrossedZ']));
        }
      }

      // Format rodada to have leading zero if it's a single digit number (1-9 -> 01-09)
      let rodada = findVal(['Rodada', 'round']);
      if (rodada !== null && rodada !== undefined) {
        const rInt = parseInt(String(rodada), 10);
        if (!isNaN(rInt)) {
          // If < 10, pad with 0 (e.g., 1 -> 01), otherwise keep as string (e.g., 10 -> 10)
          rodada = rInt < 10 ? `0${rInt}` : `${rInt}`;
        }
      }

      // Normalization of Team Names
      let homeTeam = findVal(['homeTeam', 'mandante']) || "Mandante";
      let awayTeam = findVal(['awayTeam', 'visitante']) || "Visitante";
      let team = findVal(['Team', 'teamName', 'equipe']);

      // Apply aliases
      homeTeam = TEAM_ALIASES[homeTeam] || homeTeam;
      awayTeam = TEAM_ALIASES[awayTeam] || awayTeam;
      if (team) team = TEAM_ALIASES[team] || team;

      return {
        id: findVal(['id']) || index,
        matchId: findVal(['matchId'])?.toString(),
        rodada: rodada,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        team: team,
        playerName: findVal(['playerName', 'fullName', 'jogador']),
        x: parseNum(findVal(['x'])),
        y: parseNum(findVal(['y'])),
        min: parseNum(findVal(['min', 'minuto'])),
        xG: parseNum(findVal(['expectedGoals', 'xG'])),
        xGOT: parseNum(findVal(['expectedGoalsOnTarget', 'xGOT', 'xgot'])),
        eventType: (findVal(['eventType']) || "").toString().toLowerCase(),
        situation: (findVal(['situation', 'situação']) || "").toString().toLowerCase(),
        bodyPart: (findVal(['bodyPart', 'shotType', 'parteDoCorpo', 'part']) || "").toString(),
        onGoal: onGoal,
      };
    });
};