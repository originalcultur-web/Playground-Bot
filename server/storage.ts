import { db } from "./db.js";
import { eq, and, desc, sql, gt, or, asc } from "drizzle-orm";
import {
  players,
  gameStats,
  activeGames,
  matchHistory,
  recentOpponents,
  matchmakingQueue,
  pendingChallenges,
  shopItems,
  userInventory,
  customEmojis,
  type Player,
  type GameStat,
  type ActiveGame,
  type ShopItem,
  type CustomEmoji,
} from "#shared/schema.js";

const OWNER_DISCORD_ID = "599479092076609547";

export type StaffRole = "owner" | "admin" | "mod" | "support" | null;

const STAFF_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  mod: 2,
  support: 1,
};

export function getStaffLevel(role: StaffRole): number {
  if (!role) return 0;
  return STAFF_HIERARCHY[role] || 0;
}

export function isOwner(discordId: string): boolean {
  return discordId === OWNER_DISCORD_ID;
}

export function canManageRole(managerRole: StaffRole, targetRole: StaffRole): boolean {
  const managerLevel = getStaffLevel(managerRole);
  const targetLevel = getStaffLevel(targetRole);
  return managerLevel > targetLevel;
}

const DAILY_COIN_CAP = 50;
const COINS_PER_WIN = 5;

export async function getOrCreatePlayer(discordId: string, username: string, displayName?: string): Promise<Player> {
  const existing = await db.query.players.findFirst({
    where: eq(players.discordId, discordId),
  });
  
  if (existing) {
    if (existing.username !== username || existing.displayName !== displayName) {
      await db.update(players)
        .set({ username, displayName: displayName || username })
        .where(eq(players.discordId, discordId));
    }
    return existing;
  }
  
  const [newPlayer] = await db.insert(players)
    .values({ discordId, username, displayName: displayName || username })
    .returning();
  return newPlayer;
}

export async function getPlayer(discordId: string): Promise<Player | undefined> {
  return db.query.players.findFirst({
    where: eq(players.discordId, discordId),
  });
}

export async function updatePlayerCoins(discordId: string, amount: number): Promise<boolean> {
  const player = await getPlayer(discordId);
  if (!player) return false;
  
  await db.update(players)
    .set({ coins: player.coins + amount })
    .where(eq(players.discordId, discordId));
  return true;
}

export async function awardWinCoins(discordId: string): Promise<number> {
  // Coin rewards disabled until shop is ready
  return 0;
}

export async function updateDailyStreak(discordId: string): Promise<{ streak: number; isNewStreak: boolean }> {
  const player = await getPlayer(discordId);
  if (!player) return { streak: 0, isNewStreak: false };
  
  const today = new Date().toISOString().split('T')[0];
  const lastPlayed = player.lastPlayedDate;
  
  if (lastPlayed === today) {
    return { streak: player.dailyStreak, isNewStreak: false };
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  let newStreak: number;
  let isNewStreak = false;
  
  if (lastPlayed === yesterdayStr) {
    newStreak = player.dailyStreak + 1;
    isNewStreak = true;
  } else if (!lastPlayed) {
    newStreak = 1;
    isNewStreak = true;
  } else {
    newStreak = 1;
    isNewStreak = player.dailyStreak > 0;
  }
  
  await db.update(players)
    .set({ dailyStreak: newStreak, lastPlayedDate: today })
    .where(eq(players.discordId, discordId));
  
  return { streak: newStreak, isNewStreak };
}

export async function getOrCreateGameStats(discordId: string, game: string): Promise<GameStat> {
  const existing = await db.query.gameStats.findFirst({
    where: and(eq(gameStats.discordId, discordId), eq(gameStats.game, game)),
  });
  
  if (existing) return existing;
  
  const [newStats] = await db.insert(gameStats)
    .values({ discordId, game })
    .returning();
  return newStats;
}

function calculateEloChange(winnerElo: number, loserElo: number): number {
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.round(K * (1 - expectedWinner));
}

export async function recordPvPResult(
  winnerId: string,
  loserId: string,
  game: string,
  winnerName?: string,
  loserName?: string,
  duration?: number
): Promise<{ winnerChange: number; loserChange: number; coinsEarned: number; eloAffected: boolean; dailyGamesCount: number }> {
  const winnerStats = await getOrCreateGameStats(winnerId, game);
  const loserStats = await getOrCreateGameStats(loserId, game);
  const winnerPlayer = await getPlayer(winnerId);
  const loserPlayer = await getPlayer(loserId);
  
  const { affects: eloAffected, gamesPlayed: dailyGamesCount } = await shouldAffectElo(winnerId, loserId, game);
  const eloChange = eloAffected ? calculateEloChange(winnerStats.eloRating, loserStats.eloRating) : 0;
  
  const winnerWins = winnerStats.wins + 1;
  const winnerWinStreak = winnerStats.winStreak + 1;
  const winnerBestStreak = Math.max(winnerStats.bestStreak, winnerWinStreak);
  const winnerTotalGames = winnerWins + winnerStats.losses;
  const winnerWinRate = winnerTotalGames > 0 ? (winnerWins / winnerTotalGames) * 100 : 0;
  const winnerNewElo = eloAffected ? winnerStats.eloRating + eloChange : winnerStats.eloRating;
  
  await db.update(gameStats)
    .set({ 
      wins: winnerWins, 
      winStreak: winnerWinStreak, 
      bestStreak: winnerBestStreak, 
      winRate: winnerWinRate,
      eloRating: winnerNewElo,
      rankScore: winnerNewElo
    })
    .where(and(eq(gameStats.discordId, winnerId), eq(gameStats.game, game)));
  
  const loserLosses = loserStats.losses + 1;
  const loserTotalGames = loserStats.wins + loserLosses;
  const loserWinRate = loserTotalGames > 0 ? (loserStats.wins / loserTotalGames) * 100 : 0;
  const loserNewElo = eloAffected ? Math.max(100, loserStats.eloRating - eloChange) : loserStats.eloRating;
  
  await db.update(gameStats)
    .set({ 
      losses: loserLosses, 
      winStreak: 0, 
      winRate: loserWinRate,
      eloRating: loserNewElo,
      rankScore: loserNewElo
    })
    .where(and(eq(gameStats.discordId, loserId), eq(gameStats.game, game)));
  
  if (winnerPlayer) {
    await db.update(players)
      .set({ totalWins: winnerPlayer.totalWins + 1 })
      .where(eq(players.discordId, winnerId));
  }
  if (loserPlayer) {
    await db.update(players)
      .set({ totalLosses: loserPlayer.totalLosses + 1 })
      .where(eq(players.discordId, loserId));
  }
  
  await db.insert(matchHistory).values({
    gameType: game,
    player1Id: winnerId,
    player2Id: loserId,
    player1Name: winnerName || winnerPlayer?.displayName || winnerPlayer?.username,
    player2Name: loserName || loserPlayer?.displayName || loserPlayer?.username,
    winnerId: winnerId,
    result: "win",
    player1EloChange: eloAffected ? eloChange : 0,
    player2EloChange: eloAffected ? -eloChange : 0,
    duration: duration,
  });
  
  await updateDailyStreak(winnerId);
  await updateDailyStreak(loserId);
  
  const coinsEarned = await awardWinCoins(winnerId);
  
  return { winnerChange: eloChange, loserChange: -eloChange, coinsEarned, eloAffected, dailyGamesCount: dailyGamesCount + 1 };
}

export async function getMatchHistory(discordId: string, limit: number = 5) {
  const matches = await db.query.matchHistory.findMany({
    where: or(
      eq(matchHistory.player1Id, discordId),
      eq(matchHistory.player2Id, discordId)
    ),
    orderBy: desc(matchHistory.completedAt),
    limit: limit,
  });
  
  return matches.map(match => {
    const isPlayer1 = match.player1Id === discordId;
    const isWinner = match.winnerId === discordId;
    const opponentName = isPlayer1 ? match.player2Name : match.player1Name;
    const eloChange = isPlayer1 ? match.player1EloChange : match.player2EloChange;
    
    return {
      gameType: match.gameType,
      opponentName: opponentName || "Unknown",
      result: isWinner ? "win" : "loss",
      eloChange: eloChange || 0,
      completedAt: match.completedAt,
    };
  });
}

export async function recordGameResult(
  discordId: string,
  game: string,
  result: "win" | "loss" | "draw"
): Promise<number> {
  const stats = await getOrCreateGameStats(discordId, game);
  const player = await getPlayer(discordId);
  
  let wins = stats.wins;
  let losses = stats.losses;
  let draws = stats.draws;
  let winStreak = stats.winStreak;
  let bestStreak = stats.bestStreak;
  
  if (result === "win") {
    wins++;
    winStreak++;
    bestStreak = Math.max(bestStreak, winStreak);
  } else if (result === "loss") {
    losses++;
    winStreak = 0;
  } else {
    draws++;
  }
  
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
  const rankScore = (wins * 10) + winRate;
  
  await db.update(gameStats)
    .set({ wins, losses, draws, winStreak, bestStreak, winRate, rankScore })
    .where(and(eq(gameStats.discordId, discordId), eq(gameStats.game, game)));
  
  if (player && result !== "draw") {
    await db.update(players)
      .set({
        totalWins: result === "win" ? player.totalWins + 1 : player.totalWins,
        totalLosses: result === "loss" ? player.totalLosses + 1 : player.totalLosses,
      })
      .where(eq(players.discordId, discordId));
  }
  
  await updateDailyStreak(discordId);
  
  let coinsEarned = 0;
  if (result === "win") {
    coinsEarned = await awardWinCoins(discordId);
  }
  
  return coinsEarned;
}

const PVP_GAMES = ["tictactoe", "connect4", "wordduel"];

const BOT_PLAYER_ID = "BOT_PLAY_123456789";

export async function getLeaderboard(game: string, limit = 10): Promise<GameStat[]> {
  const isPvP = PVP_GAMES.includes(game);
  const minGames = isPvP ? 5 : 0;
  
  return db.query.gameStats.findMany({
    where: isPvP 
      ? and(
          eq(gameStats.game, game), 
          sql`${gameStats.wins} + ${gameStats.losses} >= ${minGames}`,
          sql`${gameStats.discordId} != ${BOT_PLAYER_ID}`
        )
      : and(eq(gameStats.game, game), sql`${gameStats.discordId} != ${BOT_PLAYER_ID}`),
    orderBy: isPvP 
      ? [desc(gameStats.eloRating), desc(gameStats.wins)]
      : [desc(gameStats.wins), desc(gameStats.winRate)],
    limit,
  });
}

export async function getDailyGamesCount(player1Id: string, player2Id: string, gameType: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const matches = await db.query.matchHistory.findMany({
    where: and(
      eq(matchHistory.gameType, gameType),
      or(
        and(eq(matchHistory.player1Id, player1Id), eq(matchHistory.player2Id, player2Id)),
        and(eq(matchHistory.player1Id, player2Id), eq(matchHistory.player2Id, player1Id))
      ),
      gt(matchHistory.completedAt, startOfDay)
    ),
  });
  
  return matches.length;
}

export async function shouldAffectElo(player1Id: string, player2Id: string, gameType: string): Promise<{ affects: boolean; gamesPlayed: number }> {
  const gamesPlayed = await getDailyGamesCount(player1Id, player2Id, gameType);
  return { affects: gamesPlayed < 3, gamesPlayed };
}

export async function getPlayerRank(discordId: string, game: string): Promise<number> {
  const stats = await getOrCreateGameStats(discordId, game);
  const isPvP = PVP_GAMES.includes(game);
  
  if (isPvP) {
    const result = await db.execute(sql`
      SELECT COUNT(*) + 1 as rank FROM game_stats 
      WHERE game = ${game} 
      AND elo_rating > ${stats.eloRating}
    `);
    return Number((result.rows[0] as any)?.rank || 0);
  } else {
    const result = await db.execute(sql`
      SELECT COUNT(*) + 1 as rank FROM game_stats 
      WHERE game = ${game} 
      AND wins > ${stats.wins}
    `);
    return Number((result.rows[0] as any)?.rank || 0);
  }
}

export async function createActiveGame(
  gameType: string,
  player1Id: string,
  channelId: string,
  state: Record<string, any>,
  player2Id?: string,
  player2ChannelId?: string
): Promise<ActiveGame> {
  const [game] = await db.insert(activeGames)
    .values({
      gameType,
      player1Id,
      player2Id: player2Id || null,
      channelId,
      player2ChannelId: player2ChannelId || null,
      currentTurn: player1Id,
      state,
    })
    .returning();
  return game;
}

export async function getActiveGame(discordId: string): Promise<ActiveGame | undefined> {
  return db.query.activeGames.findFirst({
    where: or(
      eq(activeGames.player1Id, discordId),
      eq(activeGames.player2Id, discordId)
    ),
  });
}

export async function getActiveGameById(gameId: string): Promise<ActiveGame | undefined> {
  return db.query.activeGames.findFirst({
    where: eq(activeGames.id, gameId),
  });
}

export async function updateGameState(gameId: string, state: Record<string, any>, currentTurn?: string): Promise<void> {
  await db.update(activeGames)
    .set({ state, currentTurn, lastAction: new Date() })
    .where(eq(activeGames.id, gameId));
}

export async function updateGameMessageIds(gameId: string, player1MessageId: string, player2MessageId?: string): Promise<void> {
  await db.update(activeGames)
    .set({ player1MessageId, player2MessageId: player2MessageId || null })
    .where(eq(activeGames.id, gameId));
}

export async function endGame(gameId: string): Promise<void> {
  await db.delete(activeGames).where(eq(activeGames.id, gameId));
}

export async function getAllActiveGames(): Promise<ActiveGame[]> {
  return db.query.activeGames.findMany();
}

export async function addToQueue(discordId: string, gameType: string, channelId: string): Promise<void> {
  const stats = await getOrCreateGameStats(discordId, gameType);
  await db.insert(matchmakingQueue)
    .values({ discordId, gameType, channelId, rankScore: stats.rankScore });
}

export async function removeFromQueue(discordId: string): Promise<void> {
  await db.delete(matchmakingQueue).where(eq(matchmakingQueue.discordId, discordId));
}

export async function findMatch(discordId: string, gameType: string, rankRange: number): Promise<{discordId: string, channelId: string} | null> {
  const playerStats = await getOrCreateGameStats(discordId, gameType);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  const recentOpps = await db.query.recentOpponents.findMany({
    where: and(
      or(eq(recentOpponents.player1Id, discordId), eq(recentOpponents.player2Id, discordId)),
      eq(recentOpponents.gameType, gameType),
      gt(recentOpponents.matchedAt, fiveMinutesAgo)
    ),
  });
  
  const blockedIds = recentOpps.map(r => r.player1Id === discordId ? r.player2Id : r.player1Id);
  blockedIds.push(discordId);
  
  const candidates = await db.query.matchmakingQueue.findMany({
    where: and(
      eq(matchmakingQueue.gameType, gameType),
      sql`${matchmakingQueue.discordId} NOT IN (${sql.join(blockedIds.map(id => sql`${id}`), sql`, `)})`
    ),
    orderBy: asc(matchmakingQueue.queuedAt),
  });
  
  for (const candidate of candidates) {
    if (Math.abs(candidate.rankScore - playerStats.rankScore) <= rankRange) {
      const existingGame = await getActiveGame(candidate.discordId);
      if (existingGame) {
        await removeFromQueue(candidate.discordId);
        continue;
      }
      return { discordId: candidate.discordId, channelId: candidate.channelId };
    }
  }
  
  return null;
}

export async function recordRecentOpponent(player1Id: string, player2Id: string, gameType: string): Promise<void> {
  await db.insert(recentOpponents).values({ player1Id, player2Id, gameType });
}

export async function createChallenge(challengerId: string, challengedId: string, gameType: string, channelId: string, guildId?: string): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  await db.delete(pendingChallenges).where(
    sql`${pendingChallenges.createdAt} < ${fiveMinutesAgo}`
  );
  await db.insert(pendingChallenges).values({ challengerId, challengedId, gameType, channelId, guildId });
}

export async function getChallenge(challengedId: string, challengerId?: string, gameType?: string) {
  const conditions = [eq(pendingChallenges.challengedId, challengedId)];
  if (challengerId) conditions.push(eq(pendingChallenges.challengerId, challengerId));
  if (gameType) conditions.push(eq(pendingChallenges.gameType, gameType));
  
  return db.query.pendingChallenges.findFirst({
    where: and(...conditions),
  });
}

export async function getAllChallengesForUser(challengedId: string) {
  return db.query.pendingChallenges.findMany({
    where: eq(pendingChallenges.challengedId, challengedId),
    orderBy: [desc(pendingChallenges.createdAt)],
  });
}

export async function removeChallenge(id: number): Promise<void> {
  await db.delete(pendingChallenges).where(eq(pendingChallenges.id, id));
}

export async function recordForfeit(discordId: string): Promise<boolean> {
  const player = await getPlayer(discordId);
  if (!player) return false;
  
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  let forfeitCount = player.forfeitCount;
  if (player.lastForfeitTime && new Date(player.lastForfeitTime) < tenMinutesAgo) {
    forfeitCount = 0;
  }
  forfeitCount++;
  
  const shouldLock = forfeitCount >= 3;
  
  await db.update(players)
    .set({
      forfeitCount,
      lastForfeitTime: now,
      queueLockedUntil: shouldLock ? new Date(now.getTime() + 5 * 60 * 1000) : player.queueLockedUntil,
    })
    .where(eq(players.discordId, discordId));
  
  return shouldLock;
}

export async function isQueueLocked(discordId: string): Promise<boolean> {
  const player = await getPlayer(discordId);
  if (!player || !player.queueLockedUntil) return false;
  return new Date(player.queueLockedUntil) > new Date();
}

export async function getShopItems(category?: string, game?: string): Promise<ShopItem[]> {
  let query = db.query.shopItems.findMany({
    where: eq(shopItems.active, true),
    orderBy: desc(shopItems.createdAt),
  });
  
  const items = await query;
  return items.filter(item => {
    if (category && item.category !== category) return false;
    if (game && item.game !== game) return false;
    return true;
  });
}

export async function getShopItem(itemId: number): Promise<ShopItem | undefined> {
  return db.query.shopItems.findFirst({
    where: eq(shopItems.id, itemId),
  });
}

export async function getUserInventory(discordId: string) {
  const items = await db.query.userInventory.findMany({
    where: eq(userInventory.discordId, discordId),
  });
  
  const itemDetails = await Promise.all(
    items.map(async (inv) => {
      const item = await getShopItem(inv.itemId);
      return { ...inv, item };
    })
  );
  
  return itemDetails;
}

export async function ownsItem(discordId: string, itemId: number): Promise<boolean> {
  const item = await db.query.userInventory.findFirst({
    where: and(eq(userInventory.discordId, discordId), eq(userInventory.itemId, itemId)),
  });
  return !!item;
}

export async function purchaseItem(discordId: string, itemId: number): Promise<{ success: boolean; error?: string }> {
  const player = await getPlayer(discordId);
  if (!player) return { success: false, error: "Player not found" };
  
  if (player.coins < 0) return { success: false, error: "Your balance is negative. Cannot purchase items." };
  
  const item = await getShopItem(itemId);
  if (!item) return { success: false, error: "Item not found" };
  
  if (await ownsItem(discordId, itemId)) {
    return { success: false, error: "You already own this item" };
  }
  
  if (player.coins < item.price) {
    return { success: false, error: `Not enough coins. You need ${item.price - player.coins} more coins.` };
  }
  
  await db.update(players)
    .set({ coins: player.coins - item.price })
    .where(eq(players.discordId, discordId));
  
  await db.insert(userInventory).values({ discordId, itemId });
  
  await equipItem(discordId, itemId);
  
  return { success: true };
}

export async function equipItem(discordId: string, itemId: number): Promise<boolean> {
  const item = await getShopItem(itemId);
  if (!item) return false;
  
  if (!await ownsItem(discordId, itemId)) return false;
  
  const updateField: Record<string, number> = {};
  if (item.itemType === "badge") updateField.equippedBadge = itemId;
  else if (item.itemType === "title") updateField.equippedTitle = itemId;
  else if (item.itemType === "frame") updateField.equippedFrame = itemId;
  else if (item.itemType === "skin" && item.game) {
    await db.update(gameStats)
      .set({ equippedSkin: itemId })
      .where(and(eq(gameStats.discordId, discordId), eq(gameStats.game, item.game)));
    return true;
  }
  
  if (Object.keys(updateField).length > 0) {
    await db.update(players).set(updateField).where(eq(players.discordId, discordId));
  }
  
  return true;
}

export async function unequipItem(discordId: string, itemType: string, game?: string): Promise<boolean> {
  if (itemType === "badge") {
    await db.update(players).set({ equippedBadge: null }).where(eq(players.discordId, discordId));
  } else if (itemType === "title") {
    await db.update(players).set({ equippedTitle: null }).where(eq(players.discordId, discordId));
  } else if (itemType === "frame") {
    await db.update(players).set({ equippedFrame: null }).where(eq(players.discordId, discordId));
  } else if (itemType === "skin" && game) {
    await db.update(gameStats)
      .set({ equippedSkin: null })
      .where(and(eq(gameStats.discordId, discordId), eq(gameStats.game, game)));
  }
  return true;
}

export async function seedShopItems(): Promise<void> {
  const existingItems = await db.query.shopItems.findMany();
  if (existingItems.length > 0) return;
  
  const items: Array<{name: string, emoji: string, price: number, category: string, itemType: string, game?: string, description: string}> = [
    { name: "Crown", emoji: "👑", price: 500, category: "badges", itemType: "badge", description: "A royal crown badge" },
    { name: "Star", emoji: "⭐", price: 300, category: "badges", itemType: "badge", description: "A shining star badge" },
    { name: "Fire", emoji: "🔥", price: 400, category: "badges", itemType: "badge", description: "A fiery badge" },
    { name: "Diamond", emoji: "💎", price: 750, category: "badges", itemType: "badge", description: "A precious diamond badge" },
    { name: "Lightning", emoji: "⚡", price: 350, category: "badges", itemType: "badge", description: "An electrifying badge" },
    { name: "Trophy", emoji: "🏆", price: 600, category: "badges", itemType: "badge", description: "A champion trophy badge" },
    { name: "Rocket", emoji: "🚀", price: 450, category: "badges", itemType: "badge", description: "A rocket badge" },
    { name: "Champion", emoji: "", price: 1000, category: "titles", itemType: "title", description: "The Champion title" },
    { name: "Legend", emoji: "", price: 1500, category: "titles", itemType: "title", description: "The Legend title" },
    { name: "Master", emoji: "", price: 800, category: "titles", itemType: "title", description: "The Master title" },
    { name: "Warrior", emoji: "", price: 600, category: "titles", itemType: "title", description: "The Warrior title" },
    { name: "Prodigy", emoji: "", price: 900, category: "titles", itemType: "title", description: "The Prodigy title" },
    { name: "Veteran", emoji: "", price: 700, category: "titles", itemType: "title", description: "The Veteran title" },
    { name: "Gold Frame", emoji: "🟨", price: 400, category: "frames", itemType: "frame", description: "A golden frame" },
    { name: "Purple Frame", emoji: "🟪", price: 350, category: "frames", itemType: "frame", description: "A purple frame" },
    { name: "Blue Frame", emoji: "🟦", price: 300, category: "frames", itemType: "frame", description: "A blue frame" },
    { name: "Red Frame", emoji: "🟥", price: 300, category: "frames", itemType: "frame", description: "A red frame" },
    { name: "Green Frame", emoji: "🟩", price: 300, category: "frames", itemType: "frame", description: "A green frame" },
    { name: "Rainbow Frame", emoji: "🌈", price: 800, category: "frames", itemType: "frame", description: "A rainbow frame" },
    { name: "Blue Pieces", emoji: "🔵", price: 200, category: "connect4", itemType: "skin", game: "connect4", description: "Blue piece skin" },
    { name: "Green Pieces", emoji: "🟢", price: 200, category: "connect4", itemType: "skin", game: "connect4", description: "Green piece skin" },
    { name: "Purple Pieces", emoji: "🟣", price: 250, category: "connect4", itemType: "skin", game: "connect4", description: "Purple piece skin" },
    { name: "X Style", emoji: "❌", price: 150, category: "tictactoe", itemType: "skin", game: "tictactoe", description: "Custom X marker" },
    { name: "O Style", emoji: "⭕", price: 150, category: "tictactoe", itemType: "skin", game: "tictactoe", description: "Custom O marker" },
  ];
  
  for (const item of items) {
    await db.insert(shopItems).values(item);
  }
}

export async function getStaffRole(discordId: string): Promise<StaffRole> {
  if (isOwner(discordId)) return "owner";
  
  const player = await getPlayer(discordId);
  if (!player || !player.staffRole) return null;
  return player.staffRole as StaffRole;
}

export async function setStaffRole(discordId: string, role: StaffRole): Promise<boolean> {
  if (isOwner(discordId)) return false;
  
  await db.update(players)
    .set({ staffRole: role })
    .where(eq(players.discordId, discordId));
  return true;
}

export async function getAllStaff(): Promise<Array<{ player: Player; role: StaffRole }>> {
  const staffPlayers = await db.query.players.findMany({
    where: sql`${players.staffRole} IS NOT NULL`,
  });
  
  const result: Array<{ player: Player; role: StaffRole }> = [];
  
  let owner = await db.query.players.findFirst({
    where: eq(players.discordId, OWNER_DISCORD_ID),
  });
  
  if (owner) {
    result.push({ player: owner, role: "owner" });
  } else {
    const ownerPlaceholder: Player = {
      id: 0,
      discordId: OWNER_DISCORD_ID,
      username: "6oa4",
      displayName: "Spit",
      coins: 0,
      coinsEarnedToday: 0,
      lastCoinReset: null,
      totalWins: 0,
      totalLosses: 0,
      dailyStreak: 0,
      lastPlayedDate: null,
      equippedBadge: null,
      equippedTitle: null,
      equippedFrame: null,
      forfeitCount: 0,
      lastForfeitTime: null,
      queueLockedUntil: null,
      staffRole: "owner",
      createdAt: new Date(),
    };
    result.push({ player: ownerPlaceholder, role: "owner" });
  }
  
  for (const p of staffPlayers) {
    if (p.discordId !== OWNER_DISCORD_ID && p.staffRole) {
      result.push({ player: p, role: p.staffRole as StaffRole });
    }
  }
  
  result.sort((a, b) => getStaffLevel(b.role) - getStaffLevel(a.role));
  return result;
}

export async function resetPlayerStats(discordId: string, game?: string): Promise<boolean> {
  if (game) {
    await db.delete(gameStats)
      .where(and(eq(gameStats.discordId, discordId), eq(gameStats.game, game)));
    await db.delete(matchHistory)
      .where(and(eq(matchHistory.player1Id, discordId), eq(matchHistory.gameType, game)));
    await db.delete(matchHistory)
      .where(and(eq(matchHistory.player2Id, discordId), eq(matchHistory.gameType, game)));
  } else {
    await db.delete(gameStats).where(eq(gameStats.discordId, discordId));
    await db.delete(matchHistory).where(eq(matchHistory.player1Id, discordId));
    await db.delete(matchHistory).where(eq(matchHistory.player2Id, discordId));
    await db.update(players)
      .set({ 
        coins: 0, 
        coinsEarnedToday: 0, 
        totalWins: 0, 
        totalLosses: 0,
        dailyStreak: 0
      })
      .where(eq(players.discordId, discordId));
  }
  return true;
}

export async function resetGameLeaderboard(game: string): Promise<number> {
  const result = await db.delete(gameStats).where(eq(gameStats.game, game));
  await db.delete(matchHistory).where(eq(matchHistory.gameType, game));
  return result.rowCount || 0;
}

const DEFAULT_EMOJIS: Record<string, string> = {
  win: "🏆",
  loss: "💀",
  elo: "⭐",
  winrate: "📈",
  coin: "🪙",
  streak: "🔥",
  daily: "📅",
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  diamond: "💎",
  champion: "👑",
  owner: "👑",
  admin: "⚔️",
  mod: "🛡️",
  support: "💬",
  correct: "✅",
  wrongspot: "🟡",
  notinword: "❌",
};

let emojiCache: Record<string, string> | null = null;

export async function loadEmojis(): Promise<Record<string, string>> {
  if (emojiCache) return emojiCache;
  
  const customEmojiList = await db.query.customEmojis.findMany();
  const emojis = { ...DEFAULT_EMOJIS };
  
  for (const custom of customEmojiList) {
    emojis[custom.emojiType] = custom.emoji;
  }
  
  emojiCache = emojis;
  return emojis;
}

export function getEmoji(type: string): string {
  if (emojiCache && emojiCache[type]) return emojiCache[type];
  return DEFAULT_EMOJIS[type] || "❓";
}

export async function setCustomEmoji(type: string, emoji: string): Promise<boolean> {
  if (!DEFAULT_EMOJIS[type]) return false;
  
  await db.insert(customEmojis)
    .values({ emojiType: type, emoji })
    .onConflictDoUpdate({
      target: customEmojis.emojiType,
      set: { emoji, updatedAt: new Date() },
    });
  
  emojiCache = null;
  await loadEmojis();
  return true;
}

export async function resetCustomEmoji(type: string): Promise<boolean> {
  if (!DEFAULT_EMOJIS[type]) return false;
  
  await db.delete(customEmojis).where(eq(customEmojis.emojiType, type));
  
  emojiCache = null;
  await loadEmojis();
  return true;
}

export async function getAllEmojis(): Promise<Record<string, { current: string; default: string }>> {
  const emojis = await loadEmojis();
  const result: Record<string, { current: string; default: string }> = {};
  
  for (const [type, defaultEmoji] of Object.entries(DEFAULT_EMOJIS)) {
    result[type] = {
      current: emojis[type] || defaultEmoji,
      default: defaultEmoji,
    };
  }
  
  return result;
}

export function getDefaultEmojis(): Record<string, string> {
  return { ...DEFAULT_EMOJIS };
}

export async function resetEntireBot(): Promise<{ players: number; games: number; matches: number }> {
  const matchCount = await db.delete(matchHistory);
  const gameStatsCount = await db.delete(gameStats);
  await db.delete(activeGames);
  await db.delete(matchmakingQueue);
  await db.delete(pendingChallenges);
  await db.delete(recentOpponents);
  await db.delete(userInventory);
  
  const playerCount = await db.update(players).set({
    coins: 0,
    coinsEarnedToday: 0,
    totalWins: 0,
    totalLosses: 0,
    dailyStreak: 0,
    lastPlayedDate: null,
    equippedBadge: null,
    equippedTitle: null,
    equippedFrame: null,
    forfeitCount: 0,
    lastForfeitTime: null,
    queueLockedUntil: null,
  });
  
  return {
    players: playerCount.rowCount || 0,
    games: gameStatsCount.rowCount || 0,
    matches: matchCount.rowCount || 0,
  };
}

export async function cleanExpiredQueues(maxAgeMinutes: number = 5): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const result = await db.delete(matchmakingQueue).where(sql`${matchmakingQueue.queuedAt} < ${cutoff}`);
  return result.rowCount || 0;
}
