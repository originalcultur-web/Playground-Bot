import "dotenv/config";
import { Client, GatewayIntentBits, Message, Partials } from "discord.js";
import * as storage from "#server/storage.js";
import * as connect4 from "./games/connect4.js";
import * as tictactoe from "./games/tictactoe.js";
import * as wordduel from "./games/wordduel.js";
import * as chess from "./games/chess.js";
import * as minesweeper from "./games/minesweeper.js";
import * as wordle from "./games/wordle.js";

const PREFIX = ",";
const TURN_TIMEOUT = 30000;
const AFK_TIMEOUT = 60000;

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

async function sendMessage(message: Message, content: string) {
  try {
    if ('send' in message.channel && typeof message.channel.send === 'function') {
      await message.channel.send(content);
    }
  } catch (e) {
    console.error("Failed to send message:", e);
  }
}

async function handleHelp(message: Message) {
  const help = `**PLAYGROUND - Commands**

**Games:**
,connect4 - Play Connect 4 (queue or @user)
,tictactoe - Play Tic Tac Toe (queue or @user)
,wordduel - Play Word Duel (queue or @user)
,chess - Play Chess (queue or @user)
,minesweeper - Play Minesweeper (solo)
,wordle - Play Wordle (solo)

**During Games:**
,quit - Forfeit current game
,move <col/pos> - Make a move

**Profile & Stats:**
,profile - View your profile
,profile @user - View someone's profile
,leaderboard <game> - View leaderboard

**Shop & Inventory:**
,shop - Browse the shop
,buy <number> - Buy an item
,inventory - View your inventory
,equip <number> - Equip an item
,unequip <type> - Unequip an item

,accept - Accept a challenge`;
  await sendMessage(message, help);
}

async function handleProfile(message: Message, args: string[]) {
  let targetId = message.author.id;
  let targetName = message.author.username;
  
  if (message.mentions.users.size > 0) {
    const mentioned = message.mentions.users.first()!;
    targetId = mentioned.id;
    targetName = mentioned.username;
  }
  
  const player = await storage.getPlayer(targetId);
  if (!player) {
    await sendMessage(message, `${targetName} hasn't played any games yet.`);
    return;
  }
  
  let badge = "";
  let title = "";
  let frame = "";
  
  if (player.equippedBadge) {
    const item = await storage.getShopItem(player.equippedBadge);
    if (item) badge = item.emoji;
  }
  if (player.equippedTitle) {
    const item = await storage.getShopItem(player.equippedTitle);
    if (item) title = ` [${item.name}]`;
  }
  if (player.equippedFrame) {
    const item = await storage.getShopItem(player.equippedFrame);
    if (item) frame = item.emoji;
  }
  
  let profile = `${frame}**${player.displayName || player.username}**${title} ${badge}
@${player.username}

Total Wins: ${player.totalWins}
Total Losses: ${player.totalLosses}`;
  
  if (targetId === message.author.id) {
    profile += `\nCoins: ${player.coins}`;
  }
  
  await sendMessage(message, profile);
}

async function handleLeaderboard(message: Message, args: string[]) {
  const game = args[0]?.toLowerCase();
  const validGames = ["connect4", "tictactoe", "chess", "wordduel", "minesweeper", "wordle"];
  
  if (!game || !validGames.includes(game)) {
    await sendMessage(message, `Usage: ,leaderboard <game>\nGames: ${validGames.join(", ")}`);
    return;
  }
  
  const cacheKey = game;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 300000) {
    await sendMessage(message, cached.data);
    return;
  }
  
  const leaders = await storage.getLeaderboard(game);
  const playerRank = await storage.getPlayerRank(message.author.id, game);
  const playerStats = await storage.getOrCreateGameStats(message.author.id, game);
  
  let display = `${game.toUpperCase()} - LEADERBOARD\n\n`;
  
  if (leaders.length === 0) {
    display += "No players with 20+ games yet.\n";
  } else {
    for (let i = 0; i < leaders.length; i++) {
      const stat = leaders[i];
      const player = await storage.getPlayer(stat.discordId);
      const winRate = stat.winRate.toFixed(0);
      display += `${i + 1}. ${player?.displayName || "Unknown"} (@${player?.username || "unknown"})\n`;
      display += `   Wins: ${stat.wins} Losses: ${stat.losses} Win%: ${winRate}\n\n`;
    }
  }
  
  const totalGames = playerStats.wins + playerStats.losses;
  if (totalGames >= 20) {
    display += `\nYOUR RANK: ${playerRank}\n`;
  } else {
    display += `\nPlay ${20 - totalGames} more games to appear on leaderboard.\n`;
  }
  display += `Wins: ${playerStats.wins} Losses: ${playerStats.losses} Win%: ${playerStats.winRate.toFixed(0)}`;
  
  leaderboardCache.set(cacheKey, { data: display, timestamp: Date.now() });
  await sendMessage(message, display);
}

async function handleShop(message: Message, args: string[]) {
  const category = args[0]?.toLowerCase();
  const items = await storage.getShopItems(category);
  
  if (items.length === 0) {
    await sendMessage(message, "No items found. Categories: badges, titles, frames, connect4, chess");
    return;
  }
  
  let display = "**SHOP**\n\n";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    display += `${i + 1}. ${item.emoji} ${item.name} - ${item.price} coins\n`;
    if (item.description) display += `   ${item.description}\n`;
  }
  display += "\nUse ,buy <number> to purchase";
  
  await sendMessage(message, display);
}

async function handleBuy(message: Message, args: string[]) {
  const itemNumber = parseInt(args[0]);
  if (isNaN(itemNumber) || itemNumber < 1) {
    await sendMessage(message, "Usage: ,buy <number>");
    return;
  }
  
  const items = await storage.getShopItems();
  if (itemNumber > items.length) {
    await sendMessage(message, "Invalid item number.");
    return;
  }
  
  const item = items[itemNumber - 1];
  const result = await storage.purchaseItem(message.author.id, item.id);
  
  if (result.success) {
    await sendMessage(message, `Purchased ${item.emoji} ${item.name}! It has been equipped.`);
  } else {
    await sendMessage(message, result.error || "Purchase failed.");
  }
}

async function handleInventory(message: Message) {
  const inventory = await storage.getUserInventory(message.author.id);
  
  if (inventory.length === 0) {
    await sendMessage(message, "Your inventory is empty. Visit ,shop to browse items!");
    return;
  }
  
  let display = "**YOUR INVENTORY**\n\n";
  for (let i = 0; i < inventory.length; i++) {
    const inv = inventory[i];
    if (inv.item) {
      display += `${i + 1}. ${inv.item.emoji} ${inv.item.name} (${inv.item.itemType})\n`;
    }
  }
  display += "\nUse ,equip <number> to equip an item";
  
  await sendMessage(message, display);
}

async function handleEquip(message: Message, args: string[]) {
  const itemNumber = parseInt(args[0]);
  if (isNaN(itemNumber) || itemNumber < 1) {
    await sendMessage(message, "Usage: ,equip <number>");
    return;
  }
  
  const inventory = await storage.getUserInventory(message.author.id);
  if (itemNumber > inventory.length) {
    await sendMessage(message, "Invalid item number.");
    return;
  }
  
  const inv = inventory[itemNumber - 1];
  if (!inv.item) {
    await sendMessage(message, "Item not found.");
    return;
  }
  
  await storage.equipItem(message.author.id, inv.itemId);
  await sendMessage(message, `Equipped ${inv.item.emoji} ${inv.item.name}!`);
}

async function handleUnequip(message: Message, args: string[]) {
  const type = args[0]?.toLowerCase();
  const validTypes = ["badge", "title", "frame", "skin"];
  
  if (!type || !validTypes.includes(type)) {
    await sendMessage(message, `Usage: ,unequip <type>\nTypes: ${validTypes.join(", ")}`);
    return;
  }
  
  await storage.unequipItem(message.author.id, type, args[1]);
  await sendMessage(message, `Unequipped ${type}.`);
}

async function startPvPGame(message: Message, gameType: string, player2Id: string) {
  await storage.getOrCreatePlayer(message.author.id, message.author.username, message.author.displayName);
  
  let state: any;
  switch (gameType) {
    case "connect4":
      state = connect4.createGameState(message.author.id, player2Id);
      break;
    case "tictactoe":
      state = tictactoe.createGameState(message.author.id, player2Id);
      break;
    case "wordduel":
      state = wordduel.createGameState(message.author.id, player2Id);
      break;
    case "chess":
      state = chess.createGameState(message.author.id, player2Id);
      break;
    default:
      return;
  }
  
  const game = await storage.createActiveGame(gameType, message.author.id, message.channel.id, state, player2Id);
  await storage.recordRecentOpponent(message.author.id, player2Id, gameType);
  
  let display = `**${gameType.toUpperCase()}**\n<@${message.author.id}> vs <@${player2Id}>\n\n`;
  
  switch (gameType) {
    case "connect4":
      display += connect4.renderBoard(state);
      display += `\n<@${state.player1Id}>'s turn. Type 1-7 to drop a piece.`;
      break;
    case "tictactoe":
      display += tictactoe.renderBoard(state);
      display += `\n<@${state.player1Id}>'s turn. Type 1-9 to place.`;
      break;
    case "wordduel":
      display += wordduel.renderStatus(state);
      break;
    case "chess":
      display += chess.renderBoard(state);
      display += `\n<@${state.player1Id}> (White) to move.`;
      break;
  }
  
  await sendMessage(message, display);
  startGameTimer(game.id, message);
}

async function handleGameCommand(message: Message, gameType: string) {
  const playerId = message.author.id;
  
  await storage.getOrCreatePlayer(playerId, message.author.username, message.author.displayName);
  
  const existingGame = await storage.getActiveGame(playerId);
  if (existingGame) {
    await sendMessage(message, "You're already in a game. Use ,quit to leave.");
    return;
  }
  
  if (await storage.isQueueLocked(playerId)) {
    await sendMessage(message, "You're temporarily locked from matchmaking due to forfeits. Please wait.");
    return;
  }
  
  if (message.mentions.users.size > 0) {
    const challenged = message.mentions.users.first()!;
    if (challenged.id === playerId) {
      await sendMessage(message, "You can't challenge yourself!");
      return;
    }
    
    const challengedGame = await storage.getActiveGame(challenged.id);
    if (challengedGame) {
      await sendMessage(message, `${challenged.username} is already in a game.`);
      return;
    }
    
    await storage.createChallenge(playerId, challenged.id, gameType, message.channel.id);
    await sendMessage(message, `<@${challenged.id}>, you've been challenged to ${gameType} by <@${playerId}>!\nType ,accept to play.`);
    return;
  }
  
  await storage.addToQueue(playerId, gameType, message.channel.id);
  await sendMessage(message, `Looking for a ${gameType} opponent... (,quit to cancel)`);
  
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
      
      await startPvPGame(message, gameType, match.discordId);
    } else if (attempts < 12) {
      matchmakingTimers.set(playerId, setTimeout(findOpponent, 5000));
    } else {
      await storage.removeFromQueue(playerId);
      matchmakingTimers.delete(playerId);
      await sendMessage(message, "No opponent found. Try again later or challenge someone directly.");
    }
  };
  
  findOpponent();
}

async function handleAccept(message: Message) {
  const challenges = await storage.getChallenge(message.author.id, "", "");
  
  const allChallenges: any[] = [];
  for (const gameType of ["connect4", "tictactoe", "wordduel", "chess"]) {
    const result = await storage.getChallenge(message.author.id, "", gameType);
    if (result) allChallenges.push(result);
  }
  
  if (allChallenges.length === 0) {
    await sendMessage(message, "You have no pending challenges.");
    return;
  }
  
  const challenge = allChallenges[0];
  await storage.removeChallenge(challenge.id);
  
  await startPvPGame(message, challenge.gameType, challenge.challengerId);
}

async function handleSoloGame(message: Message, gameType: string) {
  const playerId = message.author.id;
  
  await storage.getOrCreatePlayer(playerId, message.author.username, message.author.displayName);
  
  const existingGame = await storage.getActiveGame(playerId);
  if (existingGame) {
    await sendMessage(message, "You're already in a game. Use ,quit to leave.");
    return;
  }
  
  let state: any;
  if (gameType === "minesweeper") {
    state = minesweeper.createGameState(playerId);
  } else if (gameType === "wordle") {
    state = wordle.createGameState(playerId);
  }
  
  const game = await storage.createActiveGame(gameType, playerId, message.channel.id, state);
  
  if (gameType === "minesweeper") {
    await sendMessage(message, minesweeper.renderBoard(state));
  } else if (gameType === "wordle") {
    await sendMessage(message, wordle.renderBoard(state));
  }
}

async function handleQuit(message: Message) {
  const playerId = message.author.id;
  
  const timer = matchmakingTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    matchmakingTimers.delete(playerId);
    await storage.removeFromQueue(playerId);
    await sendMessage(message, "Left the matchmaking queue.");
    return;
  }
  
  const game = await storage.getActiveGame(playerId);
  if (!game) {
    await sendMessage(message, "You're not in a game.");
    return;
  }
  
  clearGameTimer(game.id);
  
  if (game.player2Id) {
    const opponentId = game.player1Id === playerId ? game.player2Id : game.player1Id;
    await storage.recordGameResult(playerId, game.gameType, "loss");
    await storage.recordGameResult(opponentId, game.gameType, "win");
    await storage.awardWinCoins(opponentId);
    await storage.recordForfeit(playerId);
    await sendMessage(message, `<@${playerId}> forfeited. <@${opponentId}> wins!`);
  } else {
    await sendMessage(message, "Game ended.");
  }
  
  await storage.endGame(game.id);
}

async function handleGameInput(message: Message) {
  const playerId = message.author.id;
  const content = message.content.trim().toLowerCase();
  
  const game = await storage.getActiveGame(playerId);
  if (!game) return;
  
  const state = game.state as any;
  
  if (game.gameType === "connect4") {
    if (state.currentPlayer === 1 && playerId !== state.player1Id) return;
    if (state.currentPlayer === 2 && playerId !== state.player2Id) return;
    
    const col = parseInt(content) - 1;
    if (isNaN(col) || col < 0 || col > 6) return;
    
    const result = connect4.dropPiece(state, col);
    if (!result.success) {
      await sendMessage(message, "Column is full. Choose another.");
      return;
    }
    
    if (connect4.checkWin(state.board, state.currentPlayer)) {
      const winnerId = connect4.getCurrentPlayerId(state);
      const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
      
      await storage.recordGameResult(winnerId, "connect4", "win");
      await storage.recordGameResult(loserId, "connect4", "loss");
      await storage.awardWinCoins(winnerId);
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      let display = connect4.renderBoard(state);
      display += `\n\n<@${winnerId}> wins!`;
      await sendMessage(message, display);
      return;
    }
    
    if (connect4.isBoardFull(state.board)) {
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      let display = connect4.renderBoard(state);
      display += "\n\nIt's a draw!";
      await sendMessage(message, display);
      return;
    }
    
    connect4.switchTurn(state);
    await storage.updateGameState(game.id, state, connect4.getCurrentPlayerId(state));
    
    let display = connect4.renderBoard(state);
    display += `\n<@${connect4.getCurrentPlayerId(state)}>'s turn.`;
    await sendMessage(message, display);
    resetGameTimer(game.id, message);
  }
  
  else if (game.gameType === "tictactoe") {
    if (state.currentPlayer === 1 && playerId !== state.player1Id) return;
    if (state.currentPlayer === 2 && playerId !== state.player2Id) return;
    
    const pos = parseInt(content) - 1;
    if (isNaN(pos) || pos < 0 || pos > 8) return;
    
    if (!tictactoe.makeMove(state, pos)) {
      await sendMessage(message, "Invalid move. Choose an empty square.");
      return;
    }
    
    if (tictactoe.checkWin(state.board, state.currentPlayer)) {
      tictactoe.recordRoundWin(state, state.currentPlayer);
      
      const matchResult = tictactoe.isMatchOver(state);
      if (matchResult.over) {
        const winnerId = matchResult.winner === 1 ? state.player1Id : state.player2Id;
        const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
        
        if (matchResult.winner) {
          await storage.recordGameResult(winnerId, "tictactoe", "win");
          await storage.recordGameResult(loserId, "tictactoe", "loss");
          await storage.awardWinCoins(winnerId);
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        let display = tictactoe.renderBoard(state);
        display += matchResult.winner ? `\n\n<@${winnerId}> wins the match!` : "\n\nIt's a draw!";
        await sendMessage(message, display);
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state);
      
      let display = `Round ${state.currentRound - 1} won by <@${tictactoe.getCurrentPlayerId(state)}>\n\n`;
      display += tictactoe.renderBoard(state);
      display += `\n<@${tictactoe.getCurrentPlayerId(state)}>'s turn.`;
      await sendMessage(message, display);
      resetGameTimer(game.id, message);
      return;
    }
    
    if (tictactoe.isBoardFull(state.board)) {
      if (state.currentRound >= state.maxRounds) {
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        let display = tictactoe.renderBoard(state);
        display += "\n\nMatch ended in a draw!";
        await sendMessage(message, display);
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state);
      
      let display = "Round draw!\n\n";
      display += tictactoe.renderBoard(state);
      display += `\n<@${tictactoe.getCurrentPlayerId(state)}>'s turn.`;
      await sendMessage(message, display);
      resetGameTimer(game.id, message);
      return;
    }
    
    tictactoe.switchTurn(state);
    await storage.updateGameState(game.id, state, tictactoe.getCurrentPlayerId(state));
    
    let display = tictactoe.renderBoard(state);
    display += `\n<@${tictactoe.getCurrentPlayerId(state)}>'s turn.`;
    await sendMessage(message, display);
    resetGameTimer(game.id, message);
  }
  
  else if (game.gameType === "wordduel") {
    const result = wordduel.submitAnswer(state, playerId, content);
    
    if (result.correct && result.first) {
      const hasMore = wordduel.nextRound(state);
      await storage.updateGameState(game.id, state);
      
      if (!hasMore || wordduel.isGameOver(state)) {
        const winner = wordduel.getWinner(state);
        if (winner) {
          const loserId = winner === state.player1Id ? state.player2Id : state.player1Id;
          await storage.recordGameResult(winner, "wordduel", "win");
          await storage.recordGameResult(loserId, "wordduel", "loss");
          await storage.awardWinCoins(winner);
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        await sendMessage(message, wordduel.renderFinalResult(state));
        return;
      }
      
      await sendMessage(message, `<@${playerId}> got it! The word was: ${state.words[state.currentWordIndex - 1]}\n\n${wordduel.renderStatus(state)}`);
      resetGameTimer(game.id, message);
    }
  }
  
  else if (game.gameType === "chess") {
    if (state.currentTurn === "w" && playerId !== state.player1Id) return;
    if (state.currentTurn === "b" && playerId !== state.player2Id) return;
    
    const move = content.replace(",move ", "").replace(",m ", "").trim();
    const result = chess.makeMove(state, move);
    
    if (!result.success) {
      await sendMessage(message, result.error || "Invalid move.");
      return;
    }
    
    const status = chess.getGameStatus(state);
    await storage.updateGameState(game.id, state, chess.getCurrentPlayerId(state));
    
    if (status.over) {
      if (status.winner) {
        const loserId = status.winner === state.player1Id ? state.player2Id : state.player1Id;
        await storage.recordGameResult(status.winner, "chess", "win");
        await storage.recordGameResult(loserId, "chess", "loss");
        await storage.awardWinCoins(status.winner);
      }
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      let display = chess.renderBoard(state);
      if (status.result === "checkmate") {
        display += `\n\nCheckmate! <@${status.winner}> wins!`;
      } else {
        display += `\n\nGame ended in a ${status.result}!`;
      }
      await sendMessage(message, display);
      return;
    }
    
    let display = chess.renderBoard(state);
    display += `\n<@${chess.getCurrentPlayerId(state)}>'s turn.`;
    await sendMessage(message, display);
    resetGameTimer(game.id, message);
  }
  
  else if (game.gameType === "minesweeper") {
    if (playerId !== state.playerId) return;
    
    if (content.startsWith(",reveal ") || content.startsWith(",r ")) {
      const coord = content.replace(",reveal ", "").replace(",r ", "").trim().toUpperCase();
      const row = coord.charCodeAt(0) - 65;
      const col = parseInt(coord.slice(1)) - 1;
      
      if (row >= 0 && row < 9 && col >= 0 && col < 9) {
        minesweeper.reveal(state, row, col);
        await storage.updateGameState(game.id, state);
        
        if (state.gameOver) {
          if (state.won) {
            const time = Math.floor((state.endTime! - state.startTime) / 1000);
            const stats = await storage.getOrCreateGameStats(playerId, "minesweeper");
            const extraStats = (stats.extraStats || {}) as Record<string, any>;
            extraStats.totalSolves = (extraStats.totalSolves || 0) + 1;
            extraStats.bestTime = Math.min(extraStats.bestTime || Infinity, time);
          }
          await storage.endGame(game.id);
        }
        
        await sendMessage(message, minesweeper.renderBoard(state, state.gameOver && !state.won));
      }
    } else if (content.startsWith(",flag ") || content.startsWith(",f ")) {
      const coord = content.replace(",flag ", "").replace(",f ", "").trim().toUpperCase();
      const row = coord.charCodeAt(0) - 65;
      const col = parseInt(coord.slice(1)) - 1;
      
      if (row >= 0 && row < 9 && col >= 0 && col < 9) {
        minesweeper.toggleFlag(state, row, col);
        await storage.updateGameState(game.id, state);
        await sendMessage(message, minesweeper.renderBoard(state));
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
          if (state.won) {
            const stats = await storage.getOrCreateGameStats(playerId, "wordle");
            const extraStats = (stats.extraStats || {}) as Record<string, any>;
            extraStats.totalSolves = (extraStats.totalSolves || 0) + 1;
            extraStats.currentStreak = (extraStats.currentStreak || 0) + 1;
            const time = Math.floor((state.endTime! - state.startTime) / 1000);
            extraStats.fastestSolve = Math.min(extraStats.fastestSolve || Infinity, time);
          }
          await storage.endGame(game.id);
        }
        
        await sendMessage(message, wordle.renderBoard(state));
      } else {
        await sendMessage(message, result.error || "Invalid guess.");
      }
    }
  }
}

function startGameTimer(gameId: string, message: Message) {
  const timer = setTimeout(async () => {
    const game = await storage.getActiveGameById(gameId);
    if (!game) return;
    
    const state = game.state as any;
    const currentPlayerId = game.currentTurn;
    
    if (currentPlayerId && game.player2Id) {
      const opponentId = currentPlayerId === game.player1Id ? game.player2Id : game.player1Id;
      await storage.recordGameResult(currentPlayerId, game.gameType, "loss");
      await storage.recordGameResult(opponentId, game.gameType, "win");
      await storage.awardWinCoins(opponentId);
      
      await sendMessage(message, `<@${currentPlayerId}> timed out. <@${opponentId}> wins!`);
    }
    
    await storage.endGame(gameId);
    gameTimers.delete(gameId);
  }, AFK_TIMEOUT);
  
  gameTimers.set(gameId, timer);
}

function resetGameTimer(gameId: string, message: Message) {
  clearGameTimer(gameId);
  startGameTimer(gameId, message);
}

function clearGameTimer(gameId: string) {
  const timer = gameTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    gameTimers.delete(gameId);
  }
}

client.on("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  await storage.seedShopItems();
  console.log("Bot is ready!");
});

client.on("messageCreate", async (message: Message) => {
  if (message.author.bot) return;
  
  const content = message.content.trim();
  
  if (content.startsWith(PREFIX)) {
    const args = content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    
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
        await handleGameCommand(message, "connect4");
        break;
      case "tictactoe":
      case "ttt":
        await handleGameCommand(message, "tictactoe");
        break;
      case "wordduel":
      case "wd":
        await handleGameCommand(message, "wordduel");
        break;
      case "chess":
        await handleGameCommand(message, "chess");
        break;
      case "minesweeper":
      case "ms":
        await handleSoloGame(message, "minesweeper");
        break;
      case "wordle":
      case "w":
        await handleSoloGame(message, "wordle");
        break;
      case "quit":
      case "q":
        await handleQuit(message);
        break;
      case "accept":
        await handleAccept(message);
        break;
      case "reveal":
      case "r":
      case "flag":
      case "f":
      case "move":
      case "m":
        await handleGameInput(message);
        break;
    }
  } else {
    await handleGameInput(message);
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN is not set");
  process.exit(1);
}

client.login(token);
