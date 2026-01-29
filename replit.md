# Playground Discord Bot

A competitive multiplayer gaming Discord bot with global leaderboards and a cosmetic shop.

## Overview

Playground offers competitive PvP and solo games with interactive button-based UI, coin economy, and cosmetic customization.

## Games

### PvP Ranked Games
- **Connect 4** - Classic 4-in-a-row game (30s per turn)
- **Tic Tac Toe** - Single game ranked matches
- **Word Duel** - 5 scrambled words, first to unscramble wins point

### Solo Leaderboard Games
- **Wordle** - 6 attempts to guess 5-letter word

## Commands

### Game Commands
- `,connect4` / `,c4` - Queue for Connect 4 or challenge @user
- `,tictactoe` / `,ttt` - Queue for Tic Tac Toe or challenge @user
- `,wordduel` / `,wd` - Queue for Word Duel or challenge @user
- `,wordle` / `,w` - Start solo Wordle

### Gameplay Commands
- `,quit` / `,q` - Forfeit current game or leave queue
- `,accept` - Accept a challenge
- **Tic Tac Toe & Connect 4** - Click buttons to play
- **Wordle & Word Duel** - Type your answers

### Profile & Stats
- `,profile` / `,p` - View your profile
- `,profile @user` - View someone's profile
- `,leaderboard <game>` / `,lb <game>` - View game leaderboard

### Shop (Coming Soon)
- `,shop` - Preview cosmetic shop

### Staff Commands
- `,staff` - View staff team
- `,promote @user <admin/mod/support>` - Promote to staff (Admin+)
- `,demote @user` - Remove from staff (Admin+)
- `,resetplayer @user [game]` - Reset player stats (Mod+)
- `,resetgame <game>` - Reset game leaderboard (Admin+)
- `,setemoji <type> <emoji>` - Set custom emoji (Owner only)
- `,listemojis` - View all emojis (Staff only)
- `,resetemoji <type>` - Reset emoji to default (Owner only)

## Staff System

### Hierarchy (4 Tiers)
1. **👑 Owner** - Spit (permanent) - Full control, emoji customization
2. **⚔️ Admin** - Reset players/games, manage mods/support
3. **🛡️ Moderator** - Reset individual player stats
4. **💬 Support** - View player info

### Features
- Staff badges displayed on profiles
- Permission-based command access
- 19 customizable emoji types (owner only)

## Economy System

- **Coins** - Single in-app currency
- Earn 5 coins per ranked win (50 daily cap)
- Spend coins in the shop (coming soon)

## Ranking System

### PvP Games (Connect 4, Tic Tac Toe, Word Duel)
- **Elo Rating System** - Start at 1000, adjust based on opponent's rating
- Beat stronger opponents = gain more points
- Leaderboards sorted by Elo rating
- Rating change shown after each match (+N ⭐)

### Solo Games (Wordle)
- Leaderboards sorted by total wins

### Leaderboard Display
```
1. **PlayerName** (*@username*)
   ⭐ 1250  🏆 42  💀 18  📈 70%
```

## Project Structure

```
src/
├── index.ts          # Main bot entry point
├── games/
│   ├── connect4.ts   # Connect 4 game logic
│   ├── tictactoe.ts  # Tic Tac Toe game logic
│   ├── wordduel.ts   # Word Duel game logic
│   └── wordle.ts     # Wordle game logic
shared/
└── schema.ts         # Database schema (Drizzle ORM)
server/
├── db.ts             # Database connection
└── storage.ts        # Database operations
```

## Database Schema

- **players** - User profiles, coins, equipped cosmetics
- **gameStats** - Per-game statistics and rankings
- **activeGames** - Persistent game state
- **matchHistory** - PvP match records with Elo changes
- **shopItems** - Cosmetic items for sale (coming soon)
- **userInventory** - Owned items (coming soon)
- **matchmakingQueue** - Active queue entries
- **pendingChallenges** - Pending game challenges
- **recentOpponents** - Anti-farming tracking

## Discord Developer Portal Setup

**IMPORTANT**: To run this bot, you must enable these settings in the Discord Developer Portal:

1. Go to https://discord.com/developers/applications
2. Select your bot application
3. Go to **Bot** section
4. Under **Privileged Gateway Intents**, enable:
   - **MESSAGE CONTENT INTENT** (required)
   - **SERVER MEMBERS INTENT** (optional)
5. Save changes

## Running the Bot

```bash
npm run start      # Start the bot
npm run db:push    # Push database schema
```

## Deployment

This bot is configured as a **Reserved VM** deployment:
- Runs continuously 24/7 to maintain Discord connection
- No cold start delays - instant command responses
- Ideal for Discord bots that need persistent connections

## Recent Changes

- **Minesweeper Removed** - Game removed from bot
- **Shop Disabled** - Coming soon with unique cosmetic items
- **Unified Coin System** - All coin awards handled internally in storage layer
- **Daily Streak Counter** - Tracks consecutive days of play, displayed on profile
- **Rank Badge System** - 5 visual tiers displayed on PvP rankings (Bronze/Silver/Gold/Diamond/Champion)
- **Wordle Keyboard** - Shows used letters with grouped status format after each guess
- **GG Button** - Sportsmanship button appears alongside rematch after PvP games
- **Word Duel Countdown** - "3... 2... 1... GO!" animation before each round
- **Coin Animations** - Delayed celebratory coin message appears after all game wins
- **Win Emojis** - 🎉 emoji added to all win announcements
- **Match History** - Profile now shows last 5 matches with opponent, result, and Elo change
- **Rematch Button** - PvP games now show a rematch button after game ends
- **Enhanced Profile** - Shows Elo ratings per game, win streaks, and equipped cosmetics
- **Word Lists** - 5,000 unique 5-letter words for Wordle and Word Duel
- **Wordle Key Guide** - Fixed guide to correctly show ⬛ (black) for letters not in word
- **Elo Rating System** - PvP games now use Elo-based ranking
- Rating changes displayed after matches (+N ⭐)
- Leaderboard display updated with emoji icons and compact format
- Leaderboard cache clears after games for instant updates
- Cross-server matchmaking - players from different servers can be matched together
- Player names show as **DisplayName** (*@username*) format
