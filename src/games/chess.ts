import { Chess } from "chess.js";

export interface ChessState {
  fen: string;
  player1Id: string;
  player2Id: string;
  currentTurn: "w" | "b";
  moveHistory: string[];
  lastMoveTime: number;
}

export function createGameState(player1Id: string, player2Id: string): ChessState {
  const chess = new Chess();
  return {
    fen: chess.fen(),
    player1Id,
    player2Id,
    currentTurn: "w",
    moveHistory: [],
    lastMoveTime: Date.now(),
  };
}

export function makeMove(state: ChessState, move: string): { success: boolean; error?: string } {
  const chess = new Chess(state.fen);
  
  try {
    const result = chess.move(move);
    if (!result) {
      return { success: false, error: "Invalid move" };
    }
    
    state.fen = chess.fen();
    state.currentTurn = chess.turn();
    state.moveHistory.push(move);
    state.lastMoveTime = Date.now();
    
    return { success: true };
  } catch (e) {
    return { success: false, error: "Invalid move format. Use algebraic notation (e.g., e4, Nf3, O-O)" };
  }
}

export function getGameStatus(state: ChessState): { over: boolean; result?: "checkmate" | "stalemate" | "draw" | "repetition"; winner?: string } {
  const chess = new Chess(state.fen);
  
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? state.player2Id : state.player1Id;
    return { over: true, result: "checkmate", winner };
  }
  
  if (chess.isStalemate()) {
    return { over: true, result: "stalemate" };
  }
  
  if (chess.isDraw()) {
    return { over: true, result: "draw" };
  }
  
  if (chess.isThreefoldRepetition()) {
    return { over: true, result: "repetition" };
  }
  
  return { over: false };
}

export function isInCheck(state: ChessState): boolean {
  const chess = new Chess(state.fen);
  return chess.isCheck();
}

export function getCurrentPlayerId(state: ChessState): string {
  return state.currentTurn === "w" ? state.player1Id : state.player2Id;
}

export function renderBoard(state: ChessState): string {
  const chess = new Chess(state.fen);
  const board = chess.board();
  
  const pieceEmojis: Record<string, string> = {
    "wk": "♔", "wq": "♕", "wr": "♖", "wb": "♗", "wn": "♘", "wp": "♙",
    "bk": "♚", "bq": "♛", "br": "♜", "bb": "♝", "bn": "♞", "bp": "♟",
  };
  
  let display = "```\n  a b c d e f g h\n";
  
  for (let row = 0; row < 8; row++) {
    display += `${8 - row} `;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const key = piece.color + piece.type;
        display += pieceEmojis[key] + " ";
      } else {
        display += ". ";
      }
    }
    display += `${8 - row}\n`;
  }
  display += "  a b c d e f g h\n```";
  
  const status = isInCheck(state) ? " (CHECK!)" : "";
  const turn = state.currentTurn === "w" ? "White" : "Black";
  display += `\n${turn}'s turn${status}`;
  
  if (state.moveHistory.length > 0) {
    const lastMove = state.moveHistory[state.moveHistory.length - 1];
    display += ` | Last move: ${lastMove}`;
  }
  
  return display;
}
