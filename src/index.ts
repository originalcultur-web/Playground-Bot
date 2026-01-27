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
import * as chess from "./games/chess.js";
import * as minesweeper from "./games/minesweeper.js";
import * as wordle from "./games/wordle.js";
import * as ui from "./ui/gameComponents.js";

const PREFIX = ",";
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
const gameMessages = new Map<string, string>();

async function getPlayerName(discordId: string): Promise<string> {
  const player = await storage.getPlayer(discordId);
  return player?.displayName || player?.username || "Unknown";
}

async function handleHelp(message: Message) {
  const help = `**PLAYGROUND - Commands**

**Games:**
\`,connect4\` - Play Connect 4 (queue or @user)
\`,tictactoe\` - Play Tic Tac Toe (queue or @user)
\`,wordduel\` - Play Word Duel (queue or @user)
\`,chess\` - Play Chess (queue or @user)
\`,minesweeper\` - Play Minesweeper (solo)
\`,wordle\` - Play Wordle (solo)

**During Games:**
\`,quit\` - Forfeit current game

**Profile & Stats:**
\`,profile\` - View your profile
\`,leaderboard <game>\` - View leaderboard

**Shop & Inventory:**
\`,shop\` - Browse the shop
\`,buy <number>\` - Buy an item
\`,inventory\` - View your inventory
\`,equip <number>\` - Equip an item

\`,accept\` - Accept a challenge`;
  await message.channel.send(help);
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
    await message.channel.send(`${targetName} hasn't played any games yet.`);
    return;
  }
  
  let badge = "";
  let title = "";
  
  if (player.equippedBadge) {
    const item = await storage.getShopItem(player.equippedBadge);
    if (item) badge = item.emoji;
  }
  if (player.equippedTitle) {
    const item = await storage.getShopItem(player.equippedTitle);
    if (item) title = ` [${item.name}]`;
  }
  
  let profile = `${badge}**${player.displayName || player.username}**${title}
@${player.username}

Total Wins: ${player.totalWins}
Total Losses: ${player.totalLosses}`;
  
  if (targetId === message.author.id) {
    profile += `\nCoins: ${player.coins}`;
  }
  
  await message.channel.send(profile);
}

async function handleLeaderboard(message: Message, args: string[]) {
  const game = args[0]?.toLowerCase();
  const validGames = ["connect4", "tictactoe", "chess", "wordduel", "minesweeper", "wordle"];
  
  if (!game || !validGames.includes(game)) {
    await message.channel.send(`Usage: ,leaderboard <game>\nGames: ${validGames.join(", ")}`);
    return;
  }
  
  const cacheKey = game;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 300000) {
    await message.channel.send(cached.data);
    return;
  }
  
  const leaders = await storage.getLeaderboard(game);
  const playerRank = await storage.getPlayerRank(message.author.id, game);
  const playerStats = await storage.getOrCreateGameStats(message.author.id, game);
  
  let display = `**${game.toUpperCase()} - LEADERBOARD**\n\n`;
  
  if (leaders.length === 0) {
    display += "No players yet. Be the first!\n";
  } else {
    for (let i = 0; i < leaders.length; i++) {
      const stat = leaders[i];
      const player = await storage.getPlayer(stat.discordId);
      const winRate = stat.winRate.toFixed(0);
      display += `${i + 1}. ${player?.displayName || "Unknown"}\n`;
      display += `   Wins: ${stat.wins} | Losses: ${stat.losses} | Win%: ${winRate}\n\n`;
    }
  }
  
  display += `\n**YOUR RANK:** ${playerRank}\n`;
  display += `Wins: ${playerStats.wins} | Losses: ${playerStats.losses} | Win%: ${playerStats.winRate.toFixed(0)}`;
  
  leaderboardCache.set(cacheKey, { data: display, timestamp: Date.now() });
  await message.channel.send(display);
}

async function handleShop(message: Message, args: string[]) {
  const category = args[0]?.toLowerCase();
  const items = await storage.getShopItems(category);
  
  if (items.length === 0) {
    await message.channel.send("No items found. Categories: badges, titles, frames, connect4, chess");
    return;
  }
  
  let display = "**SHOP**\n\n";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    display += `${i + 1}. ${item.emoji} ${item.name} - ${item.price} coins\n`;
    if (item.description) display += `   ${item.description}\n`;
  }
  display += "\nUse `,buy <number>` to purchase";
  
  await message.channel.send(display);
}

async function handleBuy(message: Message, args: string[]) {
  const itemNumber = parseInt(args[0]);
  if (isNaN(itemNumber) || itemNumber < 1) {
    await message.channel.send("Usage: ,buy <number>");
    return;
  }
  
  const items = await storage.getShopItems();
  if (itemNumber > items.length) {
    await message.channel.send("Invalid item number.");
    return;
  }
  
  const item = items[itemNumber - 1];
  const result = await storage.purchaseItem(message.author.id, item.id);
  
  if (result.success) {
    await message.channel.send(`Purchased ${item.emoji} ${item.name}! It has been equipped.`);
  } else {
    await message.channel.send(result.error || "Purchase failed.");
  }
}

async function handleInventory(message: Message) {
  const inventory = await storage.getUserInventory(message.author.id);
  
  if (inventory.length === 0) {
    await message.channel.send("Your inventory is empty. Visit ,shop to browse items!");
    return;
  }
  
  let display = "**YOUR INVENTORY**\n\n";
  for (let i = 0; i < inventory.length; i++) {
    const inv = inventory[i];
    if (inv.item) {
      display += `${i + 1}. ${inv.item.emoji} ${inv.item.name} (${inv.item.itemType})\n`;
    }
  }
  display += "\nUse `,equip <number>` to equip an item";
  
  await message.channel.send(display);
}

async function handleEquip(message: Message, args: string[]) {
  const itemNumber = parseInt(args[0]);
  if (isNaN(itemNumber) || itemNumber < 1) {
    await message.channel.send("Usage: ,equip <number>");
    return;
  }
  
  const inventory = await storage.getUserInventory(message.author.id);
  if (itemNumber > inventory.length) {
    await message.channel.send("Invalid item number.");
    return;
  }
  
  const inv = inventory[itemNumber - 1];
  if (!inv.item) {
    await message.channel.send("Item not found.");
    return;
  }
  
  await storage.equipItem(message.author.id, inv.itemId);
  await message.channel.send(`Equipped ${inv.item.emoji} ${inv.item.name}!`);
}

async function handleUnequip(message: Message, args: string[]) {
  const type = args[0]?.toLowerCase();
  const validTypes = ["badge", "title", "frame", "skin"];
  
  if (!type || !validTypes.includes(type)) {
    await message.channel.send(`Usage: ,unequip <type>\nTypes: ${validTypes.join(", ")}`);
    return;
  }
  
  await storage.unequipItem(message.author.id, type, args[1]);
  await message.channel.send(`Unequipped ${type}.`);
}

async function startPvPGame(channel: TextChannel, gameType: string, player1Id: string, player2Id: string) {
  await storage.getOrCreatePlayer(player1Id, player1Id);
  await storage.getOrCreatePlayer(player2Id, player2Id);
  
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
    case "chess":
      state = chess.createGameState(player1Id, player2Id);
      break;
    default:
      return;
  }
  
  const game = await storage.createActiveGame(gameType, player1Id, channel.id, state, player2Id);
  await storage.recordRecentOpponent(player1Id, player2Id, gameType);
  
  const player1Name = await getPlayerName(player1Id);
  const player2Name = await getPlayerName(player2Id);
  
  let sentMessage;
  
  if (gameType === "tictactoe") {
    const buttons = ui.createTicTacToeBoard(state, game.id);
    const scoreText = state.maxRounds > 1 ? `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
    sentMessage = await channel.send({
      content: `🎮 **TIC TAC TOE**\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${player1Name}**'s turn`,
      components: buttons
    });
  } else if (gameType === "connect4") {
    const buttons = ui.createConnect4Board(state, game.id);
    const display = ui.createConnect4Display(state);
    sentMessage = await channel.send({
      content: `🎮 **CONNECT 4**\n${player1Name} (🔴) vs ${player2Name} (🟡)\n\n${display}\n\nIt's **${player1Name}**'s turn`,
      components: buttons
    });
  } else if (gameType === "wordduel") {
    const scrambled = state.scrambledWords[0].toUpperCase();
    sentMessage = await channel.send({
      content: `⚔️ **WORD DUEL**\n${player1Name} vs ${player2Name}\nRound 1/5 | Score: 0 - 0\n\nUnscramble: **${scrambled}**\nType your answer!`
    });
  } else if (gameType === "chess") {
    const chessBoard = createChessDisplay(state);
    sentMessage = await channel.send({
      content: `♟️ **CHESS**\n${player1Name} (White) vs ${player2Name} (Black)\n\`\`\`\n${chessBoard}\n\`\`\`\nIt's **${player1Name}**'s turn - Type your move (e.g., e4, Nf3)`
    });
  }
  
  if (sentMessage) {
    gameMessages.set(game.id, sentMessage.id);
  }
  
  startGameTimer(game.id, channel);
}

function createChessDisplay(state: any): string {
  const chessModule = chess as any;
  const chessJs = new (require("chess.js").Chess)(state.fen);
  const board = chessJs.board();
  
  const pieceMap: Record<string, string> = {
    "wk": "♔", "wq": "♕", "wr": "♖", "wb": "♗", "wn": "♘", "wp": "♙",
    "bk": "♚", "bq": "♛", "br": "♜", "bb": "♝", "bn": "♞", "bp": "♟",
  };
  
  let display = "  a b c d e f g h\n";
  for (let row = 0; row < 8; row++) {
    display += `${8 - row} `;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const key = piece.color + piece.type;
        display += pieceMap[key] + " ";
      } else {
        display += ". ";
      }
    }
    display += `${8 - row}\n`;
  }
  display += "  a b c d e f g h";
  return display;
}

async function handleGameCommand(message: Message, gameType: string) {
  const playerId = message.author.id;
  
  await storage.getOrCreatePlayer(playerId, message.author.username, message.author.displayName);
  
  const existingGame = await storage.getActiveGame(playerId);
  if (existingGame) {
    await message.channel.send("You're already in a game. Use `,quit` to leave.");
    return;
  }
  
  if (await storage.isQueueLocked(playerId)) {
    await message.channel.send("You're temporarily locked from matchmaking due to forfeits.");
    return;
  }
  
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
    
    await storage.createChallenge(playerId, challenged.id, gameType, message.channel.id);
    const challengerName = await getPlayerName(playerId);
    await message.channel.send(`**${challenged.displayName || challenged.username}**, you've been challenged to **${gameType.toUpperCase()}** by **${challengerName}**!\nType \`,accept\` to play.`);
    return;
  }
  
  await storage.addToQueue(playerId, gameType, message.channel.id);
  await message.channel.send(`🔍 Looking for a **${gameType.toUpperCase()}** opponent... (type \`,quit\` to cancel)`);
  
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
      
      const channel = message.channel as TextChannel;
      await startPvPGame(channel, gameType, playerId, match.discordId);
    } else if (attempts < 12) {
      matchmakingTimers.set(playerId, setTimeout(findOpponent, 5000));
    } else {
      await storage.removeFromQueue(playerId);
      matchmakingTimers.delete(playerId);
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
  
  const challenge = allChallenges[0];
  await storage.removeChallenge(challenge.id);
  
  await storage.getOrCreatePlayer(message.author.id, message.author.username, message.author.displayName);
  
  const channel = message.channel as TextChannel;
  await startPvPGame(channel, challenge.gameType, challenge.challengerId, message.author.id);
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
  
  if (gameType === "minesweeper") {
    state = minesweeper.createGameState(playerId);
    state.size = 5;
    state.mines = 5;
    state.board = createMinesweeperBoard(5, 5);
    state.revealed = Array(5).fill(null).map(() => Array(5).fill(false));
    state.flagged = Array(5).fill(null).map(() => Array(5).fill(false));
    
    const game = await storage.createActiveGame(gameType, playerId, message.channel.id, state);
    const buttons = ui.createMinesweeperBoard(state, game.id);
    
    sentMessage = await message.channel.send({
      content: `💣 **MINESWEEPER**\nClick cells to reveal`,
      components: buttons
    });
    
    if (sentMessage) {
      gameMessages.set(game.id, sentMessage.id);
    }
  } else if (gameType === "wordle") {
    state = wordle.createGameState(playerId);
    const game = await storage.createActiveGame(gameType, playerId, message.channel.id, state);
    
    sentMessage = await message.channel.send({
      content: `📝 **WORDLE**\n⬜⬜⬜⬜⬜\n⬜⬜⬜⬜⬜\n⬜⬜⬜⬜⬜\n⬜⬜⬜⬜⬜\n⬜⬜⬜⬜⬜\n⬜⬜⬜⬜⬜\n\nGuesses: 0/6\nType a 5-letter word to guess!`
    });
    
    if (sentMessage) {
      gameMessages.set(game.id, sentMessage.id);
    }
  }
}

function createMinesweeperBoard(size: number, mines: number): number[][] {
  const board = Array(size).fill(null).map(() => Array(size).fill(0));
  
  let minesPlaced = 0;
  while (minesPlaced < mines) {
    const row = Math.floor(Math.random() * size);
    const col = Math.floor(Math.random() * size);
    if (board[row][col] !== -1) {
      board[row][col] = -1;
      minesPlaced++;
    }
  }
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === -1) {
            count++;
          }
        }
      }
      board[row][col] = count;
    }
  }
  
  return board;
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
    await storage.recordGameResult(playerId, game.gameType, "loss");
    await storage.recordGameResult(opponentId, game.gameType, "win");
    await storage.awardWinCoins(opponentId);
    await storage.recordForfeit(playerId);
    await message.channel.send(`**${playerName}** forfeited. **${opponentName}** wins!`);
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
        
        const winnerName = await getPlayerName(winnerId);
        const buttons = ui.createTicTacToeBoard(state, game.id, true);
        const scoreText = state.maxRounds > 1 ? `\nFinal Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
        
        await interaction.update({
          content: `🎮 **TIC TAC TOE**\n${player1Name} vs ${player2Name}${scoreText}\n\n🏆 **${winnerName}** wins the match!`,
          components: buttons
        });
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state);
      
      const nextPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(state));
      const buttons = ui.createTicTacToeBoard(state, game.id);
      const scoreText = `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
      
      await interaction.update({
        content: `🎮 **TIC TAC TOE**\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn`,
        components: buttons
      });
      resetGameTimer(game.id, interaction.channel as TextChannel);
      return;
    }
    
    if (tictactoe.isBoardFull(state.board)) {
      if (state.currentRound >= state.maxRounds) {
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const buttons = ui.createTicTacToeBoard(state, game.id, true);
        const scoreText = `\nFinal Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
        
        await interaction.update({
          content: `🎮 **TIC TAC TOE**\n${player1Name} vs ${player2Name}${scoreText}\n\n🤝 Match ended in a draw!`,
          components: buttons
        });
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state);
      
      const nextPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(state));
      const buttons = ui.createTicTacToeBoard(state, game.id);
      const scoreText = `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
      
      await interaction.update({
        content: `🎮 **TIC TAC TOE**\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn`,
        components: buttons
      });
      resetGameTimer(game.id, interaction.channel as TextChannel);
      return;
    }
    
    tictactoe.switchTurn(state);
    await storage.updateGameState(game.id, state, tictactoe.getCurrentPlayerId(state));
    
    const nextPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(state));
    const buttons = ui.createTicTacToeBoard(state, game.id);
    const scoreText = state.maxRounds > 1 ? `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
    
    await interaction.update({
      content: `🎮 **TIC TAC TOE**\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn`,
      components: buttons
    });
    resetGameTimer(game.id, interaction.channel as TextChannel);
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
    
    if (connect4.checkWin(state.board, state.currentPlayer)) {
      const winnerId = connect4.getCurrentPlayerId(state);
      const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
      
      await storage.recordGameResult(winnerId, "connect4", "win");
      await storage.recordGameResult(loserId, "connect4", "loss");
      await storage.awardWinCoins(winnerId);
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const winnerName = await getPlayerName(winnerId);
      const buttons = ui.createConnect4Board(state, game.id, true);
      
      await interaction.update({
        content: `🎮 **CONNECT 4**\n${player1Name} (🔴) vs ${player2Name} (🟡)\n\n${display}\n\n🏆 **${winnerName}** wins!`,
        components: buttons
      });
      return;
    }
    
    if (connect4.isBoardFull(state.board)) {
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const buttons = ui.createConnect4Board(state, game.id, true);
      
      await interaction.update({
        content: `🎮 **CONNECT 4**\n${player1Name} (🔴) vs ${player2Name} (🟡)\n\n${display}\n\n🤝 It's a draw!`,
        components: buttons
      });
      return;
    }
    
    connect4.switchTurn(state);
    await storage.updateGameState(game.id, state, connect4.getCurrentPlayerId(state));
    
    const nextPlayerName = await getPlayerName(connect4.getCurrentPlayerId(state));
    const buttons = ui.createConnect4Board(state, game.id);
    
    await interaction.update({
      content: `🎮 **CONNECT 4**\n${player1Name} (🔴) vs ${player2Name} (🟡)\n\n${display}\n\nIt's **${nextPlayerName}**'s turn`,
      components: buttons
    });
    resetGameTimer(game.id, interaction.channel as TextChannel);
  }
  
  else if (customId.startsWith("msflag_")) {
    const gameId = customId.split("_")[1];
    
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
    
    state.flagMode = !state.flagMode;
    await storage.updateGameState(game.id, state);
    
    const buttons = ui.createMinesweeperBoard(state, game.id);
    const modeText = state.flagMode ? "🚩 Flag mode - click to place/remove flags" : "🔍 Reveal mode - click to reveal cells";
    
    await interaction.update({
      content: `💣 **MINESWEEPER**\n${modeText}`,
      components: buttons
    });
  }
  
  else if (customId.startsWith("ms_")) {
    const parts = customId.split("_");
    const gameId = parts[1];
    const row = parseInt(parts[2]);
    const col = parseInt(parts[3]);
    
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
    
    if (state.flagMode) {
      state.flagged[row][col] = !state.flagged[row][col];
    } else {
      if (state.flagged[row][col]) {
        await interaction.reply({ content: "Remove the flag first!", ephemeral: true });
        return;
      }
      revealMinesweeperCell(state, row, col);
    }
    
    await storage.updateGameState(game.id, state);
    
    if (state.gameOver) {
      await storage.endGame(game.id);
    }
    
    const buttons = ui.createMinesweeperBoard(state, game.id);
    let statusText = state.flagMode ? "🚩 Flag mode - click to place/remove flags" : "🔍 Reveal mode - click to reveal cells";
    
    if (state.gameOver) {
      if (state.won) {
        const time = Math.floor((state.endTime - state.startTime) / 1000);
        statusText = `You won! Time: ${time}s`;
      } else {
        statusText = "Game Over! You hit a mine.";
      }
    }
    
    await interaction.update({
      content: `💣 **MINESWEEPER**\n${statusText}`,
      components: buttons
    });
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
      await storage.recordGameResult(userId, game.gameType, "loss");
      await storage.recordGameResult(opponentId, game.gameType, "win");
      await storage.awardWinCoins(opponentId);
      await storage.recordForfeit(userId);
      
      await interaction.update({
        content: `**${userName}** forfeited. **${opponentName}** wins!`,
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
}

function revealMinesweeperCell(state: any, row: number, col: number): void {
  const size = state.size || 5;
  if (row < 0 || row >= size || col < 0 || col >= size) return;
  if (state.revealed[row][col] || state.flagged[row][col]) return;
  if (state.gameOver) return;
  
  state.revealed[row][col] = true;
  
  if (state.board[row][col] === -1) {
    state.gameOver = true;
    state.won = false;
    state.endTime = Date.now();
    return;
  }
  
  if (state.board[row][col] === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        revealMinesweeperCell(state, row + dr, col + dc);
      }
    }
  }
  
  let allRevealed = true;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.board[r][c] !== -1 && !state.revealed[r][c]) {
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
        if (winner) {
          const loserId = winner === state.player1Id ? state.player2Id : state.player1Id;
          await storage.recordGameResult(winner, "wordduel", "win");
          await storage.recordGameResult(loserId, "wordduel", "loss");
          await storage.awardWinCoins(winner);
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const winnerName = winner ? await getPlayerName(winner) : null;
        const resultText = winnerName ? `🏆 **${winnerName}** wins!` : "🤝 It's a draw!";
        await message.channel.send(`⚔️ **WORD DUEL**\n${player1Name} vs ${player2Name}\nFinal Score: ${state.scores[0]} - ${state.scores[1]}\n\n${resultText}`);
        return;
      }
      
      const previousWord = state.words[state.currentWordIndex - 1];
      const scrambled = state.scrambledWords[state.currentWordIndex].toUpperCase();
      await message.channel.send(`✅ **${playerName}** got it! The word was: **${previousWord.toUpperCase()}**\n\n⚔️ **WORD DUEL**\n${player1Name} vs ${player2Name}\nRound ${state.currentWordIndex + 1}/5 | Score: ${state.scores[0]} - ${state.scores[1]}\n\nUnscramble: **${scrambled}**`);
      resetGameTimer(game.id, message.channel as TextChannel);
    }
  }
  
  else if (game.gameType === "chess") {
    if (state.currentTurn === "w" && playerId !== state.player1Id) return;
    if (state.currentTurn === "b" && playerId !== state.player2Id) return;
    
    const move = content.replace(",move ", "").replace(",m ", "").trim();
    const result = chess.makeMove(state, move);
    
    if (!result.success) {
      await message.reply(result.error || "Invalid move.");
      return;
    }
    
    const status = chess.getGameStatus(state);
    await storage.updateGameState(game.id, state, chess.getCurrentPlayerId(state));
    
    const player1Name = await getPlayerName(state.player1Id);
    const player2Name = await getPlayerName(state.player2Id);
    const currentPlayerName = await getPlayerName(chess.getCurrentPlayerId(state));
    const chessBoard = createChessDisplay(state);
    
    if (status.over) {
      if (status.winner) {
        const loserId = status.winner === state.player1Id ? state.player2Id : state.player1Id;
        await storage.recordGameResult(status.winner, "chess", "win");
        await storage.recordGameResult(loserId, "chess", "loss");
        await storage.awardWinCoins(status.winner);
      }
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const winnerName = status.winner ? await getPlayerName(status.winner) : null;
      const resultText = status.result === "checkmate" 
        ? `Checkmate! **${winnerName}** wins!`
        : `Game ended in a ${status.result}!`;
      
      await message.channel.send(`♟️ **CHESS**\n${player1Name} (White) vs ${player2Name} (Black)\n\`\`\`\n${chessBoard}\n\`\`\`\n${resultText}`);
      return;
    }
    
    await message.channel.send(`♟️ **CHESS**\n${player1Name} (White) vs ${player2Name} (Black)\n\`\`\`\n${chessBoard}\n\`\`\`\nIt's **${currentPlayerName}**'s turn - Type your move (e.g., e4, Nf3)`);
    resetGameTimer(game.id, message.channel as TextChannel);
  }
  
  else if (game.gameType === "wordle") {
    if (playerId !== state.playerId) return;
    
    if (content.length === 5 && /^[a-z]+$/.test(content)) {
      const result = wordle.makeGuess(state, content);
      
      if (result.valid) {
        await storage.updateGameState(game.id, state);
        
        if (state.gameOver) {
          await storage.endGame(game.id);
        }
        
        let display = "📝 **WORDLE**\n";
        for (const guess of state.guesses) {
          const colors = evaluateWordleGuess(state.targetWord, guess);
          display += colors.join("") + " **" + guess.toUpperCase() + "**\n";
        }
        const remaining = state.maxGuesses - state.guesses.length;
        for (let i = 0; i < remaining; i++) {
          display += "⬜⬜⬜⬜⬜\n";
        }
        display += `\nGuesses: ${state.guesses.length}/${state.maxGuesses}`;
        
        if (state.gameOver) {
          if (state.won) {
            const time = Math.floor((state.endTime - state.startTime) / 1000);
            display += `\n\n🎉 You won in ${state.guesses.length} guess${state.guesses.length > 1 ? 'es' : ''}! Time: ${time}s`;
          } else {
            display += `\n\nGame over! The word was: **${state.targetWord.toUpperCase()}**`;
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
    
    const currentPlayerId = game.currentTurn;
    
    if (currentPlayerId && game.player2Id) {
      const opponentId = currentPlayerId === game.player1Id ? game.player2Id : game.player1Id;
      await storage.recordGameResult(currentPlayerId, game.gameType, "loss");
      await storage.recordGameResult(opponentId, game.gameType, "win");
      await storage.awardWinCoins(opponentId);
      
      const timedOutName = await getPlayerName(currentPlayerId);
      const winnerName = await getPlayerName(opponentId);
      await channel.send(`⏰ **${timedOutName}** timed out. **${winnerName}** wins!`);
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
  await storage.seedShopItems();
  console.log("Bot is ready!");
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

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN is not set");
  process.exit(1);
}

client.login(token);
