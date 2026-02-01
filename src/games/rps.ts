export interface RPSState {
  player1Id: string;
  player2Id: string;
  player1Choice: string | null;
  player2Choice: string | null;
  player1Wins: number;
  player2Wins: number;
  currentRound: number;
  maxRounds: number;
  lastMoveTime: number;
}

export function createGameState(player1Id: string, player2Id: string): RPSState {
  return {
    player1Id,
    player2Id,
    player1Choice: null,
    player2Choice: null,
    player1Wins: 0,
    player2Wins: 0,
    currentRound: 1,
    maxRounds: 3,
    lastMoveTime: Date.now(),
  };
}

export function makeChoice(state: RPSState, playerId: string, choice: string): boolean {
  if (playerId === state.player1Id && !state.player1Choice) {
    state.player1Choice = choice;
    state.lastMoveTime = Date.now();
    return true;
  } else if (playerId === state.player2Id && !state.player2Choice) {
    state.player2Choice = choice;
    state.lastMoveTime = Date.now();
    return true;
  }
  return false;
}

export function bothPlayersChose(state: RPSState): boolean {
  return state.player1Choice !== null && state.player2Choice !== null;
}

export function getRoundResult(state: RPSState): { winner: string | null; p1Choice: string; p2Choice: string } {
  const p1 = state.player1Choice!;
  const p2 = state.player2Choice!;
  
  let winner: string | null = null;
  
  if (p1 === p2) {
    winner = null;
  } else if (
    (p1 === "rock" && p2 === "scissors") ||
    (p1 === "paper" && p2 === "rock") ||
    (p1 === "scissors" && p2 === "paper")
  ) {
    winner = state.player1Id;
    state.player1Wins++;
  } else {
    winner = state.player2Id;
    state.player2Wins++;
  }
  
  return { winner, p1Choice: p1, p2Choice: p2 };
}

export function resetRound(state: RPSState): void {
  state.player1Choice = null;
  state.player2Choice = null;
  state.currentRound++;
}

export function isMatchOver(state: RPSState): { over: boolean; winner?: string } {
  const winsNeeded = 2;
  if (state.player1Wins >= winsNeeded) {
    return { over: true, winner: state.player1Id };
  }
  if (state.player2Wins >= winsNeeded) {
    return { over: true, winner: state.player2Id };
  }
  return { over: false };
}

export function getChoiceEmoji(choice: string): string {
  switch (choice) {
    case "rock": return "🪨";
    case "paper": return "📄";
    case "scissors": return "✂️";
    default: return "❓";
  }
}

export function renderStatus(state: RPSState, player1Name: string, player2Name: string): string {
  const p1Status = state.player1Choice ? "✅" : "⏳";
  const p2Status = state.player2Choice ? "✅" : "⏳";
  
  return `**Rock Paper Scissors** - Best of 3\n\n` +
    `${player1Name} ${p1Status} vs ${p2Status} ${player2Name}\n\n` +
    `Score: **${state.player1Wins}** - **${state.player2Wins}**\n` +
    `Round ${state.currentRound}`;
}
