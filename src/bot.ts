import "dotenv/config";
import { 
  Client, 
  GatewayIntentBits, 
  Message, 
  Partials, 
  ButtonInteraction,
  Events,
  TextChannel
} from "discord.js";
import * as storage from "#server/storage.js";
import * as connect4 from "./games/connect4.js";
import * as tictactoe from "./games/tictactoe.js";
import * as wordduel from "./games/wordduel.js";
import * as wordle from "./games/wordle.js";
import * as rps from "./games/rps.js";
import * as hangman from "./games/hangman.js";
import * as triviaduel from "./games/triviaduel.js";
import * as mathblitz from "./games/mathblitz.js";
import * as battleship from "./games/battleship.js";
import * as ui from "./ui/gameComponents.js";

const PREFIX = ",";
const AFK_TIMEOUT = 60000;
const BOT_PLAYER_ID = "BOT_PLAY_123456789";
const BOT_GAMES = ["connect4"];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const matchmakingTimers = new Map<string, NodeJS.Timeout>();
const gameTimers = new Map<string, NodeJS.Timeout>();
const leaderboardCache = new Map<string, { data: any; timestamp: number }>();
const gameMessages = new Map<string, string>();

async function getPlayerName(discordId: string): Promise<string> {
  const player = await storage.getPlayer(discordId);
  return player?.displayName || player?.username || "Unknown";
}

async function ensureBotProfile(): Promise<void> {
  const botPlayer = await storage.getPlayer(BOT_PLAYER_ID);
  if (!botPlayer) {
    await storage.getOrCreatePlayer(BOT_PLAYER_ID, "playground_bot", "Play");
  }
}

function isBotGame(player1Id: string, player2Id: string): boolean {
  return player1Id === BOT_PLAYER_ID || player2Id === BOT_PLAYER_ID;
}

function getBotConnect4Move(state: any): number {
  const originalBoard = state.board;
  const botPlayer = state.player2Id === BOT_PLAYER_ID ? 2 : 1;
  const humanPlayer = botPlayer === 1 ? 2 : 1;
  const MAX_DEPTH = 8;
  
  const copyBoard = (b: number[][]): number[][] => b.map(r => [...r]);
  
  const getValidCols = (b: number[][]): number[] => {
    const cols: number[] = [];
    for (let c = 0; c < 7; c++) {
      if (b[0][c] === 0) cols.push(c);
    }
    return cols;
  };
  
  const dropPiece = (b: number[][], col: number, player: number): number => {
    for (let row = 5; row >= 0; row--) {
      if (b[row][col] === 0) {
        b[row][col] = player;
        return row;
      }
    }
    return -1;
  };
  
  const checkWin = (b: number[][], row: number, col: number, player: number): boolean => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      let count = 1;
      for (let i = 1; i <= 3; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && b[r][c] === player) count++;
        else break;
      }
      for (let i = 1; i <= 3; i++) {
        const r = row - dr * i, c = col - dc * i;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && b[r][c] === player) count++;
        else break;
      }
      if (count >= 4) return true;
    }
    return false;
  };
  
  const isBoardFull = (b: number[][]): boolean => {
    for (let c = 0; c < 7; c++) {
      if (b[0][c] === 0) return false;
    }
    return true;
  };
  
  const evaluateWindow = (window: number[], player: number): number => {
    const opp = player === 1 ? 2 : 1;
    const playerCount = window.filter(c => c === player).length;
    const oppCount = window.filter(c => c === opp).length;
    const emptyCount = window.filter(c => c === 0).length;
    
    if (playerCount === 4) return 100000;
    if (playerCount === 3 && emptyCount === 1) return 100;
    if (playerCount === 2 && emptyCount === 2) return 10;
    if (oppCount === 3 && emptyCount === 1) return -80;
    if (oppCount === 2 && emptyCount === 2) return -5;
    return 0;
  };
  
  const evaluateBoard = (b: number[][], player: number): number => {
    let score = 0;
    
    for (let r = 0; r < 6; r++) {
      score += b[r][3] === player ? 3 : 0;
    }
    
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const window = [b[r][c], b[r][c+1], b[r][c+2], b[r][c+3]];
        score += evaluateWindow(window, player);
      }
    }
    
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 3; r++) {
        const window = [b[r][c], b[r+1][c], b[r+2][c], b[r+3][c]];
        score += evaluateWindow(window, player);
      }
    }
    
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const window = [b[r][c], b[r+1][c+1], b[r+2][c+2], b[r+3][c+3]];
        score += evaluateWindow(window, player);
      }
    }
    
    for (let r = 3; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const window = [b[r][c], b[r-1][c+1], b[r-2][c+2], b[r-3][c+3]];
        score += evaluateWindow(window, player);
      }
    }
    
    return score;
  };
  
  const hasWin = (b: number[][], player: number): boolean => {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === player && b[r][c+1] === player && b[r][c+2] === player && b[r][c+3] === player) return true;
      }
    }
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 3; r++) {
        if (b[r][c] === player && b[r+1][c] === player && b[r+2][c] === player && b[r+3][c] === player) return true;
      }
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === player && b[r+1][c+1] === player && b[r+2][c+2] === player && b[r+3][c+3] === player) return true;
      }
    }
    for (let r = 3; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === player && b[r-1][c+1] === player && b[r-2][c+2] === player && b[r-3][c+3] === player) return true;
      }
    }
    return false;
  };
  
  const minimax = (b: number[][], depth: number, alpha: number, beta: number, isMaximizing: boolean): number => {
    if (hasWin(b, botPlayer)) return 1000000 + depth;
    if (hasWin(b, humanPlayer)) return -1000000 - depth;
    
    const validCols = getValidCols(b);
    
    if (isBoardFull(b) || validCols.length === 0) return 0;
    
    if (depth === 0) {
      return evaluateBoard(b, botPlayer);
    }
    
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const col of [3, 2, 4, 1, 5, 0, 6].filter(c => validCols.includes(c))) {
        const testBoard = copyBoard(b);
        const row = dropPiece(testBoard, col, botPlayer);
        if (row === -1) continue;
        
        const evalScore = minimax(testBoard, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const col of [3, 2, 4, 1, 5, 0, 6].filter(c => validCols.includes(c))) {
        const testBoard = copyBoard(b);
        const row = dropPiece(testBoard, col, humanPlayer);
        if (row === -1) continue;
        
        const evalScore = minimax(testBoard, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };
  
  const validCols = getValidCols(originalBoard);
  if (validCols.length === 0) return 3;
  
  for (const col of validCols) {
    const testBoard = copyBoard(originalBoard);
    const row = dropPiece(testBoard, col, botPlayer);
    if (row !== -1 && checkWin(testBoard, row, col, botPlayer)) {
      return col;
    }
  }
  
  for (const col of validCols) {
    const testBoard = copyBoard(originalBoard);
    const row = dropPiece(testBoard, col, humanPlayer);
    if (row !== -1 && checkWin(testBoard, row, col, humanPlayer)) {
      return col;
    }
  }
  
  let bestMove = validCols[0];
  let bestScore = -Infinity;
  
  for (const col of [3, 2, 4, 1, 5, 0, 6].filter(c => validCols.includes(c))) {
    const testBoard = copyBoard(originalBoard);
    const row = dropPiece(testBoard, col, botPlayer);
    if (row === -1) continue;
    
    const score = minimax(testBoard, MAX_DEPTH - 1, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = col;
    }
  }
  
  return bestMove;
}

function checkConnect4Win(board: number[][], row: number, col: number, player: number): boolean {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i <= 3; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) count++;
      else break;
    }
    for (let i = 1; i <= 3; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) count++;
      else break;
    }
    if (count >= 4) return true;
  }
  return false;
}

function getBotTicTacToeMove(state: any): number {
  const board = [...state.board];
  const botPlayer = state.player2Id === BOT_PLAYER_ID ? 2 : 1;
  const humanPlayer = botPlayer === 1 ? 2 : 1;
  
  const WIN_PATTERNS = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
  
  const checkWinner = (b: number[]): number | null => {
    for (const [a, x, c] of WIN_PATTERNS) {
      if (b[a] !== 0 && b[a] === b[x] && b[x] === b[c]) return b[a];
    }
    return null;
  };
  
  const isFull = (b: number[]): boolean => b.every(cell => cell !== 0);
  
  const getEmpty = (b: number[]): number[] => {
    const empty: number[] = [];
    for (let i = 0; i < 9; i++) {
      if (b[i] === 0) empty.push(i);
    }
    return empty;
  };
  
  const minimax = (b: number[], isMaximizing: boolean, depth: number): number => {
    const winner = checkWinner(b);
    if (winner === botPlayer) return 10 - depth;
    if (winner === humanPlayer) return depth - 10;
    if (isFull(b)) return 0;
    
    const empty = getEmpty(b);
    
    if (isMaximizing) {
      let bestScore = -Infinity;
      for (const pos of empty) {
        b[pos] = botPlayer;
        const score = minimax(b, false, depth + 1);
        b[pos] = 0;
        bestScore = Math.max(score, bestScore);
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (const pos of empty) {
        b[pos] = humanPlayer;
        const score = minimax(b, true, depth + 1);
        b[pos] = 0;
        bestScore = Math.min(score, bestScore);
      }
      return bestScore;
    }
  };
  
  const empty = getEmpty(board);
  if (empty.length === 0) return 4;
  
  let bestMove = empty[0];
  let bestScore = -Infinity;
  
  for (const pos of empty) {
    board[pos] = botPlayer;
    const score = minimax(board, false, 0);
    board[pos] = 0;
    if (score > bestScore) {
      bestScore = score;
      bestMove = pos;
    }
  }
  
  return bestMove;
}

async function makeBotMove(game: any, channel: TextChannel): Promise<void> {
  try {
    console.log(`makeBotMove called for game ${game.id}, type: ${game.gameType}`);
    
    const freshGame = await storage.getActiveGameById(game.id);
    if (!freshGame) {
      console.log(`makeBotMove: Game ${game.id} not found`);
      return;
    }
    
    const freshState = freshGame.state as any;
    const freshGameType = freshGame.gameType;
  
  const currentPlayerId = freshGameType === "connect4" 
    ? connect4.getCurrentPlayerId(freshState) 
    : tictactoe.getCurrentPlayerId(freshState);
  
  if (currentPlayerId !== BOT_PLAYER_ID) return;
  
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
  
  const latestGame = await storage.getActiveGameById(game.id);
  if (!latestGame) return;
  
  const latestState = latestGame.state as any;
  const latestGameType = latestGame.gameType;
  
  const latestCurrentPlayer = latestGameType === "connect4" 
    ? connect4.getCurrentPlayerId(latestState) 
    : tictactoe.getCurrentPlayerId(latestState);
  
  if (latestCurrentPlayer !== BOT_PLAYER_ID) return;
  
  if (latestGameType === "connect4") {
    const col = getBotConnect4Move(latestState);
    const dropResult = connect4.dropPiece(latestState, col);
    
    if (dropResult.success) {
      const player1Name = await getPlayerName(latestState.player1Id);
      const player2Name = await getPlayerName(latestState.player2Id);
      const display = ui.createConnect4Display(latestState);
      
      if (connect4.checkWin(latestState.board, latestState.currentPlayer)) {
        const winnerId = connect4.getCurrentPlayerId(latestState);
        const loserId = winnerId === latestState.player1Id ? latestState.player2Id : latestState.player1Id;
        const winnerName = await getPlayerName(winnerId);
        
        await storage.recordGameResult(BOT_PLAYER_ID, "connect4", winnerId === BOT_PLAYER_ID ? "win" : "loss");
        
        clearGameTimer(latestGame.id);
        await storage.endGame(latestGame.id);
        const buttons = ui.createConnect4Board(latestState, latestGame.id, true);
        const content = `**CONNECT 4** 🤖\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\n🎉 **${winnerName}** wins!\n\n*Unranked game vs Play*`;
        await syncGameMessages(latestGame, content, buttons);
      } else if (connect4.isBoardFull(latestState.board)) {
        clearGameTimer(latestGame.id);
        await storage.endGame(latestGame.id);
        const buttons = ui.createConnect4Board(latestState, latestGame.id, true);
        const content = `**CONNECT 4** 🤖\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\nIt's a draw!\n\n*Unranked game vs Play*`;
        await syncGameMessages(latestGame, content, buttons);
      } else {
        connect4.switchTurn(latestState);
        await storage.updateGameState(latestGame.id, latestState, connect4.getCurrentPlayerId(latestState));
        const nextPlayerName = await getPlayerName(connect4.getCurrentPlayerId(latestState));
        const buttons = ui.createConnect4Board(latestState, latestGame.id);
        const content = `**CONNECT 4** 🤖\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\nIt's **${nextPlayerName}**'s turn (type 1-7 or click)\n\n*Unranked game vs Play*`;
        await syncGameMessages(latestGame, content, buttons);
        resetGameTimer(latestGame.id, channel);
      }
    }
  } else if (latestGameType === "tictactoe") {
    const pos = getBotTicTacToeMove(latestState);
    const moveValid = tictactoe.makeMove(latestState, pos);
    
    if (moveValid) {
      const player1Name = await getPlayerName(latestState.player1Id);
      const player2Name = await getPlayerName(latestState.player2Id);
      const display = ui.createTicTacToeDisplay(latestState);
      const scoreText = latestState.maxRounds > 1 ? `\nScore: ${latestState.roundWins[0]} - ${latestState.roundWins[1]}` : "";
      
      if (tictactoe.checkWin(latestState.board, latestState.currentPlayer)) {
        tictactoe.recordRoundWin(latestState, latestState.currentPlayer);
        const matchResult = tictactoe.isMatchOver(latestState);
        
        if (matchResult.over && matchResult.winner) {
          const winnerId = matchResult.winner === 1 ? latestState.player1Id : latestState.player2Id;
          const loserId = winnerId === latestState.player1Id ? latestState.player2Id : latestState.player1Id;
          const winnerName = await getPlayerName(winnerId);
          
          await storage.recordGameResult(BOT_PLAYER_ID, "tictactoe", winnerId === BOT_PLAYER_ID ? "win" : "loss");
          
          clearGameTimer(latestGame.id);
          await storage.endGame(latestGame.id);
          const buttons = ui.createTicTacToeBoard(latestState, latestGame.id, true);
          const finalScore = `\nFinal Score: ${latestState.roundWins[0]} - ${latestState.roundWins[1]}`;
          const content = `**TIC TAC TOE** 🤖\n\n${player1Name} vs ${player2Name}${finalScore}\n\n${display}\n\n🎉 **${winnerName}** wins the match!\n\n*Unranked game vs Play*`;
          await syncGameMessages(latestGame, content, buttons);
        } else {
          tictactoe.resetBoard(latestState);
          await storage.updateGameState(latestGame.id, latestState, tictactoe.getCurrentPlayerId(latestState));
          
          const newDisplay = ui.createTicTacToeDisplay(latestState);
          const nextPlayerId = tictactoe.getCurrentPlayerId(latestState);
          const nextPlayerName = await getPlayerName(nextPlayerId);
          const buttons = ui.createTicTacToeBoard(latestState, latestGame.id);
          const roundScore = `\nRound ${latestState.currentRound}/${latestState.maxRounds} | Score: ${latestState.roundWins[0]} - ${latestState.roundWins[1]}`;
          const content = `**TIC TAC TOE** 🤖\n\n${player1Name} vs ${player2Name}${roundScore}\n\n${newDisplay}\n\nIt's **${nextPlayerName}**'s turn\n\n*Unranked game vs Play*`;
          await syncGameMessages(latestGame, content, buttons);
          
          if (nextPlayerId === BOT_PLAYER_ID) {
            setTimeout(() => makeBotMove(latestGame, channel), 1500);
          } else {
            resetGameTimer(latestGame.id, channel);
          }
        }
      } else if (tictactoe.isBoardFull(latestState.board)) {
        if (latestState.currentRound >= latestState.maxRounds) {
          clearGameTimer(latestGame.id);
          await storage.endGame(latestGame.id);
          const buttons = ui.createTicTacToeBoard(latestState, latestGame.id, true);
          const finalScore = `\nFinal Score: ${latestState.roundWins[0]} - ${latestState.roundWins[1]}`;
          const content = `**TIC TAC TOE** 🤖\n\n${player1Name} vs ${player2Name}${finalScore}\n\n${display}\n\nMatch ended in a draw!\n\n*Unranked game vs Play*`;
          await syncGameMessages(latestGame, content, buttons);
        } else {
          tictactoe.resetBoard(latestState);
          await storage.updateGameState(latestGame.id, latestState, tictactoe.getCurrentPlayerId(latestState));
          
          const newDisplay = ui.createTicTacToeDisplay(latestState);
          const nextPlayerId = tictactoe.getCurrentPlayerId(latestState);
          const nextPlayerName = await getPlayerName(nextPlayerId);
          const buttons = ui.createTicTacToeBoard(latestState, latestGame.id);
          const roundScore = `\nRound ${latestState.currentRound}/${latestState.maxRounds} | Score: ${latestState.roundWins[0]} - ${latestState.roundWins[1]}`;
          const content = `**TIC TAC TOE** 🤖\n\n${player1Name} vs ${player2Name}${roundScore}\n\n${newDisplay}\n\nIt's **${nextPlayerName}**'s turn\n\n*Unranked game vs Play*`;
          await syncGameMessages(latestGame, content, buttons);
          
          if (nextPlayerId === BOT_PLAYER_ID) {
            setTimeout(() => makeBotMove(latestGame, channel), 1500);
          } else {
            resetGameTimer(latestGame.id, channel);
          }
        }
      } else {
        tictactoe.switchTurn(latestState);
        await storage.updateGameState(latestGame.id, latestState, tictactoe.getCurrentPlayerId(latestState));
        const nextPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(latestState));
        const buttons = ui.createTicTacToeBoard(latestState, latestGame.id);
        const content = `**TIC TAC TOE** 🤖\n\n${player1Name} vs ${player2Name}${scoreText}\n\n${display}\n\nIt's **${nextPlayerName}**'s turn\n\n*Unranked game vs Play*`;
        await syncGameMessages(latestGame, content, buttons);
        resetGameTimer(latestGame.id, channel);
      }
    }
  }
  } catch (error) {
    console.error(`makeBotMove error for game ${game.id}:`, error);
  }
}

async function sendToGameChannels(game: any, messageOptions: any) {
  const channels: TextChannel[] = [];
  
  try {
    const channel1 = await client.channels.fetch(game.channelId) as TextChannel;
    if (channel1) channels.push(channel1);
  } catch (e) {}
  
  if (game.player2ChannelId && game.player2ChannelId !== game.channelId) {
    try {
      const channel2 = await client.channels.fetch(game.player2ChannelId) as TextChannel;
      if (channel2) channels.push(channel2);
    } catch (e) {}
  }
  
  for (const ch of channels) {
    try {
      await ch.send(messageOptions);
    } catch (e) {
      console.error("Failed to send to channel:", e);
    }
  }
  
  return channels[0];
}

async function syncGameMessages(game: any, content: string, components?: any[]): Promise<void> {
  const messageOptions: any = { content };
  if (components) {
    messageOptions.components = components;
  }
  
  try {
    const channel1 = await client.channels.fetch(game.channelId) as TextChannel;
    if (channel1 && game.player1MessageId) {
      const msg1 = await channel1.messages.fetch(game.player1MessageId);
      if (msg1) await msg1.edit(messageOptions);
    }
  } catch (e) {
    console.error("Failed to sync to player1 channel:", e);
  }
  
  if (game.player2ChannelId && game.player2ChannelId !== game.channelId && game.player2MessageId) {
    try {
      const channel2 = await client.channels.fetch(game.player2ChannelId) as TextChannel;
      if (channel2) {
        const msg2 = await channel2.messages.fetch(game.player2MessageId);
        if (msg2) await msg2.edit(messageOptions);
      }
    } catch (e) {
      console.error("Failed to sync to player2 channel:", e);
    }
  }
}

async function handleHelp(message: Message) {
  const staffRole = await storage.getStaffRole(message.author.id);
  
  let help = `**PLAYGROUND - Commands**

**Games (PvP):**
\`,connect4\` / \`,c4\` - Play Connect 4
\`,tictactoe\` / \`,ttt\` - Play Tic Tac Toe
\`,wordduel\` / \`,wd\` - Play Word Duel
\`,rps\` - Play Rock Paper Scissors
\`,trivia\` / \`,td\` - Play Trivia Duel
\`,math\` / \`,mb\` - Play Math Blitz
\`,battleship\` / \`,bs\` - Play Battleship

**Games (Solo):**
\`,wordle\` / \`,w\` - Play Wordle
\`,hangman\` / \`,hm\` - Play Hangman

**During Games:**
\`,quit\` - Forfeit current game

**Profile & Stats:**
\`,profile\` - View your profile
\`,leaderboard <game>\` - View leaderboard
\`,staff\` - View staff team
\`,rules <game>\` - How to play a game

**Shop (Coming Soon):**
\`,shop\` - Preview cosmetic shop

\`,accept\` - Accept a challenge`;

  if (staffRole) {
    help += `

*Use \`,staffhelp\` for staff commands (only you can see)*`;
  }
  
  await message.channel.send(help);
}

async function handleProfile(message: Message, args: string[]) {
  let targetId = message.author.id;
  let targetName = message.author.username;
  
  if (args.length > 0 && args[0].toLowerCase() === "play") {
    targetId = BOT_PLAYER_ID;
    targetName = "Play";
  } else if (message.mentions.users.size > 0) {
    const mentioned = message.mentions.users.first()!;
    targetId = mentioned.id;
    targetName = mentioned.username;
  }
  
  const player = await storage.getPlayer(targetId);
  if (!player) {
    await message.channel.send(`${targetName} hasn't played any games yet.`);
    return;
  }
  
  let staffBadge = "";
  if (targetId === BOT_PLAYER_ID) {
    staffBadge = " 🤖 Bot";
  } else {
    const staffRole = await storage.getStaffRole(targetId);
    if (staffRole) {
      const emojis = await storage.loadEmojis();
      const roleNames: Record<string, string> = {
        owner: "Owner",
        admin: "Admin",
        mod: "Moderator",
        support: "Support"
      };
      staffBadge = ` ${emojis[staffRole]} ${roleNames[staffRole]}`;
    }
  }
  
  let profile = `**${player.displayName || player.username}**${staffBadge}\n`;
  profile += `*@${player.username}*\n\n`;
  
  profile += `**OVERALL**\n`;
  profile += `wins: ${player.totalWins}  losses: ${player.totalLosses}\n`;
  if (targetId !== BOT_PLAYER_ID && player.dailyStreak && player.dailyStreak > 0) {
    profile += `streak: ${player.dailyStreak} day${player.dailyStreak > 1 ? 's' : ''}\n`;
  }
  profile += `\n`;
  
  const pvpGames = targetId === BOT_PLAYER_ID ? ["connect4", "tictactoe"] : ["connect4", "wordduel", "tictactoe"];
  const gameLabels: Record<string, string> = {
    tictactoe: "Tic Tac Toe",
    connect4: "Connect 4",
    wordduel: "Word Duel",
    wordle: "Wordle"
  };
  
  const pvpStats: string[] = [];
  for (const game of pvpGames) {
    const stats = await storage.getOrCreateGameStats(targetId, game);
    if (stats.wins > 0 || stats.losses > 0) {
      if (targetId === BOT_PLAYER_ID) {
        pvpStats.push(`${gameLabels[game]}: ${stats.wins}W/${stats.losses}L`);
      } else {
        pvpStats.push(`${gameLabels[game]}: ${stats.wins}W/${stats.losses}L · ${stats.eloRating} ⭐`);
      }
    }
  }
  
  if (pvpStats.length > 0) {
    profile += `**PVP**\n`;
    profile += pvpStats.join('\n') + '\n\n';
  }
  
  if (targetId !== BOT_PLAYER_ID) {
    const matches = await storage.getMatchHistory(targetId, 5);
    if (matches.length > 0) {
      profile += `**RECENT MATCHES**\n`;
      for (const match of matches) {
        const resultIcon = match.result === "win" ? "✅" : match.result === "draw" ? "🤝" : "❌";
        const eloText = match.eloChange > 0 ? `+${match.eloChange} ⭐` : `${match.eloChange} ⭐`;
        profile += `${resultIcon} ${match.opponentName} (${gameLabels[match.gameType] || match.gameType}) ${eloText}\n`;
      }
    }
  }
  
  await message.channel.send(profile);
}

const PVP_GAMES = ["tictactoe", "connect4", "wordduel", "rps", "triviaduel", "mathblitz", "battleship"];

function clearLeaderboardCache(game?: string) {
  if (game) {
    leaderboardCache.delete(game);
  } else {
    leaderboardCache.clear();
  }
}

async function handleLeaderboard(message: Message, args: string[]) {
  let game = args[0]?.toLowerCase();
  
  const shortcuts: Record<string, string> = {
    c4: "connect4",
    ttt: "tictactoe",
    wd: "wordduel",
    w: "wordle",
    hm: "hangman",
    td: "triviaduel",
    mb: "mathblitz",
    bs: "battleship"
  };
  if (game && shortcuts[game]) {
    game = shortcuts[game];
  }
  
  const validGames = ["connect4", "tictactoe", "wordduel", "wordle", "rps", "hangman", "triviaduel", "mathblitz", "battleship"];
  const gameLabels: Record<string, string> = {
    connect4: "CONNECT 4",
    tictactoe: "TIC TAC TOE",
    wordduel: "WORD DUEL",
    wordle: "WORDLE",
    rps: "ROCK PAPER SCISSORS",
    hangman: "HANGMAN",
    triviaduel: "TRIVIA DUEL",
    mathblitz: "MATH BLITZ",
    battleship: "BATTLESHIP"
  };
  
  if (!game || !validGames.includes(game)) {
    await message.channel.send(`Usage: ,leaderboard <game>\nGames: connect4 (c4), tictactoe (ttt), wordduel (wd), wordle (w), rps, hangman (hm), trivia (td), math (mb), battleship (bs)`);
    return;
  }
  
  const cacheKey = game;
  const cached = leaderboardCache.get(cacheKey);
  
  let leaderboardSection: string;
  
  if (cached && Date.now() - cached.timestamp < 60000) {
    leaderboardSection = cached.data;
  } else {
    const leaders = await storage.getLeaderboard(game);
    
    leaderboardSection = `**${gameLabels[game]} LEADERBOARD**\n\n`;
    
    if (leaders.length === 0) {
      leaderboardSection += "No players yet. Be the first!\n";
    } else {
      for (let i = 0; i < leaders.length; i++) {
        const stat = leaders[i];
        const player = await storage.getPlayer(stat.discordId);
        const displayName = player?.displayName || "Unknown";
        const username = player?.username || "unknown";
        
        leaderboardSection += `${i + 1}. **${displayName}** (*@${username}*)\n`;
        
        if (game === "wordle") {
          const bestTime = (stat.extraStats as any)?.bestTime;
          const timeStr = bestTime ? `  best: ${bestTime}s` : "";
          leaderboardSection += `   wins: ${stat.wins}  losses: ${stat.losses}${timeStr}\n\n`;
        } else {
          leaderboardSection += `   wins: ${stat.wins}  losses: ${stat.losses}  win rate: ${stat.winRate.toFixed(0)}%\n\n`;
        }
      }
    }
    
    leaderboardCache.set(cacheKey, { data: leaderboardSection, timestamp: Date.now() });
  }
  
  const playerRank = await storage.getPlayerRank(message.author.id, game);
  const playerStats = await storage.getOrCreateGameStats(message.author.id, game);
  
  const isPvP = ["connect4", "tictactoe", "wordduel", "rps", "triviaduel", "mathblitz", "battleship"].includes(game);
  const totalGames = playerStats.wins + playerStats.losses;
  const minGames = 5;
  
  let userSection: string;
  if (isPvP && totalGames < minGames) {
    userSection = `**YOUR RANK:** Unranked\n`;
    userSection += `wins: ${playerStats.wins}  losses: ${playerStats.losses}  win rate: ${playerStats.winRate.toFixed(0)}%\n`;
    userSection += `*Play ${minGames - totalGames} more game${minGames - totalGames !== 1 ? 's' : ''} to qualify for rankings*`;
  } else {
    userSection = `**YOUR RANK:** ${playerRank}\n`;
    if (game === "wordle") {
      const bestTime = (playerStats.extraStats as any)?.bestTime;
      const timeStr = bestTime ? `  best: ${bestTime}s` : "";
      userSection += `wins: ${playerStats.wins}  losses: ${playerStats.losses}${timeStr}`;
    } else {
      userSection += `wins: ${playerStats.wins}  losses: ${playerStats.losses}  win rate: ${playerStats.winRate.toFixed(0)}%`;
    }
  }
  
  await message.channel.send(leaderboardSection + userSection);
}

async function handleShop(message: Message, _args: string[]) {
  await message.channel.send("**SHOP**\n\n🚧 Coming Soon! 🚧\n\nOur team is working on exciting cosmetic items for you to customize your profile. Stay tuned!");
}

async function handleBuy(message: Message, _args: string[]) {
  await message.channel.send("🚧 Shop coming soon! Check back later for cosmetic items.");
}

async function handleInventory(message: Message) {
  await message.channel.send("🚧 Inventory coming soon! You'll be able to view your purchased items here.");
}

async function handleEquip(message: Message, _args: string[]) {
  await message.channel.send("🚧 Equipment system coming soon!");
}

async function handleUnequip(message: Message, _args: string[]) {
  await message.channel.send("🚧 Equipment system coming soon!");
}

async function handleStaff(message: Message) {
  const staffList = await storage.getAllStaff();
  
  if (staffList.length === 0) {
    await message.channel.send("No staff members found.");
    return;
  }
  
  const emojis = await storage.loadEmojis();
  let display = "**STAFF TEAM**\n\n";
  
  const roleGroups: Record<string, string[]> = {
    owner: [],
    admin: [],
    mod: [],
    support: [],
  };
  
  for (const { player, role } of staffList) {
    if (role) {
      const name = player.displayName || player.username;
      roleGroups[role].push(`**${name}** (*@${player.username}*)`);
    }
  }
  
  if (roleGroups.owner.length > 0) {
    display += `${emojis.owner} **Owner**\n${roleGroups.owner.join("\n")}\n\n`;
  }
  if (roleGroups.admin.length > 0) {
    display += `${emojis.admin} **Admins**\n${roleGroups.admin.join("\n")}\n\n`;
  }
  if (roleGroups.mod.length > 0) {
    display += `${emojis.mod} **Moderators**\n${roleGroups.mod.join("\n")}\n\n`;
  }
  if (roleGroups.support.length > 0) {
    display += `${emojis.support} **Support**\n${roleGroups.support.join("\n")}\n\n`;
  }
  
  await message.channel.send(display.trim());
}

async function handlePromote(message: Message, args: string[]) {
  const managerRole = await storage.getStaffRole(message.author.id);
  if (!managerRole || storage.getStaffLevel(managerRole) < 3) {
    await message.channel.send("You don't have permission to promote users.");
    return;
  }
  
  const mention = message.mentions.users.first();
  if (!mention) {
    await message.channel.send("Usage: ,promote @user <admin/mod/support>");
    return;
  }
  
  const roleArg = args[1]?.toLowerCase();
  const validRoles = ["admin", "mod", "support"];
  if (!roleArg || !validRoles.includes(roleArg)) {
    await message.channel.send("Usage: ,promote @user <admin/mod/support>");
    return;
  }
  
  const targetRole = roleArg as storage.StaffRole;
  
  if (!storage.canManageRole(managerRole, targetRole)) {
    await message.channel.send("You can't assign a role equal to or higher than your own.");
    return;
  }
  
  if (storage.isOwner(mention.id)) {
    await message.channel.send("Cannot modify the owner's role.");
    return;
  }
  
  await storage.getOrCreatePlayer(mention.id, mention.username, mention.displayName);
  await storage.setStaffRole(mention.id, targetRole);
  
  const emojis = await storage.loadEmojis();
  const roleEmoji = targetRole ? emojis[targetRole] || "" : "";
  await message.channel.send(`${roleEmoji} **${mention.displayName || mention.username}** has been promoted to **${targetRole}**!`);
}

async function handleDemote(message: Message, _args: string[]) {
  const managerRole = await storage.getStaffRole(message.author.id);
  if (!managerRole || storage.getStaffLevel(managerRole) < 3) {
    await message.channel.send("You don't have permission to demote users.");
    return;
  }
  
  const mention = message.mentions.users.first();
  if (!mention) {
    await message.channel.send("Usage: ,demote @user");
    return;
  }
  
  if (storage.isOwner(mention.id)) {
    await message.channel.send("Cannot modify the owner's role.");
    return;
  }
  
  const targetRole = await storage.getStaffRole(mention.id);
  if (!targetRole) {
    await message.channel.send("That user is not a staff member.");
    return;
  }
  
  if (!storage.canManageRole(managerRole, targetRole)) {
    await message.channel.send("You can't demote someone with an equal or higher role.");
    return;
  }
  
  await storage.setStaffRole(mention.id, null);
  await message.channel.send(`**${mention.displayName || mention.username}** has been removed from staff.`);
}

async function handleResetPlayer(message: Message, args: string[]) {
  const managerRole = await storage.getStaffRole(message.author.id);
  if (!managerRole || storage.getStaffLevel(managerRole) < 2) {
    await message.channel.send("You don't have permission to reset player stats.");
    return;
  }
  
  const mention = message.mentions.users.first();
  if (!mention) {
    await message.channel.send("Usage: ,resetplayer @user [game]");
    return;
  }
  
  const game = args[1]?.toLowerCase();
  const validGames = ["connect4", "tictactoe", "wordduel", "wordle"];
  
  if (game && !validGames.includes(game)) {
    await message.channel.send(`Invalid game. Valid games: ${validGames.join(", ")}`);
    return;
  }
  
  await storage.resetPlayerStats(mention.id, game);
  
  if (game) {
    await message.channel.send(`Reset **${mention.displayName || mention.username}**'s ${game} stats.`);
  } else {
    await message.channel.send(`Reset all stats for **${mention.displayName || mention.username}**.`);
  }
}

async function handleResetGame(message: Message, args: string[]) {
  const managerRole = await storage.getStaffRole(message.author.id);
  if (!managerRole || storage.getStaffLevel(managerRole) < 3) {
    await message.channel.send("You don't have permission to reset game leaderboards.");
    return;
  }
  
  const game = args[0]?.toLowerCase();
  const validGames = ["connect4", "tictactoe", "wordduel", "wordle"];
  
  if (!game || !validGames.includes(game)) {
    await message.channel.send(`Usage: ,resetgame <game>\nValid games: ${validGames.join(", ")}`);
    return;
  }
  
  const count = await storage.resetGameLeaderboard(game);
  await message.channel.send(`Reset ${game} leaderboard. ${count} entries cleared.`);
  leaderboardCache.clear();
}

const resetConfirmations = new Map<string, { timestamp: number }>();

async function handleResetBot(message: Message) {
  if (!storage.isOwner(message.author.id)) {
    return;
  }
  
  const existing = resetConfirmations.get(message.author.id);
  if (existing && Date.now() - existing.timestamp < 30000) {
    resetConfirmations.delete(message.author.id);
    const result = await storage.resetEntireBot();
    await message.channel.send(`Bot reset complete.\n- ${result.players} players reset\n- ${result.games} game stats cleared\n- ${result.matches} match history entries removed`);
    leaderboardCache.clear();
    return;
  }
  
  resetConfirmations.set(message.author.id, { timestamp: Date.now() });
  await message.channel.send("**WARNING:** This will reset ALL player stats, coins, rankings, and match history.\n\nType `,resetbot` again within 30 seconds to confirm.");
}

async function handleStaffHelp(message: Message) {
  const staffRole = await storage.getStaffRole(message.author.id);
  if (!staffRole) {
    return;
  }
  
  let help = `**Staff Commands** (Only you can see this)\n`;
  
  if (storage.getStaffLevel(staffRole) >= 2) {
    help += `\n**Moderator:**\n\`,resetplayer @user [game]\` - Reset player stats`;
  }
  
  if (storage.getStaffLevel(staffRole) >= 3) {
    help += `\n\n**Admin:**\n\`,resetgame <game>\` - Reset game leaderboard\n\`,promote @user <role>\` - Promote to staff (admin/mod/support)\n\`,demote @user\` - Remove from staff`;
  }
  
  if (storage.isOwner(message.author.id)) {
    help += `\n\n**Owner:**\n\`,setemoji <type> <emoji>\` - Set custom emoji\n\`,resetemoji <type>\` - Reset emoji to default\n\`,resetbot\` - Reset entire bot (all stats)`;
  }
  
  help += `\n\n**All Staff:**\n\`,listemojis\` - View all emoji settings\n\`,staff\` - View staff team`;
  
  try {
    await message.author.send(help);
    await message.reply("Check your DMs for staff commands.");
  } catch (e) {
    await message.reply(help + "\n\n*(Enable DMs for private messages)*");
  }
}

async function handleRules(message: Message, args: string[]) {
  const game = args[0]?.toLowerCase();
  
  const rules: Record<string, string> = {
    connect4: `**Connect 4 Rules**
- Take turns dropping pieces into columns
- First to get 4 in a row (horizontal, vertical, or diagonal) wins
- Click the column buttons to play
- 30 seconds per turn
- Ranked game with Elo rating`,
    
    tictactoe: `**Tic Tac Toe Rules**
- Take turns placing X or O on the 3x3 grid
- First to get 3 in a row (horizontal, vertical, or diagonal) wins
- Click the position buttons to play
- Ranked game with Elo rating`,
    
    wordduel: `**Word Duel Rules**
- 5 rounds of scrambled words
- First to unscramble each word scores a point
- Type the unscrambled word to answer
- Player with most points wins
- "3... 2... 1... GO!" countdown before each round
- Ranked game with Elo rating`,
    
    wordle: `**Wordle Rules**
- Guess the 5-letter word in 6 attempts
- Type your guess as a message
- After each guess:
  - Green letter = correct position
  - Yellow letter = wrong position
  - Gray letter = not in word
- Solo game, wins count toward leaderboard`,
    
    rps: `**Rock Paper Scissors Rules**
- Best of 3 rounds
- Both players choose rock, paper, or scissors
- Rock beats scissors, scissors beats paper, paper beats rock
- First to win 2 rounds wins the match
- Click the button to make your choice
- Ranked game with Elo rating`,
    
    hangman: `**Hangman Rules**
- Guess the hidden 5-letter word
- Click letter buttons to guess
- 6 wrong guesses allowed
- Solo game, wins count toward leaderboard`,
    
    triviaduel: `**Trivia Duel Rules**
- 5 rounds of trivia questions
- First to answer correctly scores a point
- Click the button to select your answer
- Player with most points wins
- Ranked game with Elo rating`,
    
    mathblitz: `**Math Blitz Rules**
- 5 rounds of math problems
- First to type the correct answer scores a point
- Problems include +, -, ×, ÷
- Player with most points wins
- First to 3 wins the match
- Ranked game with Elo rating`,
    
    battleship: `**Battleship Rules**
- Each player has 2 ships on a 5x5 grid
- Take turns firing at opponent's grid
- Type coordinates (e.g., A1, B3) or click buttons
- Sink all enemy ships to win
- 💥 = Hit, 💨 = Miss
- Ranked game with Elo rating`,
  };
  
  if (!game || !rules[game]) {
    await message.channel.send(`Usage: \`,rules <game>\`\nGames: connect4, tictactoe, wordduel, wordle, rps, hangman, triviaduel, mathblitz, battleship`);
    return;
  }
  
  await message.channel.send(rules[game]);
}

async function handleSetEmoji(message: Message, args: string[]) {
  if (!storage.isOwner(message.author.id)) {
    await message.channel.send("Only the owner can customize emojis.");
    return;
  }
  
  const type = args[0]?.toLowerCase();
  const emoji = args[1];
  
  if (!type || !emoji) {
    await message.channel.send("Usage: ,setemoji <type> <emoji>\nUse ,listemojis to see all types.");
    return;
  }
  
  const success = await storage.setCustomEmoji(type, emoji);
  if (success) {
    await message.channel.send(`Set ${type} emoji to ${emoji}`);
  } else {
    await message.channel.send(`Invalid emoji type: ${type}\nUse ,listemojis to see all types.`);
  }
}

async function handleListEmojis(message: Message) {
  const managerRole = await storage.getStaffRole(message.author.id);
  if (!managerRole) {
    await message.channel.send("Only staff can view emoji settings.");
    return;
  }
  
  const emojis = await storage.getAllEmojis();
  let display = "**EMOJI SETTINGS**\n\n";
  
  const categories: Record<string, string[]> = {
    "Stats": ["win", "loss", "elo", "winrate", "coin", "streak", "daily"],
    "Ranks": ["bronze", "silver", "gold", "diamond", "champion"],
    "Staff": ["owner", "admin", "mod", "support"],
    "Wordle": ["correct", "wrongspot", "notinword"],
  };
  
  for (const [category, types] of Object.entries(categories)) {
    display += `**${category}:**\n`;
    for (const type of types) {
      const emoji = emojis[type];
      const modified = emoji.current !== emoji.default ? " *(custom)*" : "";
      display += `\u2800 ${type}: ${emoji.current}${modified}\n`;
    }
    display += "\n";
  }
  
  if (storage.isOwner(message.author.id)) {
    display += "Use `,setemoji <type> <emoji>` to change\nUse `,resetemoji <type>` to restore default";
  }
  
  await message.channel.send(display);
}

async function handleResetEmoji(message: Message, args: string[]) {
  if (!storage.isOwner(message.author.id)) {
    await message.channel.send("Only the owner can reset emojis.");
    return;
  }
  
  const type = args[0]?.toLowerCase();
  if (!type) {
    await message.channel.send("Usage: ,resetemoji <type>");
    return;
  }
  
  const defaults = storage.getDefaultEmojis();
  const success = await storage.resetCustomEmoji(type);
  
  if (success) {
    await message.channel.send(`Reset ${type} emoji to default: ${defaults[type]}`);
  } else {
    await message.channel.send(`Invalid emoji type: ${type}`);
  }
}

async function startPvPGame(player1Channel: TextChannel, gameType: string, player1Id: string, player2Id: string, player1Info?: {username: string, displayName?: string}, player2Info?: {username: string, displayName?: string}, player2ChannelId?: string) {
  if (player1Info) {
    await storage.getOrCreatePlayer(player1Id, player1Info.username, player1Info.displayName);
  }
  if (player2Info) {
    await storage.getOrCreatePlayer(player2Id, player2Info.username, player2Info.displayName);
  }
  
  let state: any;
  switch (gameType) {
    case "connect4":
      state = connect4.createGameState(player1Id, player2Id);
      break;
    case "tictactoe":
      state = tictactoe.createGameState(player1Id, player2Id);
      break;
    case "wordduel":
      state = wordduel.createGameState(player1Id, player2Id);
      break;
    case "rps":
      state = rps.createGameState(player1Id, player2Id);
      break;
    case "triviaduel":
      state = triviaduel.createGameState(player1Id, player2Id);
      triviaduel.getNextQuestion(state);
      break;
    case "mathblitz":
      state = mathblitz.createGameState(player1Id, player2Id);
      mathblitz.getNextProblem(state);
      break;
    case "battleship":
      state = battleship.createGameState(player1Id, player2Id);
      break;
    default:
      return;
  }
  
  const game = await storage.createActiveGame(gameType, player1Id, player1Channel.id, state, player2Id, player2ChannelId);
  await storage.recordRecentOpponent(player1Id, player2Id, gameType);
  
  const player1Name = await getPlayerName(player1Id);
  const player2Name = await getPlayerName(player2Id);
  
  let content = "";
  let buttons: any[] = [];
  
  if (gameType === "tictactoe") {
    buttons = ui.createTicTacToeBoard(state, game.id);
    const scoreText = state.maxRounds > 1 ? `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
    content = `**TIC TAC TOE**\n\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${player1Name}**'s turn\n`;
  } else if (gameType === "connect4") {
    buttons = ui.createConnect4Board(state, game.id);
    const display = ui.createConnect4Display(state);
    content = `**CONNECT 4**\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\nIt's **${player1Name}**'s turn (type 1-7 or click)\n`;
  } else if (gameType === "wordduel") {
    const scrambled = state.scrambledWords[0].toUpperCase();
    content = `**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nRound 1/5 | Score: 0 - 0\n\n⏱️ **3... 2... 1... GO!**\n\nUnscramble: **${scrambled}**\nType your answer!`;
  } else if (gameType === "rps") {
    buttons = [ui.createRPSButtons(game.id)];
    content = `**ROCK PAPER SCISSORS**\n\n${player1Name} ⏳ vs ⏳ ${player2Name}\n\nScore: **0** - **0**\nBest of 3\n\nChoose your weapon!`;
  } else if (gameType === "triviaduel") {
    buttons = ui.createTriviaDuelButtons(game.id, state.currentQuestion.answers);
    content = `**TRIVIA DUEL**\n\n${player1Name} ⏳ vs ⏳ ${player2Name}\nScore: **0** - **0**\n\n📚 *${state.currentQuestion.category}*\n\n**${state.currentQuestion.question}**\n\nRound 1/${state.maxRounds}`;
  } else if (gameType === "mathblitz") {
    content = `**MATH BLITZ**\n\n${player1Name} ⏳ vs ⏳ ${player2Name}\nScore: **0** - **0**\n\n🧮 **${state.currentProblem.question} = ?**\n\nType your answer!\n\nRound 1/${state.maxRounds}`;
  } else if (gameType === "battleship") {
    const shooterBoard = state.player1Board;
    buttons = ui.createBattleshipButtons(game.id, shooterBoard);
    content = `**BATTLESHIP**\n\n${player1Name} vs ${player2Name}\n\nYour ships: 2/2 | Enemy ships: 2/2\n\n**${player1Name}**'s turn! Type a coordinate (e.g., A1, B3) or click a button.`;
  }
  
  const messageOptions = gameType === "wordduel" ? { content } : { content, components: buttons };
  const player1Message = await player1Channel.send(messageOptions);
  gameMessages.set(game.id, player1Message.id);
  
  let player2MessageId: string | undefined;
  
  if (player2ChannelId && player2ChannelId !== player1Channel.id) {
    try {
      const player2Channel = await client.channels.fetch(player2ChannelId) as TextChannel;
      if (player2Channel) {
        const player2Message = await player2Channel.send(messageOptions);
        player2MessageId = player2Message.id;
      }
    } catch (e) {
      console.error("Could not send to player2 channel:", e);
    }
  }
  
  await storage.updateGameMessageIds(game.id, player1Message.id, player2MessageId);
  
  startGameTimer(game.id, player1Channel);
}

async function startBotGame(channel: TextChannel, gameType: string, playerId: string, playerInfo: {username: string, displayName?: string}) {
  await storage.getOrCreatePlayer(playerId, playerInfo.username, playerInfo.displayName);
  await ensureBotProfile();
  
  let state: any;
  switch (gameType) {
    case "connect4":
      state = connect4.createGameState(playerId, BOT_PLAYER_ID);
      break;
    case "tictactoe":
      state = tictactoe.createGameState(playerId, BOT_PLAYER_ID);
      break;
    default:
      return;
  }
  
  const game = await storage.createActiveGame(gameType, playerId, channel.id, state, BOT_PLAYER_ID);
  
  const playerName = await getPlayerName(playerId);
  const botName = "Play";
  
  let content = "";
  let buttons: any[] = [];
  
  if (gameType === "tictactoe") {
    buttons = ui.createTicTacToeBoard(state, game.id);
    const scoreText = state.maxRounds > 1 ? `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
    content = `**TIC TAC TOE** 🤖\n\n${playerName} vs ${botName}${scoreText}\n\nIt's **${playerName}**'s turn\n\n*Unranked game vs Play*`;
  } else if (gameType === "connect4") {
    buttons = ui.createConnect4Board(state, game.id);
    const display = ui.createConnect4Display(state);
    content = `**CONNECT 4** 🤖\n\n🔴 ${playerName} vs 🟡 ${botName}\n\n${display}\n\nIt's **${playerName}**'s turn (type 1-7 or click)\n\n*Unranked game vs Play*`;
  }
  
  const messageOptions = { content, components: buttons };
  const gameMessage = await channel.send(messageOptions);
  gameMessages.set(game.id, gameMessage.id);
  
  await storage.updateGameMessageIds(game.id, gameMessage.id);
  
  startGameTimer(game.id, channel);
}

async function handleGameCommand(message: Message, gameType: string, args: string[] = []) {
  const playerId = message.author.id;
  
  await storage.getOrCreatePlayer(playerId, message.author.username, message.author.displayName);
  
  const existingGame = await storage.getActiveGame(playerId);
  if (existingGame) {
    await message.channel.send("You're already in a game. Use `,quit` to leave.");
    return;
  }
  
  // Check if user wants to play against the bot
  if (args.length > 0 && args[0].toLowerCase() === "play" && BOT_GAMES.includes(gameType)) {
    await ensureBotProfile();
    const channel = message.channel as TextChannel;
    await channel.send(`Starting an unranked **${gameType.toUpperCase()}** game vs **Play** 🤖`);
    const player1Info = { username: message.author.username, displayName: message.author.displayName };
    await startBotGame(channel, gameType, playerId, player1Info);
    return;
  }
  
  // Disabled for testing - uncomment to enable forfeit lockout
  // if (await storage.isQueueLocked(playerId)) {
  //   await message.channel.send("You're temporarily locked from matchmaking due to forfeits.");
  //   return;
  // }
  
  if (message.mentions.users.size > 0) {
    const challenged = message.mentions.users.first()!;
    if (challenged.id === playerId) {
      await message.channel.send("You can't challenge yourself!");
      return;
    }
    
    const challengedGame = await storage.getActiveGame(challenged.id);
    if (challengedGame) {
      await message.channel.send(`${challenged.username} is already in a game.`);
      return;
    }
    
    await storage.createChallenge(playerId, challenged.id, gameType, message.channel.id, message.guildId || undefined);
    const challengerName = await getPlayerName(playerId);
    await message.channel.send(`**${challenged.displayName || challenged.username}**, you've been challenged to **${gameType.toUpperCase()}** by **${challengerName}**!\nType \`,accept\` to play.`);
    return;
  }
  
  await storage.addToQueue(playerId, gameType, message.channel.id);
  const searchingMsg = await message.channel.send(`Looking for a **${gameType.toUpperCase()}** opponent... (type \`,quit\` to cancel)`);
  
  let attempts = 0;
  const findOpponent = async () => {
    attempts++;
    let rankRange = 100;
    if (attempts > 6) rankRange = 10000;
    else if (attempts > 3) rankRange = 500;
    
    const match = await storage.findMatch(playerId, gameType, rankRange);
    if (match) {
      await storage.removeFromQueue(playerId);
      await storage.removeFromQueue(match.discordId);
      matchmakingTimers.delete(playerId);
      const opponentTimer = matchmakingTimers.get(match.discordId);
      if (opponentTimer) {
        clearTimeout(opponentTimer);
        matchmakingTimers.delete(match.discordId);
      }
      
      try { await searchingMsg.delete(); } catch (e) {}
      
      const channel = message.channel as TextChannel;
      const matchFoundMsg = `<@${playerId}> vs <@${match.discordId}> - Match found! Starting **${gameType.toUpperCase()}**...`;
      const msg1 = await channel.send(matchFoundMsg);
      setTimeout(() => { try { msg1.delete(); } catch (e) {} }, 5000);
      
      if (match.channelId && match.channelId !== channel.id) {
        try {
          const player2Channel = await client.channels.fetch(match.channelId) as TextChannel;
          if (player2Channel) {
            const msg2 = await player2Channel.send(matchFoundMsg);
            setTimeout(() => { try { msg2.delete(); } catch (e) {} }, 5000);
          }
        } catch (e) {}
      }
      
      const player1Info = { username: message.author.username, displayName: message.author.displayName };
      const matchPlayer = await storage.getPlayer(match.discordId);
      const player2Info = matchPlayer ? { username: matchPlayer.username, displayName: matchPlayer.displayName || undefined } : undefined;
      await startPvPGame(channel, gameType, playerId, match.discordId, player1Info, player2Info, match.channelId);
    } else if (attempts >= 9 && BOT_GAMES.includes(gameType)) {
      await storage.removeFromQueue(playerId);
      matchmakingTimers.delete(playerId);
      try { await searchingMsg.delete(); } catch (e) {}
      
      await ensureBotProfile();
      const channel = message.channel as TextChannel;
      await channel.send(`No human opponent found. Starting an unranked game vs **Play** 🤖`);
      
      const player1Info = { username: message.author.username, displayName: message.author.displayName };
      const player2Info = { username: "playground_bot", displayName: "Play" };
      await startBotGame(channel, gameType, playerId, player1Info);
    } else if (attempts < 12) {
      matchmakingTimers.set(playerId, setTimeout(findOpponent, 5000));
    } else {
      await storage.removeFromQueue(playerId);
      matchmakingTimers.delete(playerId);
      try { await searchingMsg.delete(); } catch (e) {}
      await message.channel.send("No opponent found. Try again later or challenge someone directly.");
    }
  };
  
  findOpponent();
}

async function handleAccept(message: Message) {
  const allChallenges = await storage.getAllChallengesForUser(message.author.id);
  
  if (allChallenges.length === 0) {
    await message.channel.send("You have no pending challenges.");
    return;
  }
  
  // Find a challenge from the same server
  const currentGuildId = message.guildId;
  const challenge = allChallenges.find(c => c.guildId === currentGuildId) || null;
  
  if (!challenge) {
    await message.channel.send("You have no pending challenges in this server.");
    return;
  }
  
  const challengerPlayer = await storage.getPlayer(challenge.challengerId);
  if (!challengerPlayer) {
    await storage.removeChallenge(challenge.id);
    await message.channel.send("Challenge expired - challenger not found.");
    return;
  }
  
  const existingGame = await storage.getActiveGame(challenge.challengerId);
  if (existingGame) {
    await storage.removeChallenge(challenge.id);
    await message.channel.send("Challenge expired - challenger is already in a game.");
    return;
  }
  
  await storage.removeChallenge(challenge.id);
  await storage.getOrCreatePlayer(message.author.id, message.author.username, message.author.displayName);
  
  const gameNames: Record<string, string> = {
    tictactoe: "Tic Tac Toe",
    connect4: "Connect 4",
    wordduel: "Word Duel",
    rps: "Rock Paper Scissors",
    triviaduel: "Trivia Duel",
    mathblitz: "Math Blitz",
    battleship: "Battleship"
  };
  const gameName = gameNames[challenge.gameType] || challenge.gameType;
  const challengerName = challengerPlayer.displayName || challengerPlayer.username;
  
  const channel = message.channel as TextChannel;
  const player1Info = { username: challengerPlayer.username, displayName: challengerPlayer.displayName || undefined };
  const player2Info = { username: message.author.username, displayName: message.author.displayName };
  
  await message.channel.send(`Starting **${gameName}** with **${challengerName}**...`);
  await startPvPGame(channel, challenge.gameType, challenge.challengerId, message.author.id, player1Info, player2Info);
}

async function handleSoloGame(message: Message, gameType: string) {
  const playerId = message.author.id;
  
  await storage.getOrCreatePlayer(playerId, message.author.username, message.author.displayName);
  
  const existingGame = await storage.getActiveGame(playerId);
  if (existingGame) {
    await message.channel.send("You're already in a game. Use `,quit` to leave.");
    return;
  }
  
  let state: any;
  let sentMessage;
  
  if (gameType === "wordle") {
    state = wordle.createGameState(playerId);
    const game = await storage.createActiveGame(gameType, playerId, message.channel.id, state);
    
    const wordleGuide = `🟩 = Correct letter, correct spot\n🟨 = Correct letter, wrong spot\n⬛ = Letter not in word`;
    sentMessage = await message.channel.send({
      content: `**WORDLE**\n\n${wordleGuide}\n\n🔲🔲🔲🔲🔲\n🔲🔲🔲🔲🔲\n🔲🔲🔲🔲🔲\n🔲🔲🔲🔲🔲\n🔲🔲🔲🔲🔲\n🔲🔲🔲🔲🔲\n\nGuesses: 0/6\nType a 5-letter word to guess!`
    });
    
    if (sentMessage) {
      gameMessages.set(game.id, sentMessage.id);
    }
  } else if (gameType === "hangman") {
    state = hangman.createGameState(playerId);
    const game = await storage.createActiveGame(gameType, playerId, message.channel.id, state);
    
    const figure = hangman.getHangmanFigure(0);
    const displayWord = hangman.getDisplayWord(state);
    const buttons = ui.createHangmanButtons(game.id, state.guessedLetters);
    
    sentMessage = await message.channel.send({
      content: `**HANGMAN**\n\n${figure}\n\n**Word:** \`${displayWord}\`\n\nGuesses left: ${state.maxWrongGuesses - state.wrongGuesses}`,
      components: buttons
    });
    
    if (sentMessage) {
      gameMessages.set(game.id, sentMessage.id);
    }
  }
}

async function handleQuit(message: Message) {
  const playerId = message.author.id;
  
  const timer = matchmakingTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    matchmakingTimers.delete(playerId);
    await storage.removeFromQueue(playerId);
    await message.channel.send("Left the matchmaking queue.");
    return;
  }
  
  const game = await storage.getActiveGame(playerId);
  if (!game) {
    await message.channel.send("You're not in a game.");
    return;
  }
  
  clearGameTimer(game.id);
  
  if (game.player2Id) {
    const opponentId = game.player1Id === playerId ? game.player2Id : game.player1Id;
    const playerName = await getPlayerName(playerId);
    const opponentName = await getPlayerName(opponentId);
    const isAgainstBot = isBotGame(game.player1Id, game.player2Id);
    
    if (isAgainstBot) {
      await storage.recordGameResult(BOT_PLAYER_ID, game.gameType, "win");
      await sendToGameChannels(game, { content: `**${playerName}** forfeited. **${opponentName}** wins!\n\n*Unranked game vs Play*` });
    } else if (PVP_GAMES.includes(game.gameType)) {
      const { winnerChange, eloAffected, dailyGamesCount } = await storage.recordPvPResult(opponentId, playerId, game.gameType, opponentName, playerName);
      clearLeaderboardCache(game.gameType);
      await storage.recordForfeit(playerId);
      const eloText = eloAffected ? ` (+${winnerChange})` : "";
      const noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
      await sendToGameChannels(game, { content: `**${playerName}** forfeited. **${opponentName}** wins!${eloText}${noEloNote}` });
    } else {
      await storage.recordGameResult(playerId, game.gameType, "loss");
      await storage.recordGameResult(opponentId, game.gameType, "win");
      await storage.recordForfeit(playerId);
      await sendToGameChannels(game, { content: `**${playerName}** forfeited. **${opponentName}** wins!` });
    }
  } else {
    await message.channel.send("Game ended.");
  }
  
  gameMessages.delete(game.id);
  await storage.endGame(game.id);
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  
  if (customId.startsWith("ttt_")) {
    const parts = customId.split("_");
    const gameId = parts[1];
    const position = parseInt(parts[2]);
    
    const game = await storage.getActiveGameById(gameId);
    if (!game) {
      await interaction.reply({ content: "Game not found.", ephemeral: true });
      return;
    }
    
    const state = game.state as any;
    const isPlayer1Turn = state.currentPlayer === 1;
    const expectedPlayer = isPlayer1Turn ? state.player1Id : state.player2Id;
    
    if (userId !== expectedPlayer) {
      await interaction.reply({ content: "It's not your turn!", ephemeral: true });
      return;
    }
    
    if (!tictactoe.makeMove(state, position)) {
      await interaction.reply({ content: "Invalid move.", ephemeral: true });
      return;
    }
    
    const currentPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(state));
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    
    const isAgainstBot = isBotGame(state.player1Id, state.player2Id);
    const botIndicator = isAgainstBot ? " 🤖" : "";
    const unrankedNote = isAgainstBot ? "\n\n*Unranked game vs Play*" : "";
    
    if (tictactoe.checkWin(state.board, state.currentPlayer)) {
      tictactoe.recordRoundWin(state, state.currentPlayer);
      
      const matchResult = tictactoe.isMatchOver(state);
      if (matchResult.over) {
        const winnerId = matchResult.winner === 1 ? state.player1Id : state.player2Id;
        const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
        
        let eloText = "";
        let noEloNote = "";
        if (matchResult.winner) {
          const winnerName = await getPlayerName(winnerId);
          const loserName = await getPlayerName(loserId);
          
          if (isAgainstBot) {
            await storage.recordGameResult(BOT_PLAYER_ID, "tictactoe", winnerId === BOT_PLAYER_ID ? "win" : "loss");
          } else {
            const result = await storage.recordPvPResult(winnerId, loserId, "tictactoe", winnerName, loserName);
            eloText = result.eloAffected ? ` (+${result.winnerChange})` : "";
            noEloNote = !result.eloAffected ? `\n\n*No rating change - you've played ${result.dailyGamesCount} games together today (max 3 for rating)*` : "";
            clearLeaderboardCache("tictactoe");
          }
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const winnerName = await getPlayerName(winnerId);
        const buttons = ui.createTicTacToeBoard(state, game.id, true);
        if (!isAgainstBot) {
          const rematchBtn = ui.createRematchButton("tictactoe", state.player1Id, state.player2Id);
          buttons.push(rematchBtn);
        }
        const scoreText = state.maxRounds > 1 ? `\nFinal Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
        const content = `**TIC TAC TOE**${botIndicator}\n\n${player1Name} vs ${player2Name}${scoreText}\n\n🎉 **${winnerName}** wins the match!${eloText}${noEloNote}${unrankedNote}`;
        
        await interaction.deferUpdate();
        await syncGameMessages(game, content, buttons);
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state, tictactoe.getCurrentPlayerId(state));
      
      const nextPlayerId = tictactoe.getCurrentPlayerId(state);
      const nextPlayerName = await getPlayerName(nextPlayerId);
      const buttons = ui.createTicTacToeBoard(state, game.id);
      const scoreText = `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
      const content = `**TIC TAC TOE**${botIndicator}\n\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn${unrankedNote}`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      
      if (nextPlayerId === BOT_PLAYER_ID && interaction.channel) {
        const updatedGame = await storage.getActiveGameById(game.id);
        if (updatedGame) {
          setTimeout(() => makeBotMove(updatedGame, interaction.channel as TextChannel), 1500);
        }
      } else if (interaction.channel) {
        resetGameTimer(game.id, interaction.channel as TextChannel);
      }
      return;
    }
    
    if (tictactoe.isBoardFull(state.board)) {
      if (state.currentRound >= state.maxRounds) {
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const buttons = ui.createTicTacToeBoard(state, game.id, true);
        if (!isAgainstBot) {
          const rematchBtn = ui.createRematchButton("tictactoe", state.player1Id, state.player2Id);
          buttons.push(rematchBtn);
        }
        const scoreText = `\nFinal Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
        const content = `**TIC TAC TOE**${botIndicator}\n\n${player1Name} vs ${player2Name}${scoreText}\n\nMatch ended in a draw!${unrankedNote}`;
        
        await interaction.deferUpdate();
        await syncGameMessages(game, content, buttons);
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state, tictactoe.getCurrentPlayerId(state));
      
      const nextPlayerId = tictactoe.getCurrentPlayerId(state);
      const nextPlayerName = await getPlayerName(nextPlayerId);
      const buttons = ui.createTicTacToeBoard(state, game.id);
      const scoreText = `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
      const content = `**TIC TAC TOE**${botIndicator}\n\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn${unrankedNote}`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      
      if (nextPlayerId === BOT_PLAYER_ID && interaction.channel) {
        const updatedGame = await storage.getActiveGameById(game.id);
        if (updatedGame) {
          setTimeout(() => makeBotMove(updatedGame, interaction.channel as TextChannel), 1500);
        }
      } else if (interaction.channel) {
        resetGameTimer(game.id, interaction.channel as TextChannel);
      }
      return;
    }
    
    tictactoe.switchTurn(state);
    await storage.updateGameState(game.id, state, tictactoe.getCurrentPlayerId(state));
    
    const nextPlayerId = tictactoe.getCurrentPlayerId(state);
    const nextPlayerName = await getPlayerName(nextPlayerId);
    const buttons = ui.createTicTacToeBoard(state, game.id);
    const scoreText = state.maxRounds > 1 ? `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
    const content = `**TIC TAC TOE**${botIndicator}\n\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn${unrankedNote}`;
    
    await interaction.deferUpdate();
    await syncGameMessages(game, content, buttons);
    
    if (nextPlayerId === BOT_PLAYER_ID && interaction.channel) {
      const updatedGame = await storage.getActiveGameById(game.id);
      if (updatedGame) {
        console.log(`Triggering bot move for TTT game ${game.id}`);
        setTimeout(() => makeBotMove(updatedGame, interaction.channel as TextChannel), 1500);
      }
    } else if (interaction.channel) {
      resetGameTimer(game.id, interaction.channel as TextChannel);
    }
  }
  
  else if (customId.startsWith("c4_")) {
    const parts = customId.split("_");
    const gameId = parts[1];
    const col = parseInt(parts[2]);
    
    const game = await storage.getActiveGameById(gameId);
    if (!game) {
      await interaction.reply({ content: "Game not found.", ephemeral: true });
      return;
    }
    
    const state = game.state as any;
    const expectedPlayer = state.currentPlayer === 1 ? state.player1Id : state.player2Id;
    
    if (userId !== expectedPlayer) {
      await interaction.reply({ content: "It's not your turn!", ephemeral: true });
      return;
    }
    
    const result = connect4.dropPiece(state, col);
    if (!result.success) {
      await interaction.reply({ content: "Column is full!", ephemeral: true });
      return;
    }
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    const display = ui.createConnect4Display(state);
    
    const isAgainstBot = isBotGame(state.player1Id, state.player2Id);
    const botIndicator = isAgainstBot ? " 🤖" : "";
    const unrankedNote = isAgainstBot ? "\n\n*Unranked game vs Play*" : "";
    
    if (connect4.checkWin(state.board, state.currentPlayer)) {
      const winnerId = connect4.getCurrentPlayerId(state);
      const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
      
      const winnerName = await getPlayerName(winnerId);
      const loserName = await getPlayerName(loserId);
      
      let eloText = "";
      let noEloNote = "";
      
      if (isAgainstBot) {
        await storage.recordGameResult(BOT_PLAYER_ID, "connect4", winnerId === BOT_PLAYER_ID ? "win" : "loss");
      } else {
        const result = await storage.recordPvPResult(winnerId, loserId, "connect4", winnerName, loserName);
        eloText = result.eloAffected ? ` (+${result.winnerChange})` : "";
        noEloNote = !result.eloAffected ? `\n\n*No rating change - you've played ${result.dailyGamesCount} games together today (max 3 for rating)*` : "";
        clearLeaderboardCache("connect4");
      }
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const buttons = ui.createConnect4Board(state, game.id, true);
      if (!isAgainstBot) {
        const rematchBtn = ui.createRematchButton("connect4", state.player1Id, state.player2Id);
        buttons.push(rematchBtn);
      }
      const content = `**CONNECT 4**${botIndicator}\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\n🎉 **${winnerName}** wins!${eloText}${noEloNote}${unrankedNote}`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      return;
    }
    
    if (connect4.isBoardFull(state.board)) {
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const buttons = ui.createConnect4Board(state, game.id, true);
      if (!isAgainstBot) {
        const rematchBtn = ui.createRematchButton("connect4", state.player1Id, state.player2Id);
        buttons.push(rematchBtn);
      }
      const content = `**CONNECT 4**${botIndicator}\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\nIt's a draw!${unrankedNote}`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      return;
    }
    
    connect4.switchTurn(state);
    await storage.updateGameState(game.id, state, connect4.getCurrentPlayerId(state));
    
    const nextPlayerId = connect4.getCurrentPlayerId(state);
    const nextPlayerName = await getPlayerName(nextPlayerId);
    const buttons = ui.createConnect4Board(state, game.id);
    const content = `**CONNECT 4**${botIndicator}\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\nIt's **${nextPlayerName}**'s turn (type 1-7 or click)${unrankedNote}`;
    
    await interaction.deferUpdate();
    await syncGameMessages(game, content, buttons);
    
    if (nextPlayerId === BOT_PLAYER_ID) {
      const updatedGame = await storage.getActiveGameById(game.id);
      if (updatedGame) {
        setTimeout(() => makeBotMove(updatedGame, interaction.channel as TextChannel), 1500);
      }
    } else {
      resetGameTimer(game.id, interaction.channel as TextChannel);
    }
  }
  
  else if (customId.startsWith("quit_")) {
    const gameId = customId.split("_")[1];
    const game = await storage.getActiveGameById(gameId);
    
    if (!game) {
      await interaction.reply({ content: "Game not found.", ephemeral: true });
      return;
    }
    
    if (userId !== game.player1Id && userId !== game.player2Id) {
      await interaction.reply({ content: "You're not in this game!", ephemeral: true });
      return;
    }
    
    clearGameTimer(game.id);
    
    if (game.player2Id) {
      const opponentId = game.player1Id === userId ? game.player2Id : game.player1Id;
      const userName = await getPlayerName(userId);
      const opponentName = await getPlayerName(opponentId);
      const isAgainstBot = isBotGame(game.player1Id, game.player2Id);
      
      let eloText = "";
      let noEloNote = "";
      if (isAgainstBot) {
        await storage.recordGameResult(BOT_PLAYER_ID, game.gameType, "win");
        noEloNote = "\n\n*Unranked game vs Play*";
      } else if (PVP_GAMES.includes(game.gameType)) {
        const { winnerChange, eloAffected, dailyGamesCount } = await storage.recordPvPResult(opponentId, userId, game.gameType, opponentName, userName);
        eloText = eloAffected ? ` (+${winnerChange})` : "";
        noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
        clearLeaderboardCache(game.gameType);
        await storage.recordForfeit(userId);
      } else {
        await storage.recordGameResult(userId, game.gameType, "loss");
        await storage.recordGameResult(opponentId, game.gameType, "win");
        await storage.recordForfeit(userId);
      }
      
      await interaction.update({
        content: `**${userName}** forfeited. **${opponentName}** wins!${eloText}${noEloNote}`,
        components: []
      });
    } else {
      await interaction.update({
        content: "Game ended.",
        components: []
      });
    }
    
    await storage.endGame(game.id);
  }
  
  else if (customId.startsWith("rematch_")) {
    const parts = customId.split("_");
    const gameType = parts[1];
    const player1Id = parts[2];
    const player2Id = parts[3];
    
    if (userId !== player1Id && userId !== player2Id) {
      await interaction.reply({ content: "You weren't in this game.", ephemeral: true });
      return;
    }
    
    const opponentId = userId === player1Id ? player2Id : player1Id;
    const challengerId = userId;
    const channelId = interaction.channelId;
    
    const existingGame = await storage.getActiveGame(challengerId);
    if (existingGame) {
      await interaction.reply({ content: "You're already in a game!", ephemeral: true });
      return;
    }
    
    const opponentGame = await storage.getActiveGame(opponentId);
    if (opponentGame) {
      await interaction.reply({ content: "Your opponent is in another game.", ephemeral: true });
      return;
    }
    
    const existingChallenge = await storage.getChallenge(opponentId, challengerId);
    if (existingChallenge) {
      await interaction.reply({ content: "You already have a pending challenge to this player.", ephemeral: true });
      return;
    }
    
    const guildId = interaction.guildId || undefined;
    await storage.createChallenge(challengerId, opponentId, gameType, channelId, guildId);
    const challengerName = await getPlayerName(challengerId);
    
    const gameNames: Record<string, string> = {
      tictactoe: "Tic Tac Toe",
      connect4: "Connect 4",
      wordduel: "Word Duel",
      rps: "Rock Paper Scissors",
      triviaduel: "Trivia Duel",
      mathblitz: "Math Blitz",
      battleship: "Battleship"
    };
    
    await interaction.reply({ 
      content: `**${challengerName}** wants a rematch in ${gameNames[gameType] || gameType}!\n<@${opponentId}>, type \`,accept\` to accept.`
    });
  }
  
  else if (customId.startsWith("gg_")) {
    const parts = customId.split("_");
    const player1Id = parts[1];
    const player2Id = parts[2];
    
    if (userId !== player1Id && userId !== player2Id) {
      await interaction.reply({ content: "You weren't in this game.", ephemeral: true });
      return;
    }
    
    const opponentId = userId === player1Id ? player2Id : player1Id;
    const senderName = await getPlayerName(userId);
    
    await interaction.reply({
      content: `**${senderName}** says GG! 🤝 <@${opponentId}>`
    });
  }
  
  else if (customId.startsWith("rps_")) {
    const parts = customId.split("_");
    const gameId = parts[1];
    const choice = parts[2];
    
    const game = await storage.getActiveGameById(gameId);
    if (!game) {
      await interaction.reply({ content: "Game not found.", ephemeral: true });
      return;
    }
    
    const state = game.state as any;
    
    if (userId !== state.player1Id && userId !== state.player2Id) {
      await interaction.reply({ content: "You're not in this game!", ephemeral: true });
      return;
    }
    
    const madeChoice = rps.makeChoice(state, userId, choice);
    if (!madeChoice) {
      await interaction.reply({ content: "You've already made your choice!", ephemeral: true });
      return;
    }
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    
    if (rps.bothPlayersChose(state)) {
      const roundResult = rps.getRoundResult(state);
      const p1Emoji = rps.getChoiceEmoji(roundResult.p1Choice);
      const p2Emoji = rps.getChoiceEmoji(roundResult.p2Choice);
      
      let roundText = "";
      if (roundResult.winner) {
        const winnerName = roundResult.winner === state.player1Id ? player1Name : player2Name;
        roundText = `${p1Emoji} vs ${p2Emoji}\n**${winnerName}** wins this round!`;
      } else {
        roundText = `${p1Emoji} vs ${p2Emoji}\nIt's a tie!`;
      }
      
      const matchResult = rps.isMatchOver(state);
      if (matchResult.over && matchResult.winner) {
        const winnerId = matchResult.winner;
        const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
        const winnerName = await getPlayerName(winnerId);
        const loserName = await getPlayerName(loserId);
        
        const { winnerChange, eloAffected, dailyGamesCount } = await storage.recordPvPResult(winnerId, loserId, "rps", winnerName, loserName);
        const eloText = eloAffected ? ` (+${winnerChange})` : "";
        const noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
        clearLeaderboardCache("rps");
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const buttons = [ui.createRPSButtons(game.id, true), ui.createRematchButton("rps", state.player1Id, state.player2Id)];
        const content = `**ROCK PAPER SCISSORS**\n\n${player1Name} vs ${player2Name}\n\n${roundText}\n\nFinal Score: **${state.player1Wins}** - **${state.player2Wins}**\n\n🎉 **${winnerName}** wins the match!${eloText}${noEloNote}`;
        
        await interaction.deferUpdate();
        await syncGameMessages(game, content, buttons);
        return;
      }
      
      rps.resetRound(state);
      await storage.updateGameState(game.id, state);
      
      const buttons = [ui.createRPSButtons(game.id)];
      const content = `**ROCK PAPER SCISSORS**\n\n${player1Name} vs ${player2Name}\n\n${roundText}\n\nScore: **${state.player1Wins}** - **${state.player2Wins}**\nRound ${state.currentRound}\n\nChoose your weapon!`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
    } else {
      await storage.updateGameState(game.id, state);
      
      const p1Status = state.player1Choice ? "✅" : "⏳";
      const p2Status = state.player2Choice ? "✅" : "⏳";
      
      const buttons = [ui.createRPSButtons(game.id)];
      const content = `**ROCK PAPER SCISSORS**\n\n${player1Name} ${p1Status} vs ${p2Status} ${player2Name}\n\nScore: **${state.player1Wins}** - **${state.player2Wins}**\nBest of 3\n\nChoose your weapon!`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
    }
  }
  
  else if (customId.startsWith("hm_")) {
    const parts = customId.split("_");
    const gameId = parts[1];
    const letter = parts[2];
    
    const game = await storage.getActiveGameById(gameId);
    if (!game) {
      await interaction.reply({ content: "Game not found.", ephemeral: true });
      return;
    }
    
    const state = game.state as any;
    
    if (userId !== state.playerId) {
      await interaction.reply({ content: "This isn't your game!", ephemeral: true });
      return;
    }
    
    const result = hangman.guessLetter(state, letter);
    if (result.alreadyGuessed) {
      await interaction.reply({ content: "You already guessed that letter!", ephemeral: true });
      return;
    }
    
    await storage.updateGameState(game.id, state);
    
    const figure = hangman.getHangmanFigure(state.wrongGuesses);
    const displayWord = hangman.getDisplayWord(state);
    const wrongLetters = state.guessedLetters.filter((l: string) => !state.word.includes(l)).join(" ");
    
    if (hangman.isGameWon(state)) {
      await storage.recordGameResult(state.playerId, "hangman", "win");
      clearLeaderboardCache("hangman");
      await storage.endGame(game.id);
      
      const time = hangman.getCompletionTime(state);
      const content = `**HANGMAN**\n\n${figure}\n\n**Word:** \`${displayWord}\`\n\n🎉 You won! Time: ${time}s`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, []);
      return;
    }
    
    if (hangman.isGameLost(state)) {
      await storage.recordGameResult(state.playerId, "hangman", "loss");
      clearLeaderboardCache("hangman");
      await storage.endGame(game.id);
      
      const content = `**HANGMAN**\n\n${figure}\n\n**Word:** \`${state.word}\`\n\n😔 Game over! The word was: **${state.word}**`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, []);
      return;
    }
    
    const buttons = ui.createHangmanButtons(game.id, state.guessedLetters);
    const wrongText = wrongLetters ? `\nWrong: ${wrongLetters}` : "";
    const content = `**HANGMAN**\n\n${figure}\n\n**Word:** \`${displayWord}\`${wrongText}\n\nGuesses left: ${state.maxWrongGuesses - state.wrongGuesses}`;
    
    await interaction.deferUpdate();
    await syncGameMessages(game, content, buttons);
  }
  
  else if (customId.startsWith("td_")) {
    const parts = customId.split("_");
    const gameId = parts[1];
    const answerIndex = parseInt(parts[2]);
    
    const game = await storage.getActiveGameById(gameId);
    if (!game) {
      await interaction.reply({ content: "Game not found.", ephemeral: true });
      return;
    }
    
    const state = game.state as any;
    
    if (userId !== state.player1Id && userId !== state.player2Id) {
      await interaction.reply({ content: "You're not in this game!", ephemeral: true });
      return;
    }
    
    const isPlayer1 = userId === state.player1Id;
    const alreadyAnswered = isPlayer1 ? state.player1Answered : state.player2Answered;
    if (alreadyAnswered) {
      await interaction.reply({ content: "You've already answered!", ephemeral: true });
      return;
    }
    
    const result = triviaduel.submitAnswer(state, userId, answerIndex);
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    
    if (triviaduel.bothAnswered(state)) {
      const correctAnswer = state.currentQuestion.answers[state.currentQuestion.correctIndex];
      let roundText = "";
      if (state.roundWinner) {
        const winnerName = state.roundWinner === state.player1Id ? player1Name : player2Name;
        roundText = `✅ Correct answer: **${correctAnswer}**\n**${winnerName}** got it first!`;
      } else {
        roundText = `✅ Correct answer: **${correctAnswer}**\nNeither player got it right!`;
      }
      
      triviaduel.nextRound(state);
      const matchResult = triviaduel.isMatchOver(state);
      
      if (matchResult.over) {
        let eloText = "";
        let noEloNote = "";
        let resultText = "";
        
        if (matchResult.winner) {
          const winnerId = matchResult.winner;
          const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
          const winnerName = await getPlayerName(winnerId);
          const loserName = await getPlayerName(loserId);
          
          const eloResult = await storage.recordPvPResult(winnerId, loserId, "triviaduel", winnerName, loserName);
          eloText = eloResult.eloAffected ? ` (+${eloResult.winnerChange})` : "";
          noEloNote = !eloResult.eloAffected ? `\n\n*No rating change - you've played ${eloResult.dailyGamesCount} games together today (max 3 for rating)*` : "";
          clearLeaderboardCache("triviaduel");
          resultText = `🎉 **${winnerName}** wins!${eloText}`;
        } else {
          resultText = "It's a draw!";
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const buttons = ui.createTriviaDuelButtons(game.id, state.currentQuestion?.answers || [], true);
        buttons.push(ui.createRematchButton("triviaduel", state.player1Id, state.player2Id));
        const content = `**TRIVIA DUEL**\n\n${player1Name} vs ${player2Name}\n\n${roundText}\n\nFinal Score: **${state.player1Score}** - **${state.player2Score}**\n\n${resultText}${noEloNote}`;
        
        await interaction.deferUpdate();
        await syncGameMessages(game, content, buttons);
        return;
      }
      
      triviaduel.getNextQuestion(state);
      await storage.updateGameState(game.id, state);
      
      const buttons = ui.createTriviaDuelButtons(game.id, state.currentQuestion.answers);
      const content = `**TRIVIA DUEL**\n\n${player1Name} vs ${player2Name}\n\n${roundText}\n\nScore: **${state.player1Score}** - **${state.player2Score}**\n\n📚 *${state.currentQuestion.category}*\n\n**${state.currentQuestion.question}**\n\nRound ${state.currentRound}/${state.maxRounds}`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      resetGameTimer(game.id, interaction.channel as TextChannel);
    } else {
      await storage.updateGameState(game.id, state);
      
      const p1Status = state.player1Answered ? "✅" : "⏳";
      const p2Status = state.player2Answered ? "✅" : "⏳";
      
      const buttons = ui.createTriviaDuelButtons(game.id, state.currentQuestion.answers);
      const content = `**TRIVIA DUEL**\n\n${player1Name} ${p1Status} vs ${p2Status} ${player2Name}\nScore: **${state.player1Score}** - **${state.player2Score}**\n\n📚 *${state.currentQuestion.category}*\n\n**${state.currentQuestion.question}**\n\nRound ${state.currentRound}/${state.maxRounds}`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
    }
  }
  
  else if (customId.startsWith("bs_")) {
    const parts = customId.split("_");
    const gameId = parts[1];
    const position = parseInt(parts[2]);
    
    const game = await storage.getActiveGameById(gameId);
    if (!game) {
      await interaction.reply({ content: "Game not found.", ephemeral: true });
      return;
    }
    
    const state = game.state as any;
    
    if (userId !== state.player1Id && userId !== state.player2Id) {
      await interaction.reply({ content: "You're not in this game!", ephemeral: true });
      return;
    }
    
    if (userId !== state.currentTurn) {
      await interaction.reply({ content: "It's not your turn!", ephemeral: true });
      return;
    }
    
    const result = battleship.fireShot(state, userId, position);
    if (!result.valid) {
      await interaction.reply({ content: "Invalid shot!", ephemeral: true });
      return;
    }
    
    await storage.updateGameState(game.id, state, state.currentTurn);
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    
    const gameResult = battleship.isGameOver(state);
    if (gameResult.over && gameResult.winner) {
      const winnerId = gameResult.winner;
      const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
      const winnerName = await getPlayerName(winnerId);
      const loserName = await getPlayerName(loserId);
      
      const { winnerChange, eloAffected, dailyGamesCount } = await storage.recordPvPResult(winnerId, loserId, "battleship", winnerName, loserName);
      const eloText = eloAffected ? ` (+${winnerChange})` : "";
      const noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
      clearLeaderboardCache("battleship");
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const shooterBoard = userId === state.player1Id ? state.player1Board : state.player2Board;
      const buttons = ui.createBattleshipButtons(game.id, shooterBoard, true);
      buttons.push(ui.createRematchButton("battleship", state.player1Id, state.player2Id));
      const content = `**BATTLESHIP**\n\n${player1Name} vs ${player2Name}\n\n🎉 **${winnerName}** wins!${eloText}${noEloNote}`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      return;
    }
    
    const hitText = result.hit ? (result.sunk ? "💥 HIT AND SUNK!" : "💥 HIT!") : "💨 Miss!";
    const currentPlayerName = await getPlayerName(state.currentTurn);
    const shooterBoard = state.currentTurn === state.player1Id ? state.player1Board : state.player2Board;
    const buttons = ui.createBattleshipButtons(game.id, shooterBoard);
    
    const myShipsLeft = (state.currentTurn === state.player1Id ? state.player1Board : state.player2Board).ships.filter((s: any) => s.hits.length < s.positions.length).length;
    const theirShipsLeft = (state.currentTurn === state.player1Id ? state.player2Board : state.player1Board).ships.filter((s: any) => s.hits.length < s.positions.length).length;
    
    const content = `**BATTLESHIP**\n\n${player1Name} vs ${player2Name}\n\n${hitText}\n\nYour ships: ${myShipsLeft}/2 | Enemy ships: ${theirShipsLeft}/2\n\n**${currentPlayerName}**'s turn! Type a coordinate (e.g., A1, B3) or click a button.`;
    
    await interaction.deferUpdate();
    await syncGameMessages(game, content, buttons);
    resetGameTimer(game.id, interaction.channel as TextChannel);
  }
}

async function handleTextGameInput(message: Message) {
  const playerId = message.author.id;
  const content = message.content.trim().toLowerCase();
  
  const game = await storage.getActiveGame(playerId);
  if (!game) return;
  
  const state = game.state as any;
  
  if (game.gameType === "wordduel") {
    const result = wordduel.submitAnswer(state, playerId, content);
    
    if (result.correct && result.first) {
      const hasMore = wordduel.nextRound(state);
      await storage.updateGameState(game.id, state);
      
      const player1Name = await getPlayerName(state.player1Id);
      const player2Name = await getPlayerName(state.player2Id);
      const playerName = await getPlayerName(playerId);
      
      if (!hasMore || wordduel.isGameOver(state)) {
        const winner = wordduel.getWinner(state);
        let eloText = "";
        let noEloNote = "";
        if (winner) {
          const loserId = winner === state.player1Id ? state.player2Id : state.player1Id;
          const winnerName = await getPlayerName(winner);
          const loserName = await getPlayerName(loserId);
          const { winnerChange, eloAffected, dailyGamesCount } = await storage.recordPvPResult(winner, loserId, "wordduel", winnerName, loserName);
          eloText = eloAffected ? ` (+${winnerChange})` : "";
          noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
          clearLeaderboardCache("wordduel");
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const winnerName = winner ? await getPlayerName(winner) : null;
        const resultText = winnerName ? `🎉 **${winnerName}** wins!${eloText}${noEloNote}` : "It's a draw!";
        const rematchBtn = ui.createRematchButton("wordduel", state.player1Id, state.player2Id);
        await sendToGameChannels(game, {
          content: `**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nFinal Score: ${state.scores[0]} - ${state.scores[1]}\n\n${resultText}`,
          components: [rematchBtn]
        });
        return;
      }
      
      const previousWord = state.words[state.currentWordIndex - 1];
      const scrambled = state.scrambledWords[state.currentWordIndex].toUpperCase();
      await sendToGameChannels(game, { content: `**${playerName}** got it! The word was: **${previousWord.toUpperCase()}**\n\n**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nRound ${state.currentWordIndex + 1}/5 | Score: ${state.scores[0]} - ${state.scores[1]}\n\n⏱️ **3... 2... 1... GO!**\n\nUnscramble: **${scrambled}**` });
      resetGameTimer(game.id, message.channel as TextChannel);
    }
  }
  
  else if (game.gameType === "connect4") {
    if (/^[1-7]$/.test(content)) {
      const col = parseInt(content) - 1;
      const expectedPlayer = state.currentPlayer === 1 ? state.player1Id : state.player2Id;
      
      if (playerId !== expectedPlayer) {
        return;
      }
      
      const result = connect4.dropPiece(state, col);
      if (!result.success) {
        await message.reply("Column is full!");
        return;
      }
      
      const player1Name = await getPlayerName(state.player1Id);
      const player2Name = await getPlayerName(state.player2Id);
      const display = ui.createConnect4Display(state);
      
      const isAgainstBot = isBotGame(state.player1Id, state.player2Id);
      const botIndicator = isAgainstBot ? " 🤖" : "";
      const unrankedNote = isAgainstBot ? "\n\n*Unranked game vs Play*" : "";
      
      if (connect4.checkWin(state.board, state.currentPlayer)) {
        const winnerId = connect4.getCurrentPlayerId(state);
        const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
        
        const winnerName = await getPlayerName(winnerId);
        const loserName = await getPlayerName(loserId);
        
        let eloText = "";
        let noEloNote = "";
        
        if (isAgainstBot) {
          await storage.recordGameResult(BOT_PLAYER_ID, "connect4", winnerId === BOT_PLAYER_ID ? "win" : "loss");
        } else {
          const result = await storage.recordPvPResult(winnerId, loserId, "connect4", winnerName, loserName);
          eloText = result.eloAffected ? ` (+${result.winnerChange})` : "";
          noEloNote = !result.eloAffected ? `\n\n*No rating change - you've played ${result.dailyGamesCount} games together today (max 3 for rating)*` : "";
          clearLeaderboardCache("connect4");
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const buttons = ui.createConnect4Board(state, game.id, true);
        if (!isAgainstBot) {
          const rematchBtn = ui.createRematchButton("connect4", state.player1Id, state.player2Id);
          buttons.push(rematchBtn);
        }
        const messageContent = `**CONNECT 4**${botIndicator}\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\n🎉 **${winnerName}** wins!${eloText}${noEloNote}${unrankedNote}`;
        
        await syncGameMessages(game, messageContent, buttons);
        return;
      }
      
      if (connect4.isBoardFull(state.board)) {
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const buttons = ui.createConnect4Board(state, game.id, true);
        if (!isAgainstBot) {
          const rematchBtn = ui.createRematchButton("connect4", state.player1Id, state.player2Id);
          buttons.push(rematchBtn);
        }
        const messageContent = `**CONNECT 4**${botIndicator}\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\nIt's a draw!${unrankedNote}`;
        
        await syncGameMessages(game, messageContent, buttons);
        return;
      }
      
      connect4.switchTurn(state);
      await storage.updateGameState(game.id, state, connect4.getCurrentPlayerId(state));
      
      const nextPlayerId = connect4.getCurrentPlayerId(state);
      const nextPlayerName = await getPlayerName(nextPlayerId);
      const buttons = ui.createConnect4Board(state, game.id);
      const messageContent = `**CONNECT 4**${botIndicator}\n\n🔴 ${player1Name} vs 🟡 ${player2Name}\n\n${display}\n\nIt's **${nextPlayerName}**'s turn (type 1-7 or click)${unrankedNote}`;
      
      await syncGameMessages(game, messageContent, buttons);
      
      if (nextPlayerId === BOT_PLAYER_ID) {
        const updatedGame = await storage.getActiveGameById(game.id);
        if (updatedGame) {
          setTimeout(() => makeBotMove(updatedGame, message.channel as TextChannel), 1500);
        }
      } else {
        resetGameTimer(game.id, message.channel as TextChannel);
      }
    }
  }
  
  else if (game.gameType === "wordle") {
    if (playerId !== state.playerId) return;
    
    if (content.length === 5 && /^[a-z]+$/.test(content)) {
      const result = wordle.makeGuess(state, content);
      
      if (result.valid) {
        await storage.updateGameState(game.id, state);
        
        if (state.gameOver) {
          const result = state.won ? "win" : "loss";
          await storage.recordGameResult(state.playerId, "wordle", result);
          if (state.won && state.endTime) {
            const completionTime = Math.floor((state.endTime - state.startTime) / 1000);
            await storage.recordWordleWin(state.playerId, completionTime);
          }
          clearLeaderboardCache("wordle");
          await storage.endGame(game.id);
        }
        
        const wordleGuide = `🟩 = Correct letter, correct spot\n🟨 = Correct letter, wrong spot\n⬛ = Letter not in word`;
        let display = `**WORDLE**\n\n${wordleGuide}\n\n`;
        for (const guess of state.guesses) {
          const colors = evaluateWordleGuess(state.targetWord, guess);
          display += colors.join("") + " **" + guess.toUpperCase() + "**\n";
        }
        const remaining = state.maxGuesses - state.guesses.length;
        for (let i = 0; i < remaining; i++) {
          display += "🔲🔲🔲🔲🔲\n";
        }
        display += `\nGuesses: ${state.guesses.length}/${state.maxGuesses}`;
        
        if (state.guesses.length > 0 && !state.gameOver) {
          display += "\n\n**Keyboard:**\n" + buildWordleKeyboard(state.guesses, state.targetWord);
        }
        
        if (state.gameOver) {
          if (state.won) {
            const time = Math.floor((state.endTime - state.startTime) / 1000);
            display += `\n\n🎉 You won in ${state.guesses.length} guess${state.guesses.length > 1 ? 'es' : ''}! Time: ${time}s`;
          } else {
            display += `\n\n😔 Game over! The word was: **${state.targetWord.toUpperCase()}**`;
          }
        } else {
          display += "\nType a 5-letter word to guess!";
        }
        
        await message.channel.send(display);
      } else {
        await message.reply(result.error || "Invalid guess.");
      }
    }
  }
  
  else if (game.gameType === "mathblitz") {
    const numAnswer = parseInt(content);
    if (isNaN(numAnswer)) return;
    
    if (playerId !== state.player1Id && playerId !== state.player2Id) return;
    
    const result = mathblitz.submitAnswer(state, playerId, numAnswer);
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    const playerName = await getPlayerName(playerId);
    
    if (result.correct && result.firstCorrect) {
      await message.channel.send(`✅ **${playerName}** got it! The answer was **${state.currentProblem?.answer}**`);
    } else if (result.correct) {
      await message.channel.send(`✅ **${playerName}** also got it right!`);
    }
    
    if (mathblitz.bothAnswered(state) || result.firstCorrect) {
      mathblitz.nextRound(state);
      const matchResult = mathblitz.isMatchOver(state);
      
      if (matchResult.over) {
        let eloText = "";
        let noEloNote = "";
        let resultText = "";
        
        if (matchResult.winner) {
          const winnerId = matchResult.winner;
          const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
          const winnerName = await getPlayerName(winnerId);
          const loserName = await getPlayerName(loserId);
          
          const eloResult = await storage.recordPvPResult(winnerId, loserId, "mathblitz", winnerName, loserName);
          eloText = eloResult.eloAffected ? ` (+${eloResult.winnerChange})` : "";
          noEloNote = !eloResult.eloAffected ? `\n\n*No rating change - you've played ${eloResult.dailyGamesCount} games together today (max 3 for rating)*` : "";
          clearLeaderboardCache("mathblitz");
          resultText = `🎉 **${winnerName}** wins!${eloText}`;
        } else {
          resultText = "It's a draw!";
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const rematchBtn = ui.createRematchButton("mathblitz", state.player1Id, state.player2Id);
        await sendToGameChannels(game, {
          content: `**MATH BLITZ**\n\n${player1Name} vs ${player2Name}\n\nFinal Score: **${state.player1Score}** - **${state.player2Score}**\n\n${resultText}${noEloNote}`,
          components: [rematchBtn]
        });
        return;
      }
      
      mathblitz.getNextProblem(state);
      await storage.updateGameState(game.id, state);
      
      const p1Status = state.player1Answered ? "✅" : "⏳";
      const p2Status = state.player2Answered ? "✅" : "⏳";
      
      await sendToGameChannels(game, {
        content: `**MATH BLITZ**\n\n${player1Name} ${p1Status} vs ${p2Status} ${player2Name}\nScore: **${state.player1Score}** - **${state.player2Score}**\n\n🧮 **${state.currentProblem?.question} = ?**\n\nType your answer!\n\nRound ${state.currentRound}/${state.maxRounds}`
      });
      resetGameTimer(game.id, message.channel as TextChannel);
    } else {
      await storage.updateGameState(game.id, state);
    }
  }
  
  else if (game.gameType === "battleship") {
    const coordMatch = content.toUpperCase().match(/^([A-E])([1-5])$/);
    if (!coordMatch) return;
    
    if (playerId !== state.currentTurn) return;
    
    const col = coordMatch[1].charCodeAt(0) - 65;
    const row = parseInt(coordMatch[2]) - 1;
    const position = row * 5 + col;
    
    const result = battleship.fireShot(state, playerId, position);
    if (!result.valid) return;
    
    await storage.updateGameState(game.id, state, state.currentTurn);
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    
    const gameResult = battleship.isGameOver(state);
    if (gameResult.over && gameResult.winner) {
      const winnerId = gameResult.winner;
      const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
      const winnerName = await getPlayerName(winnerId);
      const loserName = await getPlayerName(loserId);
      
      const { winnerChange, eloAffected, dailyGamesCount } = await storage.recordPvPResult(winnerId, loserId, "battleship", winnerName, loserName);
      const eloText = eloAffected ? ` (+${winnerChange})` : "";
      const noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
      clearLeaderboardCache("battleship");
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const shooterBoard = playerId === state.player1Id ? state.player1Board : state.player2Board;
      const buttons = ui.createBattleshipButtons(game.id, shooterBoard, true);
      buttons.push(ui.createRematchButton("battleship", state.player1Id, state.player2Id));
      const msgContent = `**BATTLESHIP**\n\n${player1Name} vs ${player2Name}\n\n🎉 **${winnerName}** wins!${eloText}${noEloNote}`;
      
      await syncGameMessages(game, msgContent, buttons);
      return;
    }
    
    const hitText = result.hit ? (result.sunk ? "💥 HIT AND SUNK!" : "💥 HIT!") : "💨 Miss!";
    const currentPlayerName = await getPlayerName(state.currentTurn);
    const shooterBoard = state.currentTurn === state.player1Id ? state.player1Board : state.player2Board;
    const buttons = ui.createBattleshipButtons(game.id, shooterBoard);
    
    const myShipsLeft = (state.currentTurn === state.player1Id ? state.player1Board : state.player2Board).ships.filter((s: any) => s.hits.length < s.positions.length).length;
    const theirShipsLeft = (state.currentTurn === state.player1Id ? state.player2Board : state.player1Board).ships.filter((s: any) => s.hits.length < s.positions.length).length;
    
    const msgContent = `**BATTLESHIP**\n\n${player1Name} vs ${player2Name}\n\n${hitText}\n\nYour ships: ${myShipsLeft}/2 | Enemy ships: ${theirShipsLeft}/2\n\n**${currentPlayerName}**'s turn! Type a coordinate (e.g., A1, B3) or click a button.`;
    
    await syncGameMessages(game, msgContent, buttons);
    resetGameTimer(game.id, message.channel as TextChannel);
  }
}

function buildWordleKeyboard(guesses: string[], targetWord: string): string {
  // Track best status for each letter: 2=correct, 1=wrong spot, 0=not in word
  const letterBestStatus: Record<string, number> = {};
  const allLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  
  // Evaluate each guess using proper Wordle rules (letter counts)
  for (const guess of guesses) {
    const colors = evaluateWordleGuess(targetWord, guess);
    
    for (let i = 0; i < 5; i++) {
      const letter = guess[i].toUpperCase();
      let status = 0; // not in word (gray)
      
      if (colors[i] === "🟩") {
        status = 2; // correct position
      } else if (colors[i] === "🟨") {
        status = 1; // wrong spot
      }
      
      // Keep the best status (higher = better)
      if (letterBestStatus[letter] === undefined || status > letterBestStatus[letter]) {
        letterBestStatus[letter] = status;
      }
    }
  }
  
  // Group letters by their best status
  const correct: string[] = [];
  const wrongSpot: string[] = [];
  const notInWord: string[] = [];
  const unused: string[] = [];
  
  for (const letter of allLetters) {
    const status = letterBestStatus[letter];
    if (status === 2) {
      correct.push(letter);
    } else if (status === 1) {
      wrongSpot.push(letter);
    } else if (status === 0) {
      notInWord.push(letter);
    } else {
      unused.push(letter);
    }
  }
  
  let keyboard = "";
  if (correct.length > 0) {
    keyboard += `✅ Correct: ${correct.join(" ")}\n`;
  }
  if (wrongSpot.length > 0) {
    keyboard += `🟡 Wrong spot: ${wrongSpot.join(" ")}\n`;
  }
  if (notInWord.length > 0) {
    keyboard += `❌ Not in word: ${notInWord.join(" ")}\n`;
  }
  if (unused.length > 0) {
    keyboard += `⬜ Unused: ${unused.join(" ")}`;
  }
  
  return keyboard.trim();
}

function evaluateWordleGuess(targetWord: string, guess: string): string[] {
  const result: string[] = [];
  const targetChars = targetWord.split('');
  const guessChars = guess.split('');
  const used = new Array(5).fill(false);
  
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === targetChars[i]) {
      result[i] = "🟩";
      used[i] = true;
    }
  }
  
  for (let i = 0; i < 5; i++) {
    if (result[i]) continue;
    
    let found = false;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guessChars[i] === targetChars[j]) {
        result[i] = "🟨";
        used[j] = true;
        found = true;
        break;
      }
    }
    if (!found) {
      result[i] = "⬛";
    }
  }
  
  return result;
}

function startGameTimer(gameId: string, channel: TextChannel) {
  const timer = setTimeout(async () => {
    const game = await storage.getActiveGameById(gameId);
    if (!game) return;
    
    // Special handling for Word Duel - skip round instead of forfeiting
    if (game.gameType === "wordduel") {
      const state = game.state as any;
      
      // Check if someone already answered correctly this round - if so, timer was already reset
      const hasCorrectAnswer = Object.keys(state.roundAnswers).length > 0;
      if (hasCorrectAnswer) {
        // Round was already won and advanced, ignore this timer
        gameTimers.delete(gameId);
        return;
      }
      
      // Check if game is already over
      if (wordduel.isGameOver(state)) {
        gameTimers.delete(gameId);
        return;
      }
      
      const player1Name = await getPlayerName(state.player1Id);
      const player2Name = await getPlayerName(state.player2Id);
      const currentWord = state.words[state.currentWordIndex];
      
      // Skip to next round (no one answered)
      const hasMore = wordduel.nextRound(state);
      await storage.updateGameState(game.id, state);
      
      if (!hasMore || wordduel.isGameOver(state)) {
        const winner = wordduel.getWinner(state);
        let eloText = "";
        let noEloNote = "";
        if (winner) {
          const loserId = winner === state.player1Id ? state.player2Id : state.player1Id;
          const winnerName = await getPlayerName(winner);
          const loserName = await getPlayerName(loserId);
          const { winnerChange, eloAffected, dailyGamesCount } = await storage.recordPvPResult(winner, loserId, "wordduel", winnerName, loserName);
          eloText = eloAffected ? ` (+${winnerChange})` : "";
          noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
          clearLeaderboardCache("wordduel");
        }
        
        await storage.endGame(gameId);
        gameTimers.delete(gameId);
        
        const winnerName = winner ? await getPlayerName(winner) : null;
        const resultText = winnerName ? `**${winnerName}** wins!${eloText}${noEloNote}` : "It's a draw!";
        const rematchBtn = ui.createRematchButton("wordduel", state.player1Id, state.player2Id);
        await sendToGameChannels(game, {
          content: `Time's up! The word was: **${currentWord.toUpperCase()}**\n\n**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nFinal Score: ${state.scores[0]} - ${state.scores[1]}\n\n${resultText}`,
          components: [rematchBtn]
        });
        return;
      }
      
      // Continue to next round
      const scrambled = state.scrambledWords[state.currentWordIndex].toUpperCase();
      await sendToGameChannels(game, { 
        content: `Time's up! The word was: **${currentWord.toUpperCase()}**\n\n**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nRound ${state.currentWordIndex + 1}/5 | Score: ${state.scores[0]} - ${state.scores[1]}\n\n⏱️ **3... 2... 1... GO!**\n\nUnscramble: **${scrambled}**` 
      });
      gameTimers.delete(gameId);
      startGameTimer(gameId, channel);
      return;
    }
    
    const currentPlayerId = game.currentTurn;
    
    if (currentPlayerId && game.player2Id) {
      const opponentId = currentPlayerId === game.player1Id ? game.player2Id : game.player1Id;
      
      const timedOutName = await getPlayerName(currentPlayerId);
      const winnerName = await getPlayerName(opponentId);
      const isAgainstBot = isBotGame(game.player1Id, game.player2Id);
      
      let eloText = "";
      let noEloNote = "";
      if (isAgainstBot) {
        await storage.recordGameResult(BOT_PLAYER_ID, game.gameType, currentPlayerId === BOT_PLAYER_ID ? "loss" : "win");
        noEloNote = "\n\n*Unranked game vs Play*";
      } else if (PVP_GAMES.includes(game.gameType)) {
        const { winnerChange: change, eloAffected, dailyGamesCount } = await storage.recordPvPResult(opponentId, currentPlayerId, game.gameType, winnerName, timedOutName);
        eloText = eloAffected ? ` (+${change})` : "";
        noEloNote = !eloAffected ? `\n\n*No rating change - you've played ${dailyGamesCount} games together today (max 3 for rating)*` : "";
        clearLeaderboardCache(game.gameType);
      } else {
        await storage.recordGameResult(currentPlayerId, game.gameType, "loss");
        await storage.recordGameResult(opponentId, game.gameType, "win");
      }
      await sendToGameChannels(game, { content: `**${timedOutName}** timed out. **${winnerName}** wins!${eloText}${noEloNote}` });
    }
    
    await storage.endGame(gameId);
    gameTimers.delete(gameId);
  }, AFK_TIMEOUT);
  
  gameTimers.set(gameId, timer);
}

function resetGameTimer(gameId: string, channel: TextChannel) {
  clearGameTimer(gameId);
  startGameTimer(gameId, channel);
}

function clearGameTimer(gameId: string) {
  const timer = gameTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    gameTimers.delete(gameId);
  }
}

client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  console.log("Bot is ready!");
  
  setInterval(async () => {
    const cleaned = await storage.cleanExpiredQueues(5);
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired queue entries`);
    }
  }, 60000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    try {
      await handleButtonInteraction(interaction);
    } catch (error) {
      console.error("Button interaction error:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "An error occurred.", ephemeral: true });
      }
    }
  }
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  
  const content = message.content.trim();
  
  if (content.startsWith(PREFIX)) {
    const args = content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    
    try {
      switch (command) {
        case "help":
          await handleHelp(message);
          break;
        case "profile":
        case "p":
          await handleProfile(message, args);
          break;
        case "leaderboard":
        case "lb":
          await handleLeaderboard(message, args);
          break;
        case "shop":
          await handleShop(message, args);
          break;
        case "buy":
          await handleBuy(message, args);
          break;
        case "inventory":
        case "inv":
          await handleInventory(message);
          break;
        case "equip":
          await handleEquip(message, args);
          break;
        case "unequip":
          await handleUnequip(message, args);
          break;
        case "connect4":
        case "c4":
          await handleGameCommand(message, "connect4", args);
          break;
        case "tictactoe":
        case "ttt":
          await handleGameCommand(message, "tictactoe", args);
          break;
        case "wordduel":
        case "wd":
          await handleGameCommand(message, "wordduel");
          break;
        case "wordle":
        case "w":
          await handleSoloGame(message, "wordle");
          break;
        case "rps":
        case "rockpaperscissors":
          await handleGameCommand(message, "rps", args);
          break;
        case "hangman":
        case "hm":
          await handleSoloGame(message, "hangman");
          break;
        case "trivia":
        case "td":
          await handleGameCommand(message, "triviaduel", args);
          break;
        case "math":
        case "mb":
          await handleGameCommand(message, "mathblitz", args);
          break;
        case "battleship":
        case "bs":
          await handleGameCommand(message, "battleship", args);
          break;
        case "quit":
        case "q":
          await handleQuit(message);
          break;
        case "accept":
          await handleAccept(message);
          break;
        case "staff":
          await handleStaff(message);
          break;
        case "promote":
          await handlePromote(message, args);
          break;
        case "demote":
          await handleDemote(message, args);
          break;
        case "resetplayer":
          await handleResetPlayer(message, args);
          break;
        case "resetgame":
          await handleResetGame(message, args);
          break;
        case "resetbot":
          await handleResetBot(message);
          break;
        case "staffhelp":
          await handleStaffHelp(message);
          break;
        case "rules":
          await handleRules(message, args);
          break;
        case "setemoji":
          await handleSetEmoji(message, args);
          break;
        case "listemojis":
          await handleListEmojis(message);
          break;
        case "resetemoji":
          await handleResetEmoji(message, args);
          break;
      }
    } catch (error) {
      console.error("Command error:", error);
    }
  } else {
    try {
      await handleTextGameInput(message);
    } catch (error) {
      console.error("Game input error:", error);
    }
  }
});

async function startBot() {
  await storage.seedShopItems();
  console.log("Starting Discord bot...");
  client.login(process.env.DISCORD_BOT_TOKEN);
}

startBot();
