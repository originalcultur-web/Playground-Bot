const SIZE = 9;
const MINES = 10;

export interface MinesweeperState {
  playerId: string;
  board: number[][];
  revealed: boolean[][];
  flagged: boolean[][];
  gameOver: boolean;
  won: boolean;
  startTime: number;
  endTime?: number;
  lastMoveTime: number;
}

export function createGameState(playerId: string): MinesweeperState {
  const board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
  const revealed = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
  const flagged = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
  
  let minesPlaced = 0;
  while (minesPlaced < MINES) {
    const row = Math.floor(Math.random() * SIZE);
    const col = Math.floor(Math.random() * SIZE);
    if (board[row][col] !== -1) {
      board[row][col] = -1;
      minesPlaced++;
    }
  }
  
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === -1) {
            count++;
          }
        }
      }
      board[row][col] = count;
    }
  }
  
  return {
    playerId,
    board,
    revealed,
    flagged,
    gameOver: false,
    won: false,
    startTime: Date.now(),
    lastMoveTime: Date.now(),
  };
}

export function reveal(state: MinesweeperState, row: number, col: number): boolean {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return false;
  if (state.revealed[row][col] || state.flagged[row][col]) return false;
  if (state.gameOver) return false;
  
  state.lastMoveTime = Date.now();
  state.revealed[row][col] = true;
  
  if (state.board[row][col] === -1) {
    state.gameOver = true;
    state.won = false;
    state.endTime = Date.now();
    return true;
  }
  
  if (state.board[row][col] === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        reveal(state, row + dr, col + dc);
      }
    }
  }
  
  checkWin(state);
  return true;
}

export function toggleFlag(state: MinesweeperState, row: number, col: number): boolean {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return false;
  if (state.revealed[row][col]) return false;
  if (state.gameOver) return false;
  
  state.flagged[row][col] = !state.flagged[row][col];
  state.lastMoveTime = Date.now();
  return true;
}

function checkWin(state: MinesweeperState): void {
  let allRevealed = true;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (state.board[row][col] !== -1 && !state.revealed[row][col]) {
        allRevealed = false;
        break;
      }
    }
    if (!allRevealed) break;
  }
  
  if (allRevealed) {
    state.gameOver = true;
    state.won = true;
    state.endTime = Date.now();
  }
}

export function renderBoard(state: MinesweeperState, showAll = false): string {
  const numbers = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];
  const hidden = "⬜";
  const flag = "🚩";
  const mine = "💣";
  const exploded = "💥";
  
  let display = "MINESWEEPER\n```\n  1 2 3 4 5 6 7 8 9\n";
  
  for (let row = 0; row < SIZE; row++) {
    display += `${String.fromCharCode(65 + row)} `;
    for (let col = 0; col < SIZE; col++) {
      if (showAll || state.revealed[row][col]) {
        if (state.board[row][col] === -1) {
          display += (state.gameOver && !state.won ? "X " : "* ");
        } else {
          display += `${state.board[row][col]} `;
        }
      } else if (state.flagged[row][col]) {
        display += "F ";
      } else {
        display += ". ";
      }
    }
    display += "\n";
  }
  display += "```\n";
  
  if (state.gameOver) {
    if (state.won) {
      const time = Math.floor((state.endTime! - state.startTime) / 1000);
      display += `You won! Time: ${time}s`;
    } else {
      display += "Game over! You hit a mine.";
    }
  } else {
    display += "Commands: ,reveal A1 | ,flag A1";
  }
  
  return display;
}
