export function createDefaultTeamStats() {
  return {
    entries: 0,
    corners: 0,
    cornerGoals: 0,
    cornerEff: 0,
    strokes: 0,
    strokeGoals: 0,
    strokeEff: 0,
    fieldGoals: 0,
    goals: 0,
    conversion: 0,
    green: 0,
    yellow: 0,
    red: 0
  };
}

export function createDefaultQuarterMap() {
  return {
    1: { home: createDefaultTeamStats(), away: createDefaultTeamStats() },
    2: { home: createDefaultTeamStats(), away: createDefaultTeamStats() },
    3: { home: createDefaultTeamStats(), away: createDefaultTeamStats() },
    4: { home: createDefaultTeamStats(), away: createDefaultTeamStats() },
    total: { home: createDefaultTeamStats(), away: createDefaultTeamStats() }
  };
}

export function calculateQuarterStats(events = []) {
  const quarters = createDefaultQuarterMap();

  events.forEach(evt => {
    const q = [1, 2, 3, 4].includes(Number(evt.quarter)) ? Number(evt.quarter) : 1;
    const team = evt.team === 'away' ? 'away' : 'home';
    const qTeam = quarters[q][team];
    const totTeam = quarters.total[team];
    const type = evt.type;

    if (type === 'entry') {
      qTeam.entries++;
      totTeam.entries++;
    } else if (type === 'corner') {
      qTeam.corners++;
      totTeam.corners++;
    } else if (type === 'cornerGoal') {
      qTeam.cornerGoals++;
      totTeam.cornerGoals++;
      qTeam.goals++;
      totTeam.goals++;
    } else if (type === 'stroke') {
      qTeam.strokes++;
      totTeam.strokes++;
    } else if (type === 'strokeGoal') {
      qTeam.strokeGoals++;
      totTeam.strokeGoals++;
      qTeam.goals++;
      totTeam.goals++;
    } else if (type === 'fieldGoal') {
      qTeam.fieldGoals++;
      totTeam.fieldGoals++;
      qTeam.goals++;
      totTeam.goals++;
    } else if (type === 'green' || type === 'cardGreen') {
      qTeam.green++;
      totTeam.green++;
    } else if (type === 'yellow' || type === 'cardYellow') {
      qTeam.yellow++;
      totTeam.yellow++;
    } else if (type === 'red' || type === 'cardRed') {
      qTeam.red++;
      totTeam.red++;
    }
  });

  // Calcular porcentajes
  [1, 2, 3, 4, 'total'].forEach(key => {
    ['home', 'away'].forEach(team => {
      const data = quarters[key][team];
      data.cornerEff = data.corners > 0 ? Math.round((data.cornerGoals / data.corners) * 100) : 0;
      data.strokeEff = data.strokes > 0 ? Math.round((data.strokeGoals / data.strokes) * 100) : 0;
      data.conversion = data.entries > 0 ? Math.round((data.goals / data.entries) * 100) : 0;
    });
  });

  // Insights tácticos
  let bestQByGoals = { q: 1, val: -1 };
  let bestQByEntries = { q: 1, val: -1 };
  let hardestQDef = { q: 1, val: -1 };

  for (let q = 1; q <= 4; q++) {
    const hGoals = quarters[q].home.goals;
    const hEntries = quarters[q].home.entries;
    const aEntries = quarters[q].away.entries;

    if (hGoals > bestQByGoals.val) {
      bestQByGoals = { q, val: hGoals };
    }
    if (hEntries > bestQByEntries.val) {
      bestQByEntries = { q, val: hEntries };
    }
    if (aEntries > hardestQDef.val) {
      hardestQDef = { q, val: aEntries, goals: quarters[q].away.goals };
    }
  }

  // 1T vs 2T
  const half1 = {
    home: {
      entries: quarters[1].home.entries + quarters[2].home.entries,
      goals: quarters[1].home.goals + quarters[2].home.goals,
      corners: quarters[1].home.corners + quarters[2].home.corners,
      cornerGoals: quarters[1].home.cornerGoals + quarters[2].home.cornerGoals
    },
    away: {
      entries: quarters[1].away.entries + quarters[2].away.entries,
      goals: quarters[1].away.goals + quarters[2].away.goals,
      corners: quarters[1].away.corners + quarters[2].away.corners,
      cornerGoals: quarters[1].away.cornerGoals + quarters[2].away.cornerGoals
    }
  };

  const half2 = {
    home: {
      entries: quarters[3].home.entries + quarters[4].home.entries,
      goals: quarters[3].home.goals + quarters[4].home.goals,
      corners: quarters[3].home.corners + quarters[4].home.corners,
      cornerGoals: quarters[3].home.cornerGoals + quarters[4].home.cornerGoals
    },
    away: {
      entries: quarters[3].away.entries + quarters[4].away.entries,
      goals: quarters[3].away.goals + quarters[4].away.goals,
      corners: quarters[3].away.corners + quarters[4].away.corners,
      cornerGoals: quarters[3].away.cornerGoals + quarters[4].away.cornerGoals
    }
  };

  return {
    quarters,
    insights: {
      bestQByGoals,
      bestQByEntries,
      hardestQDef
    },
    halves: {
      half1,
      half2
    }
  };
}

