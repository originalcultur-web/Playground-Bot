export interface TicTacToeState {
  board: number[];
  currentPlayer: 1 | 2;
  player1Id: string;
  player2Id: string;
  roundWins: [number, number];
  currentRound: number;
  maxRounds: number;
  lastMoveTime: number;
}

export function createGameState(player1Id: string, player2Id: string, bestOf3 = true): TicTacToeState {
  return {
    board: Array(9).fill(0),
    currentPlayer: 1,
    player1Id,
    player2Id,
    roundWins: [0, 0],
    currentRound: 1,
    maxRounds: bestOf3 ? 3 : 1,
    lastMoveTime: Date.now(),
  };
}

export function makeMove(state: TicTacToeState, position: number): boolean {
  if (position < 0 || position > 8) return false;
  if (state.board[position] !== 0) return false;
  
  state.board[position] = state.currentPlayer;
  state.lastMoveTime = Date.now();
  return true;
}

const WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export function checkWin(board: number[], player: number): boolean {
  return WIN_PATTERNS.some(pattern =>
    pattern.every(pos => board[pos] === player)
  );
}

export function isBoardFull(board: number[]): boolean {
  return board.every(cell => cell !== 0);
}

export function resetBoard(state: TicTacToeState): void {
  state.board = Array(9).fill(0);
  state.currentRound++;
}

export function renderBoard(state: TicTacToeState, player1Emoji = "❌", player2Emoji = "⭕"): string {
  const emptyEmoji = "⬜";
  let display = "```\n";
  
  for (let row = 0; row < 3; row++) {
    let rowStr = "";
    for (let col = 0; col < 3; col++) {
      const cell = state.board[row * 3 + col];
      if (cell === 0) rowStr += `${row * 3 + col + 1} `;
      else if (cell === 1) rowStr += player1Emoji + " ";
      else rowStr += player2Emoji + " ";
    }
    display += rowStr + "\n";
  }
  
  if (state.maxRounds > 1) {
    display += `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
  }
  display += "\n```";
  return display;
}

export function getCurrentPlayerId(state: TicTacToeState): string {
  return state.currentPlayer === 1 ? state.player1Id : state.player2Id;
}

export function switchTurn(state: TicTacToeState): void {
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
}

export function recordRoundWin(state: TicTacToeState, player: 1 | 2): void {
  state.roundWins[player - 1]++;
}

export function isMatchOver(state: TicTacToeState): { over: boolean; winner?: 1 | 2 } {
  const winsNeeded = Math.ceil(state.maxRounds / 2);
  if (state.roundWins[0] >= winsNeeded) return { over: true, winner: 1 };
  if (state.roundWins[1] >= winsNeeded) return { over: true, winner: 2 };
  if (state.currentRound > state.maxRounds) return { over: true };
  return { over: false };
}
