import http from "http";

const healthServer = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Playground Bot is running!");
  }
});
healthServer.listen(5000, "0.0.0.0", () => {
  console.log("Health check server running on port 5000");
});

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

async function sendCoinAnimation(channel: TextChannel, coinsEarned: number, playerId: string): Promise<void> {
  if (coinsEarned <= 0) return;
  
  setTimeout(async () => {
    try {
      await channel.send(`<@${playerId}> earned **+${coinsEarned}** 🪙`);
    } catch (e) {
      // Ignore if channel is unavailable
    }
  }, 1500);
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
  const help = `**PLAYGROUND - Commands**

**Games:**
\`,connect4\` - Play Connect 4 (queue or @user)
\`,tictactoe\` - Play Tic Tac Toe (queue or @user)
\`,wordduel\` - Play Word Duel (queue or @user)
\`,wordle\` - Play Wordle (solo)

**During Games:**
\`,quit\` - Forfeit current game

**Profile & Stats:**
\`,profile\` - View your profile
\`,leaderboard <game>\` - View leaderboard

**Shop (Coming Soon):**
\`,shop\` - Preview cosmetic shop

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
  let frame = "";
  
  if (player.equippedBadge) {
    const item = await storage.getShopItem(player.equippedBadge);
    if (item) badge = item.emoji + " ";
  }
  if (player.equippedTitle) {
    const item = await storage.getShopItem(player.equippedTitle);
    if (item) title = ` [${item.name}]`;
  }
  if (player.equippedFrame) {
    const item = await storage.getShopItem(player.equippedFrame);
    if (item) frame = ` ${item.emoji}`;
  }
  
  let profile = `${badge}**${player.displayName || player.username}**${title}${frame}\n`;
  profile += `@${player.username}\n\n`;
  
  profile += `**Overall Stats**\n`;
  profile += `🏆 ${player.totalWins}  💀 ${player.totalLosses}`;
  if (targetId === message.author.id) {
    profile += `  💰 ${player.coins}`;
  }
  if (player.dailyStreak && player.dailyStreak > 0) {
    profile += `  🔥 ${player.dailyStreak} day streak`;
  }
  profile += `\n\n`;
  
  const pvpGames = ["tictactoe", "connect4", "wordduel"];
  const soloGames = ["wordle"];
  const gameLabels: Record<string, string> = {
    tictactoe: "Tic Tac Toe",
    connect4: "Connect 4",
    wordduel: "Word Duel",
    wordle: "Wordle"
  };
  
  profile += `**PvP Rankings**\n`;
  for (const game of pvpGames) {
    const stats = await storage.getOrCreateGameStats(targetId, game);
    if (stats.wins > 0 || stats.losses > 0) {
      const rankBadge = storage.getRankBadge(stats.eloRating);
      const rankName = storage.getRankName(stats.eloRating);
      const streakText = stats.winStreak > 0 ? ` 🔥${stats.winStreak}` : "";
      profile += `${rankBadge} ${gameLabels[game]}: ${rankName} ⭐${stats.eloRating} (${stats.wins}W/${stats.losses}L)${streakText}\n`;
    }
  }
  
  profile += `\n**Solo Games**\n`;
  for (const game of soloGames) {
    const stats = await storage.getOrCreateGameStats(targetId, game);
    if (stats.wins > 0 || stats.losses > 0) {
      const streakText = stats.bestStreak > 0 ? ` (Best: ${stats.bestStreak})` : "";
      profile += `${gameLabels[game]}: ${stats.wins}W/${stats.losses}L${streakText}\n`;
    }
  }
  
  const matches = await storage.getMatchHistory(targetId, 5);
  if (matches.length > 0) {
    profile += `\n**Recent Matches**\n`;
    for (const match of matches) {
      const resultIcon = match.result === "win" ? "✅" : match.result === "draw" ? "🤝" : "❌";
      const eloText = match.eloChange > 0 ? `+${match.eloChange} ⭐` : `${match.eloChange} ⭐`;
      profile += `${resultIcon} **${match.opponentName}** (${gameLabels[match.gameType] || match.gameType}) ${eloText}\n`;
    }
  }
  
  await message.channel.send(profile);
}

const PVP_GAMES = ["tictactoe", "connect4", "wordduel"];

function clearLeaderboardCache(game?: string) {
  if (game) {
    leaderboardCache.delete(game);
  } else {
    leaderboardCache.clear();
  }
}

async function handleLeaderboard(message: Message, args: string[]) {
  const game = args[0]?.toLowerCase();
  const validGames = ["connect4", "tictactoe", "wordduel", "wordle"];
  
  if (!game || !validGames.includes(game)) {
    await message.channel.send(`Usage: ,leaderboard <game>\nGames: ${validGames.join(", ")}`);
    return;
  }
  
  const cacheKey = game;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60000) {
    await message.channel.send(cached.data);
    return;
  }
  
  const leaders = await storage.getLeaderboard(game);
  const playerRank = await storage.getPlayerRank(message.author.id, game);
  const playerStats = await storage.getOrCreateGameStats(message.author.id, game);
  const isPvP = PVP_GAMES.includes(game);
  
  let display = `**${game.toUpperCase()} LEADERBOARD**\n\n`;
  
  if (leaders.length === 0) {
    display += "No players yet. Be the first!\n";
  } else {
    for (let i = 0; i < leaders.length; i++) {
      const stat = leaders[i];
      const player = await storage.getPlayer(stat.discordId);
      const displayName = player?.displayName || "Unknown";
      const username = player?.username || "unknown";
      
      if (isPvP) {
        display += `${i + 1}. **${displayName}** (*@${username}*)\n`;
        display += `\u2800  ⭐ ${stat.eloRating}  🏆 ${stat.wins}  💀 ${stat.losses}  📈 ${stat.winRate.toFixed(0)}%\n`;
      } else {
        display += `${i + 1}. **${displayName}** (*@${username}*)\n`;
        display += `\u2800  🏆 ${stat.wins}  💀 ${stat.losses}  📈 ${stat.winRate.toFixed(0)}%\n`;
      }
    }
  }
  
  display += `\n**YOUR RANK:** #${playerRank}\n`;
  if (isPvP) {
    display += `\u2800  ⭐ ${playerStats.eloRating}  🏆 ${playerStats.wins}  💀 ${playerStats.losses}  📈 ${playerStats.winRate.toFixed(0)}%`;
  } else {
    display += `\u2800  🏆 ${playerStats.wins}  💀 ${playerStats.losses}  📈 ${playerStats.winRate.toFixed(0)}%`;
  }
  
  leaderboardCache.set(cacheKey, { data: display, timestamp: Date.now() });
  await message.channel.send(display);
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
  const roleEmoji = emojis[targetRole] || "";
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
    content = `**CONNECT 4**\n\n${player1Name} vs ${player2Name}\n\n${display}\n\nIt's **${player1Name}**'s turn\n`;
  } else if (gameType === "wordduel") {
    const scrambled = state.scrambledWords[0].toUpperCase();
    content = `**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nRound 1/5 | Score: 0 - 0\n\n⏱️ **3... 2... 1... GO!**\n\nUnscramble: **${scrambled}**\nType your answer!`;
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

async function handleGameCommand(message: Message, gameType: string) {
  const playerId = message.author.id;
  
  await storage.getOrCreatePlayer(playerId, message.author.username, message.author.displayName);
  
  const existingGame = await storage.getActiveGame(playerId);
  if (existingGame) {
    await message.channel.send("You're already in a game. Use `,quit` to leave.");
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
    
    await storage.createChallenge(playerId, challenged.id, gameType, message.channel.id);
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
      const player1Info = { username: message.author.username, displayName: message.author.displayName };
      const matchPlayer = await storage.getPlayer(match.discordId);
      const player2Info = matchPlayer ? { username: matchPlayer.username, displayName: matchPlayer.displayName || undefined } : undefined;
      await startPvPGame(channel, gameType, playerId, match.discordId, player1Info, player2Info, match.channelId);
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
  
  const challenge = allChallenges[0];
  
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
    wordduel: "Word Duel"
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
    
    if (PVP_GAMES.includes(game.gameType)) {
      const { winnerChange } = await storage.recordPvPResult(opponentId, playerId, game.gameType, opponentName, playerName);
      clearLeaderboardCache(game.gameType);
      await storage.recordForfeit(playerId);
      await sendToGameChannels(game, { content: `**${playerName}** forfeited. **${opponentName}** wins! (+${winnerChange})` });
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
    
    if (tictactoe.checkWin(state.board, state.currentPlayer)) {
      tictactoe.recordRoundWin(state, state.currentPlayer);
      
      const matchResult = tictactoe.isMatchOver(state);
      if (matchResult.over) {
        const winnerId = matchResult.winner === 1 ? state.player1Id : state.player2Id;
        const loserId = winnerId === state.player1Id ? state.player2Id : state.player1Id;
        
        let eloText = "";
        if (matchResult.winner) {
          const winnerName = await getPlayerName(winnerId);
          const loserName = await getPlayerName(loserId);
          const { winnerChange, coinsEarned } = await storage.recordPvPResult(winnerId, loserId, "tictactoe", winnerName, loserName);
          eloText = ` (+${winnerChange})`;
          clearLeaderboardCache("tictactoe");
          
          if (coinsEarned > 0 && interaction.channel) {
            sendCoinAnimation(interaction.channel as TextChannel, coinsEarned, winnerId);
          }
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const winnerName = await getPlayerName(winnerId);
        const buttons = ui.createTicTacToeBoard(state, game.id, true);
        const rematchBtn = ui.createRematchButton("tictactoe", state.player1Id, state.player2Id);
        buttons.push(rematchBtn);
        const scoreText = state.maxRounds > 1 ? `\nFinal Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
        const content = `**TIC TAC TOE**\n\n${player1Name} vs ${player2Name}${scoreText}\n\n🎉 **${winnerName}** wins the match!${eloText}`;
        
        await interaction.deferUpdate();
        await syncGameMessages(game, content, buttons);
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state);
      
      const nextPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(state));
      const buttons = ui.createTicTacToeBoard(state, game.id);
      const scoreText = `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
      const content = `**TIC TAC TOE**\n\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      resetGameTimer(game.id, interaction.channel as TextChannel);
      return;
    }
    
    if (tictactoe.isBoardFull(state.board)) {
      if (state.currentRound >= state.maxRounds) {
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const buttons = ui.createTicTacToeBoard(state, game.id, true);
        const rematchBtn = ui.createRematchButton("tictactoe", state.player1Id, state.player2Id);
        buttons.push(rematchBtn);
        const scoreText = `\nFinal Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
        const content = `**TIC TAC TOE**\n\n${player1Name} vs ${player2Name}${scoreText}\n\nMatch ended in a draw!`;
        
        await interaction.deferUpdate();
        await syncGameMessages(game, content, buttons);
        return;
      }
      
      tictactoe.resetBoard(state);
      await storage.updateGameState(game.id, state);
      
      const nextPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(state));
      const buttons = ui.createTicTacToeBoard(state, game.id);
      const scoreText = `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}`;
      const content = `**TIC TAC TOE**\n\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      resetGameTimer(game.id, interaction.channel as TextChannel);
      return;
    }
    
    tictactoe.switchTurn(state);
    await storage.updateGameState(game.id, state, tictactoe.getCurrentPlayerId(state));
    
    const nextPlayerName = await getPlayerName(tictactoe.getCurrentPlayerId(state));
    const buttons = ui.createTicTacToeBoard(state, game.id);
    const scoreText = state.maxRounds > 1 ? `\nRound ${state.currentRound}/${state.maxRounds} | Score: ${state.roundWins[0]} - ${state.roundWins[1]}` : "";
    const content = `**TIC TAC TOE**\n\n${player1Name} vs ${player2Name}${scoreText}\n\nIt's **${nextPlayerName}**'s turn`;
    
    await interaction.deferUpdate();
    await syncGameMessages(game, content, buttons);
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
      
      const winnerName = await getPlayerName(winnerId);
      const loserName = await getPlayerName(loserId);
      const { winnerChange, coinsEarned } = await storage.recordPvPResult(winnerId, loserId, "connect4", winnerName, loserName);
      clearLeaderboardCache("connect4");
      
      if (coinsEarned > 0 && interaction.channel) {
        sendCoinAnimation(interaction.channel as TextChannel, coinsEarned, winnerId);
      }
      
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const buttons = ui.createConnect4Board(state, game.id, true);
      const rematchBtn = ui.createRematchButton("connect4", state.player1Id, state.player2Id);
      buttons.push(rematchBtn);
      const content = `**CONNECT 4**\n\n${player1Name} vs ${player2Name}\n\n${display}\n\n🎉 **${winnerName}** wins! (+${winnerChange})`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      return;
    }
    
    if (connect4.isBoardFull(state.board)) {
      clearGameTimer(game.id);
      await storage.endGame(game.id);
      
      const buttons = ui.createConnect4Board(state, game.id, true);
      const rematchBtn = ui.createRematchButton("connect4", state.player1Id, state.player2Id);
      buttons.push(rematchBtn);
      const content = `**CONNECT 4**\n\n${player1Name} vs ${player2Name}\n\n${display}\n\nIt's a draw!`;
      
      await interaction.deferUpdate();
      await syncGameMessages(game, content, buttons);
      return;
    }
    
    connect4.switchTurn(state);
    await storage.updateGameState(game.id, state, connect4.getCurrentPlayerId(state));
    
    const nextPlayerName = await getPlayerName(connect4.getCurrentPlayerId(state));
    const buttons = ui.createConnect4Board(state, game.id);
    const content = `**CONNECT 4**\n\n${player1Name} vs ${player2Name}\n\n${display}\n\nIt's **${nextPlayerName}**'s turn`;
    
    await interaction.deferUpdate();
    await syncGameMessages(game, content, buttons);
    resetGameTimer(game.id, interaction.channel as TextChannel);
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
      
      let eloText = "";
      if (PVP_GAMES.includes(game.gameType)) {
        const { winnerChange } = await storage.recordPvPResult(opponentId, userId, game.gameType, opponentName, userName);
        eloText = ` (+${winnerChange})`;
        clearLeaderboardCache(game.gameType);
      } else {
        await storage.recordGameResult(userId, game.gameType, "loss");
        await storage.recordGameResult(opponentId, game.gameType, "win");
      }
      await storage.recordForfeit(userId);
      
      await interaction.update({
        content: `**${userName}** forfeited. **${opponentName}** wins!${eloText}`,
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
    
    await storage.createChallenge(challengerId, opponentId, gameType, channelId);
    const challengerName = await getPlayerName(challengerId);
    
    const gameNames: Record<string, string> = {
      tictactoe: "Tic Tac Toe",
      connect4: "Connect 4",
      wordduel: "Word Duel"
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
        if (winner) {
          const loserId = winner === state.player1Id ? state.player2Id : state.player1Id;
          const winnerName = await getPlayerName(winner);
          const loserName = await getPlayerName(loserId);
          const { winnerChange, coinsEarned } = await storage.recordPvPResult(winner, loserId, "wordduel", winnerName, loserName);
          eloText = ` (+${winnerChange})`;
          clearLeaderboardCache("wordduel");
          
          if (coinsEarned > 0) {
            sendCoinAnimation(message.channel as TextChannel, coinsEarned, winner);
          }
        }
        
        clearGameTimer(game.id);
        await storage.endGame(game.id);
        
        const winnerName = winner ? await getPlayerName(winner) : null;
        const resultText = winnerName ? `🎉 **${winnerName}** wins!${eloText}` : "It's a draw!";
        const rematchBtn = ui.createRematchButton("wordduel", state.player1Id, state.player2Id);
        await message.channel.send({
          content: `**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nFinal Score: ${state.scores[0]} - ${state.scores[1]}\n\n${resultText}`,
          components: [rematchBtn]
        });
        return;
      }
      
      const previousWord = state.words[state.currentWordIndex - 1];
      const scrambled = state.scrambledWords[state.currentWordIndex].toUpperCase();
      await message.channel.send(`**${playerName}** got it! The word was: **${previousWord.toUpperCase()}**\n\n**WORD DUEL**\n\n${player1Name} vs ${player2Name}\nRound ${state.currentWordIndex + 1}/5 | Score: ${state.scores[0]} - ${state.scores[1]}\n\n⏱️ **3... 2... 1... GO!**\n\nUnscramble: **${scrambled}**`);
      resetGameTimer(game.id, message.channel as TextChannel);
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
          const coinsEarned = await storage.recordGameResult(state.playerId, "wordle", result);
          clearLeaderboardCache("wordle");
          await storage.endGame(game.id);
          
          if (state.won && coinsEarned > 0) {
            sendCoinAnimation(message.channel as TextChannel, coinsEarned, state.playerId);
          }
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
        // Game over
        const winner = wordduel.getWinner(state);
        let eloText = "";
        if (winner) {
          const loserId = winner === state.player1Id ? state.player2Id : state.player1Id;
          const winnerName = await getPlayerName(winner);
          const loserName = await getPlayerName(loserId);
          const { winnerChange } = await storage.recordPvPResult(winner, loserId, "wordduel", winnerName, loserName);
          eloText = ` (+${winnerChange})`;
          clearLeaderboardCache("wordduel");
        }
        
        await storage.endGame(gameId);
        gameTimers.delete(gameId);
        
        const winnerName = winner ? await getPlayerName(winner) : null;
        const resultText = winnerName ? `**${winnerName}** wins!${eloText}` : "It's a draw!";
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
      
      let eloText = "";
      if (PVP_GAMES.includes(game.gameType)) {
        const { winnerChange } = await storage.recordPvPResult(opponentId, currentPlayerId, game.gameType, winnerName, timedOutName);
        eloText = ` (+${winnerChange})`;
        clearLeaderboardCache(game.gameType);
      } else {
        await storage.recordGameResult(currentPlayerId, game.gameType, "loss");
        await storage.recordGameResult(opponentId, game.gameType, "win");
      }
      await sendToGameChannels(game, { content: `**${timedOutName}** timed out. **${winnerName}** wins!${eloText}` });
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

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN is not set");
  process.exit(1);
}

client.login(token);
