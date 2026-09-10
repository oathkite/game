export const TEAM_COLORS = ["#55c8ff", "#ff7775", "#a7e36d", "#e0a0ff", "#ffcd62", "#66e4d7", "#f8a8c8", "#b9c3d3"] as const;
export const teamColor = (index: number): string => TEAM_COLORS[index % TEAM_COLORS.length] ?? TEAM_COLORS[0];
