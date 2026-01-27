# Playground Discord Bot

A competitive multiplayer gaming Discord bot with global leaderboards and a cosmetic shop.

## Overview

Playground offers competitive PvP and solo games with a text-based UI, coin economy, and cosmetic customization.

## Games

### PvP Ranked Games
- **Connect 4** - Classic 4-in-a-row game (30s per turn)
- **Tic Tac Toe** - Best of 3 ranked matches
- **Word Duel** - 5 scrambled words, first to unscramble wins point
- **Chess** - Full chess with algebraic notation moves

### Solo Leaderboard Games
- **Minesweeper** - 9x9 grid with 10 mines
- **Wordle** - 6 attempts to guess 5-letter word

## Commands

### Game Commands
- `,connect4` / `,c4` - Queue for Connect 4 or challenge @user
- `,tictactoe` / `,ttt` - Queue for Tic Tac Toe or challenge @user
- `,wordduel` / `,wd` - Queue for Word Duel or challenge @user
- `,chess` - Queue for Chess or challenge @user
- `,minesweeper` / `,ms` - Start solo Minesweeper
- `,wordle` / `,w` - Start solo Wordle

### Gameplay Commands
- `,quit` / `,q` - Forfeit current game or leave queue
- `,accept` - Accept a challenge
- `,reveal A1` / `,r A1` - Reveal cell in Minesweeper
- `,flag A1` / `,f A1` - Toggle flag in Minesweeper

### Profile & Stats
- `,profile` / `,p` - View your profile
- `,profile @user` - View someone's profile
- `,leaderboard <game>` / `,lb <game>` - View game leaderboard

### Shop & Inventory
- `,shop` - Browse the shop
- `,shop <category>` - Browse specific category
- `,buy <number>` - Purchase an item
- `,inventory` / `,inv` - View your inventory
- `,equip <number>` - Equip an item
- `,unequip <type>` - Unequip an item

## Economy System

- **Coins** - Single in-app currency
- Earn 5 coins per ranked win (50 daily cap)
- Spend coins in the shop

## Ranking System

- Minimum 20 ranked games to appear on leaderboard
- Rank Score = (wins × 10) + win_rate
- Global leaderboards per game

## Project Structure

```
src/
├── index.ts          # Main bot entry point
├── games/
│   ├── connect4.ts   # Connect 4 game logic
│   ├── tictactoe.ts  # Tic Tac Toe game logic
│   ├── wordduel.ts   # Word Duel game logic
│   ├── chess.ts      # Chess game logic
│   ├── minesweeper.ts # Minesweeper game logic
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
- **shopItems** - Cosmetic items for sale
- **userInventory** - Owned items
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

## Recent Changes

- Initial bot implementation with all 6 games
- Coin economy with daily cap
- Shop and inventory system
- Global leaderboards with caching
- Anti-abuse protections
