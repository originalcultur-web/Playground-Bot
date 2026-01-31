import { pgTable, text, integer, boolean, timestamp, jsonb, serial, real, uuid } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  coins: integer("coins").notNull().default(0),
  coinsEarnedToday: integer("coins_earned_today").notNull().default(0),
  lastCoinReset: timestamp("last_coin_reset").defaultNow(),
  totalWins: integer("total_wins").notNull().default(0),
  totalLosses: integer("total_losses").notNull().default(0),
  dailyStreak: integer("daily_streak").notNull().default(0),
  lastPlayedDate: text("last_played_date"),
  equippedBadge: integer("equipped_badge"),
  equippedTitle: integer("equipped_title"),
  equippedFrame: integer("equipped_frame"),
  forfeitCount: integer("forfeit_count").notNull().default(0),
  lastForfeitTime: timestamp("last_forfeit_time"),
  queueLockedUntil: timestamp("queue_locked_until"),
  staffRole: text("staff_role"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customEmojis = pgTable("custom_emojis", {
  id: serial("id").primaryKey(),
  emojiType: text("emoji_type").notNull().unique(),
  emoji: text("emoji").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gameStats = pgTable("game_stats", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  game: text("game").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  rankScore: real("rank_score").notNull().default(0),
  eloRating: integer("elo_rating").notNull().default(1000),
  extraStats: jsonb("extra_stats").$type<Record<string, any>>().default({}),
  equippedSkin: integer("equipped_skin"),
});

export const activeGames = pgTable("active_games", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameType: text("game_type").notNull(),
  player1Id: text("player1_id").notNull(),
  player2Id: text("player2_id"),
  channelId: text("channel_id").notNull(),
  player2ChannelId: text("player2_channel_id"),
  player1MessageId: text("player1_message_id"),
  player2MessageId: text("player2_message_id"),
  currentTurn: text("current_turn"),
  state: jsonb("state").$type<Record<string, any>>().notNull(),
  lastAction: timestamp("last_action").defaultNow().notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
});

export const matchHistory = pgTable("match_history", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull(),
  player1Id: text("player1_id").notNull(),
  player2Id: text("player2_id"),
  player1Name: text("player1_name"),
  player2Name: text("player2_name"),
  winnerId: text("winner_id"),
  result: text("result").notNull(),
  player1EloChange: integer("player1_elo_change"),
  player2EloChange: integer("player2_elo_change"),
  duration: integer("duration"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const recentOpponents = pgTable("recent_opponents", {
  id: serial("id").primaryKey(),
  player1Id: text("player1_id").notNull(),
  player2Id: text("player2_id").notNull(),
  gameType: text("game_type").notNull(),
  matchedAt: timestamp("matched_at").defaultNow().notNull(),
});

export const matchmakingQueue = pgTable("matchmaking_queue", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  gameType: text("game_type").notNull(),
  channelId: text("channel_id").notNull(),
  rankScore: real("rank_score").notNull().default(0),
  queuedAt: timestamp("queued_at").defaultNow().notNull(),
});

export const pendingChallenges = pgTable("pending_challenges", {
  id: serial("id").primaryKey(),
  challengerId: text("challenger_id").notNull(),
  challengedId: text("challenged_id").notNull(),
  gameType: text("game_type").notNull(),
  channelId: text("channel_id").notNull(),
  guildId: text("guild_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shopItems = pgTable("shop_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull(),
  itemType: text("item_type").notNull(),
  game: text("game"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userInventory = pgTable("user_inventory", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  itemId: integer("item_id").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;
export type GameStat = typeof gameStats.$inferSelect;
export type InsertGameStat = typeof gameStats.$inferInsert;
export type ActiveGame = typeof activeGames.$inferSelect;
export type InsertActiveGame = typeof activeGames.$inferInsert;
export type ShopItem = typeof shopItems.$inferSelect;
export type InsertShopItem = typeof shopItems.$inferInsert;
export type UserInventoryItem = typeof userInventory.$inferSelect;
export type CustomEmoji = typeof customEmojis.$inferSelect;
