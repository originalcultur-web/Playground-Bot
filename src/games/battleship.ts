export interface Ship {
  positions: number[];
  hits: number[];
}

export interface PlayerBoard {
  ships: Ship[];
  shots: number[];
  hits: number[];
}

export interface BattleshipState {
  player1Id: string;
  player2Id: string;
  player1Board: PlayerBoard;
  player2Board: PlayerBoard;
  player1Ready: boolean;
  player2Ready: boolean;
  currentTurn: string;
  phase: "setup" | "battle";
  lastMoveTime: number;
}

const GRID_SIZE = 5;
const SHIP_SIZES = [3, 2];

function createEmptyBoard(): PlayerBoard {
  return {
    ships: [],
    shots: [],
    hits: [],
  };
}

function placeShipsRandomly(): Ship[] {
  const ships: Ship[] = [];
  const occupied = new Set<number>();
  
  for (const size of SHIP_SIZES) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 100) {
      attempts++;
      const horizontal = Math.random() > 0.5;
      const startRow = Math.floor(Math.random() * GRID_SIZE);
      const startCol = Math.floor(Math.random() * (horizontal ? GRID_SIZE - size + 1 : GRID_SIZE));
      const startRowAdjusted = horizontal ? startRow : Math.floor(Math.random() * (GRID_SIZE - size + 1));
      
      const positions: number[] = [];
      let valid = true;
      
      for (let i = 0; i < size; i++) {
        const row = horizontal ? startRow : startRowAdjusted + i;
        const col = horizontal ? startCol + i : startCol;
        const pos = row * GRID_SIZE + col;
        
        if (occupied.has(pos)) {
          valid = false;
          break;
        }
        positions.push(pos);
      }
      
      if (valid) {
        positions.forEach(p => occupied.add(p));
        ships.push({ positions, hits: [] });
        placed = true;
      }
    }
  }
  
  return ships;
}

export function createGameState(player1Id: string, player2Id: string): BattleshipState {
  const player1Board = createEmptyBoard();
  const player2Board = createEmptyBoard();
  
  player1Board.ships = placeShipsRandomly();
  player2Board.ships = placeShipsRandomly();
  
  return {
    player1Id,
    player2Id,
    player1Board,
    player2Board,
    player1Ready: true,
    player2Ready: true,
    currentTurn: player1Id,
    phase: "battle",
    lastMoveTime: Date.now(),
  };
}

export function fireShot(state: BattleshipState, playerId: string, position: number): { valid: boolean; hit: boolean; sunk: boolean; shipSunk?: Ship } {
  if (state.currentTurn !== playerId) return { valid: false, hit: false, sunk: false };
  if (position < 0 || position >= GRID_SIZE * GRID_SIZE) return { valid: false, hit: false, sunk: false };
  
  const isPlayer1 = playerId === state.player1Id;
  const targetBoard = isPlayer1 ? state.player2Board : state.player1Board;
  const shooterBoard = isPlayer1 ? state.player1Board : state.player2Board;
  
  if (shooterBoard.shots.includes(position)) return { valid: false, hit: false, sunk: false };
  
  shooterBoard.shots.push(position);
  state.lastMoveTime = Date.now();
  
  let hit = false;
  let sunk = false;
  let shipSunk: Ship | undefined;
  
  for (const ship of targetBoard.ships) {
    if (ship.positions.includes(position)) {
      hit = true;
      ship.hits.push(position);
      shooterBoard.hits.push(position);
      
      if (ship.hits.length === ship.positions.length) {
        sunk = true;
        shipSunk = ship;
      }
      break;
    }
  }
  
  state.currentTurn = isPlayer1 ? state.player2Id : state.player1Id;
  
  return { valid: true, hit, sunk, shipSunk };
}

export function isGameOver(state: BattleshipState): { over: boolean; winner?: string } {
  const player1ShipsSunk = state.player1Board.ships.every(s => s.hits.length === s.positions.length);
  const player2ShipsSunk = state.player2Board.ships.every(s => s.hits.length === s.positions.length);
  
  if (player1ShipsSunk) return { over: true, winner: state.player2Id };
  if (player2ShipsSunk) return { over: true, winner: state.player1Id };
  
  return { over: false };
}

export function renderBoard(board: PlayerBoard, showShips: boolean): string {
  const cols = "ABCDE";
  let display = "  " + cols.split("").join(" ") + "\n";
  
  for (let row = 0; row < GRID_SIZE; row++) {
    display += `${row + 1} `;
    for (let col = 0; col < GRID_SIZE; col++) {
      const pos = row * GRID_SIZE + col;
      const isShip = board.ships.some(s => s.positions.includes(pos));
      const isHit = board.ships.some(s => s.hits.includes(pos));
      const wasShot = board.shots.includes(pos);
      
      if (isHit) {
        display += "💥";
      } else if (wasShot) {
        display += "⬜";
      } else if (showShips && isShip) {
        display += "🚢";
      } else {
        display += "🌊";
      }
    }
    display += "\n";
  }
  
  return "```\n" + display + "```";
}

export function renderAttackBoard(shooterBoard: PlayerBoard, targetBoard: PlayerBoard): string {
  const cols = "ABCDE";
  let display = "  " + cols.split("").join(" ") + "\n";
  
  for (let row = 0; row < GRID_SIZE; row++) {
    display += `${row + 1} `;
    for (let col = 0; col < GRID_SIZE; col++) {
      const pos = row * GRID_SIZE + col;
      const wasShot = shooterBoard.shots.includes(pos);
      const isHit = shooterBoard.hits.includes(pos);
      
      if (isHit) {
        display += "💥";
      } else if (wasShot) {
        display += "⬜";
      } else {
        display += "🌊";
      }
    }
    display += "\n";
  }
  
  return "```\n" + display + "```";
}

export function renderGameStatus(state: BattleshipState, player1Name: string, player2Name: string, forPlayerId: string): string {
  const isPlayer1 = forPlayerId === state.player1Id;
  const myBoard = isPlayer1 ? state.player1Board : state.player2Board;
  const theirBoard = isPlayer1 ? state.player2Board : state.player1Board;
  const opponentBoard = isPlayer1 ? state.player2Board : state.player1Board;
  
  const myShipsLeft = myBoard.ships.filter(s => s.hits.length < s.positions.length).length;
  const theirShipsLeft = theirBoard.ships.filter(s => s.hits.length < s.positions.length).length;
  
  const isMyTurn = state.currentTurn === forPlayerId;
  const turnText = isMyTurn ? "**Your turn!** Pick a coordinate to fire." : "Waiting for opponent...";
  
  return `**Battleship** - ${player1Name} vs ${player2Name}\n\n` +
    `Your ships: ${myShipsLeft}/${SHIP_SIZES.length} | Enemy ships: ${theirShipsLeft}/${SHIP_SIZES.length}\n\n` +
    `${turnText}\n\n` +
    `**Enemy Waters:**\n${renderAttackBoard(isPlayer1 ? state.player1Board : state.player2Board, opponentBoard)}`;
}

export function parseCoordinate(input: string): number | null {
  const match = input.toUpperCase().match(/^([A-E])([1-5])$/);
  if (!match) return null;
  
  const col = match[1].charCodeAt(0) - 65;
  const row = parseInt(match[2]) - 1;
  
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
  
  return row * GRID_SIZE + col;
}

export function positionToCoord(position: number): string {
  const row = Math.floor(position / GRID_SIZE);
  const col = position % GRID_SIZE;
  return String.fromCharCode(65 + col) + (row + 1);
}
