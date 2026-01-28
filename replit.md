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
- **Minesweeper** - 5x5 grid with interactive buttons
- **Wordle** - 6 attempts to guess 5-letter word

## Commands

### Game Commands
- `,connect4` / `,c4` - Queue for Connect 4 or challenge @user
- `,tictactoe` / `,ttt` - Queue for Tic Tac Toe or challenge @user
- `,wordduel` / `,wd` - Queue for Word Duel or challenge @user
- `,minesweeper` / `,ms` - Start solo Minesweeper
- `,wordle` / `,w` - Start solo Wordle

### Gameplay Commands
- `,quit` / `,q` - Forfeit current game or leave queue
- `,accept` - Accept a challenge
- **Tic Tac Toe & Connect 4** - Click buttons to play
- **Minesweeper** - Click cells to reveal, toggle flag mode
- **Wordle & Word Duel** - Type your answers

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

### PvP Games (Connect 4, Tic Tac Toe, Word Duel)
- **Elo Rating System** - Start at 1000, adjust based on opponent's rating
- Beat stronger opponents = gain more points
- Leaderboards sorted by Elo rating
- Rating change shown after each match (+N ⭐)

### Solo Games (Minesweeper, Wordle)
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
- **matchHistory** - PvP match records with Elo changes
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

- **Match History** - Profile now shows last 5 matches with opponent, result, and Elo change
- **Rematch Button** - PvP games now show a rematch button after game ends
- **Enhanced Profile** - Shows Elo ratings per game, win streaks, and equipped cosmetics
- **Wordle Dictionary** - 800+ valid English words with validation
- **Elo Rating System** - PvP games now use Elo-based ranking
- Rating changes displayed after matches (+N ⭐)
- Leaderboard display updated with emoji icons and compact format
- Leaderboard cache clears after games for instant updates
- Cross-server matchmaking - players from different servers can be matched together
- Player names show as **DisplayName** (*@username*) format
- Flag mode toggle button added to Minesweeper
