const ROWS = 6;
const COLS = 7;

export interface Connect4State {
  board: number[][];
  currentPlayer: 1 | 2;
  player1Id: string;
  player2Id: string;
  lastMoveTime: number;
}

export function createBoard(): number[][] {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
}

export function createGameState(player1Id: string, player2Id: string): Connect4State {
  return {
    board: createBoard(),
    currentPlayer: 1,
    player1Id,
    player2Id,
    lastMoveTime: Date.now(),
  };
}

export function dropPiece(state: Connect4State, col: number): { success: boolean; row?: number } {
  if (col < 0 || col >= COLS) return { success: false };
  
  for (let row = ROWS - 1; row >= 0; row--) {
    if (state.board[row][col] === 0) {
      state.board[row][col] = state.currentPlayer;
      state.lastMoveTime = Date.now();
      return { success: true, row };
    }
  }
  return { success: false };
}

export function checkWin(board: number[][], player: number): boolean {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col <= COLS - 4; col++) {
      if (board[row][col] === player &&
          board[row][col + 1] === player &&
          board[row][col + 2] === player &&
          board[row][col + 3] === player) {
        return true;
      }
    }
  }
  
  for (let row = 0; row <= ROWS - 4; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col] === player &&
          board[row + 1][col] === player &&
          board[row + 2][col] === player &&
          board[row + 3][col] === player) {
        return true;
      }
    }
  }
  
  for (let row = 0; row <= ROWS - 4; row++) {
    for (let col = 0; col <= COLS - 4; col++) {
      if (board[row][col] === player &&
          board[row + 1][col + 1] === player &&
          board[row + 2][col + 2] === player &&
          board[row + 3][col + 3] === player) {
        return true;
      }
    }
  }
  
  for (let row = 3; row < ROWS; row++) {
    for (let col = 0; col <= COLS - 4; col++) {
      if (board[row][col] === player &&
          board[row - 1][col + 1] === player &&
          board[row - 2][col + 2] === player &&
          board[row - 3][col + 3] === player) {
        return true;
      }
    }
  }
  
  return false;
}

export function isBoardFull(board: number[][]): boolean {
  return board[0].every(cell => cell !== 0);
}

export function renderBoard(state: Connect4State, player1Emoji = "🔴", player2Emoji = "🟡"): string {
  const emptyEmoji = "⚫";
  let display = "```\n 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣\n";
  
  for (let row = 0; row < ROWS; row++) {
    let rowStr = "";
    for (let col = 0; col < COLS; col++) {
      const cell = state.board[row][col];
      if (cell === 0) rowStr += emptyEmoji;
      else if (cell === 1) rowStr += player1Emoji;
      else rowStr += player2Emoji;
    }
    display += rowStr + "\n";
  }
  display += "```";
  return display;
}

export function getCurrentPlayerId(state: Connect4State): string {
  return state.currentPlayer === 1 ? state.player1Id : state.player2Id;
}

export function switchTurn(state: Connect4State): void {
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
}
