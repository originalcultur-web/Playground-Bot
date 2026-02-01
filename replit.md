# Playground Discord Bot

A competitive multiplayer gaming Discord bot with global leaderboards and a cosmetic shop.

## Overview

Playground offers 10 competitive games with interactive button-based UI, Elo ranking system, and cosmetic customization.

## Games

### PvP Ranked Games (Elo System)
- **Connect 4** - Classic 4-in-a-row game (30s per turn)
- **Tic Tac Toe** - Single game ranked matches
- **Word Duel** - 5 scrambled words, first to unscramble wins point
- **Rock Paper Scissors** - Best of 3 rounds
- **Trivia Duel** - 5 trivia questions, first correct answer wins round
- **Math Blitz** - 5 math problems, first correct answer wins round
- **Word Chain** - Take turns typing words starting with last letter of previous word (15s per turn)

### Solo Leaderboard Games
- **Wordle** - 6 attempts to guess 5-letter word (tracks fastest time)
- **Memory Match** - Find matching pairs by clicking hidden cards
- **Number Guess** - Guess the secret number 1-100 with higher/lower hints (7 guesses)

## Commands

### Game Commands
- `,connect4` / `,c4` - Queue for Connect 4 or challenge @user
- `,c4 play` - Instantly start Connect 4 vs Play bot (unranked)
- `,tictactoe` / `,ttt` - Queue for Tic Tac Toe or challenge @user
- `,wordduel` / `,wd` - Queue for Word Duel or challenge @user
- `,wordle` / `,w` - Start solo Wordle
- `,rps` - Queue for Rock Paper Scissors or challenge @user
- `,trivia` / `,td` - Queue for Trivia Duel or challenge @user
- `,math` / `,mb` - Queue for Math Blitz or challenge @user
- `,wordchain` / `,wc` - Queue for Word Chain or challenge @user
- `,memorymatch` / `,mm` - Start solo Memory Match
- `,numberguess` / `,ng` - Start solo Number Guess

### Gameplay Commands
- `,quit` / `,q` - Forfeit current game or leave queue
- `,accept` - Accept a challenge
- **Connect 4** - Type 1-7 or click buttons to drop pieces, Q button to quit
- **Tic Tac Toe** - Click buttons to play
- **Wordle & Word Duel** - Type your answers
- **RPS** - Click Rock, Paper, or Scissors buttons
- **Trivia/Math** - Type or click your answer
- **Word Chain** - Type words starting with last letter of previous word
- **Memory Match** - Click cards to flip and find matching pairs
- **Number Guess** - Type numbers to guess the secret number

### Profile & Stats
- `,profile` / `,p` - View your profile
- `,profile @user` - View someone's profile
- `,leaderboard <game>` / `,lb <game>` - View game leaderboard
- Leaderboard shortcuts: `,lb c4`, `,lb ttt`, `,lb wd`, `,lb w`, `,lb td`, `,lb mb`, `,lb wc`

### Shop (Coming Soon)
- `,shop` - Preview cosmetic shop

### Staff Commands (use `,staffhelp` for private list)
- `,staffhelp` - View staff commands (sent via DM)
- `,staff` - View staff team
- `,promote @user <admin/mod/support>` - Promote to staff (Admin+)
- `,demote @user` - Remove from staff (Admin+)
- `,resetplayer @user [game]` - Reset player stats (Mod+)
- `,resetgame <game>` - Reset game leaderboard (Admin+)
- `,resetbot` - Reset entire bot (Owner only, requires confirmation)
- `,setemoji <type> <emoji>` - Set custom emoji (Owner only)
- `,listemojis` - View all emojis (Staff only)
- `,resetemoji <type>` - Reset emoji to default (Owner only)

### Other Commands
- `,rules <game>` - How to play a specific game

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

- **Coins** - Single in-app currency (currently disabled until shop is ready)
- Coin rewards will be re-enabled when the shop feature launches

## Ranking System

### PvP Games (All except Wordle, Memory Match, and Number Guess)
- **Elo Rating System** - Start at 1000, adjust based on opponent's rating
- Beat stronger opponents = gain more points
- **Minimum 5 games** required to appear on leaderboard
- Leaderboards sorted by Elo rating, tiebreaker by total wins
- Rating change shown after each match (+N ⭐)
- **Anti-farming**: After 3 games/day vs same opponent, no Elo change (games still count)

### Solo Games (Wordle, Hangman)
- Wordle: Sorted by wins, then fastest completion time
- Hangman: Sorted by wins

### Leaderboard Display
```
1. **PlayerName** (*@username*)
   wins: 42  losses: 18  win rate: 70%
```

### Profile Display
```
**PlayerName** 👑 Owner
*@username*

OVERALL
wins: 3  losses: 3
streak: 1 day

PVP
Connect 4: 3W/2L · 1011 ⭐
Word Duel: 0W/1L · 984 ⭐

RECENT MATCHES
✅ Opponent (Connect 4) +14 ⭐
❌ Opponent (Word Duel) −16 ⭐
```

## Project Structure

```
src/
├── index.ts          # Main bot entry point
├── bot.ts            # Bot logic and command handling
├── games/
│   ├── connect4.ts   # Connect 4 game logic
│   ├── tictactoe.ts  # Tic Tac Toe game logic
│   ├── wordduel.ts   # Word Duel game logic
│   ├── wordle.ts     # Wordle game logic
│   ├── rps.ts        # Rock Paper Scissors game logic
│   ├── triviaduel.ts # Trivia Duel game logic
│   ├── mathblitz.ts  # Math Blitz game logic
│   ├── wordchain.ts  # Word Chain game logic
│   ├── memorymatch.ts # Memory Match game logic
│   └── numberguess.ts # Number Guess game logic
├── data/
│   └── wordlist.ts   # Word lists for word games
shared/
└── schema.ts         # Database schema (Drizzle ORM)
server/
├── db.ts             # Database connection
└── storage.ts        # Database operations
```

## Database Schema

- **players** - User profiles, coins, equipped cosmetics
- **gameStats** - Per-game statistics, Elo ratings, and extra stats (like best time)
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

- **Game Roster Update**:
  - Added Word Chain (PvP - take turns typing words starting with last letter)
  - Added Memory Match (Solo - find matching pairs with hidden cards)
  - Added Number Guess (Solo - guess secret number 1-100 with hints)
  - Removed Battleship and Hangman
- **Current Games**: Connect 4, Tic Tac Toe, Word Duel, Wordle, RPS, Trivia Duel, Math Blitz, Word Chain, Memory Match, Number Guess (10 total)
- **Wordle Fastest Time** - Tracks and displays best completion time on leaderboard
- **Bot Games Limited** - Play bot now only available for Connect 4
- **Leaderboard Shortcuts** - `,lb c4`, `,lb ttt`, `,lb wd`, `,lb w`, `,lb td`, `,lb mb`, `,lb wc`
- **Expert Bot AI** - Bot opponent Play now uses advanced AI algorithms:
  - **Connect 4**: Minimax with alpha-beta pruning (8 moves lookahead) - extremely difficult to beat
- **Bot Opponent "Play"** - After 45 seconds in queue with no match, automatically starts unranked game vs Play 🤖 (Connect 4 only)
- **Play's Profile** - Play has its own profile with 🤖 Bot badge, tracks wins/losses but no Elo rating
- **Rematch Fix** - Fixed rematch button so challenges can be accepted in the same server
- **Chip Colors** - Connect 4 now shows 🔴 Player1 vs 🟡 Player2 next to names
- **Leaderboard Ranking Overhaul** - PvP leaderboards now require 5 games to qualify, sorted by Elo with wins as tiebreaker
- **Anti-Farming Protection** - After 3 games/day vs same opponent, games don't affect Elo (players notified)
- **Leaderboard Shortcuts** - Use `,lb c4`, `,lb ttt`, `,lb wd`, `,lb w` for quick access
- **Connect 4 Text Input** - Type 1-7 to play columns, Q button to quit
- **Match Found Auto-Delete** - "Match found" messages now auto-delete after 5 seconds for both players
- **Clean Profile Format** - New clean layout with OVERALL, PVP, and RECENT MATCHES sections
- **Clean Leaderboard Format** - Simplified display with wins/losses/win rate (removed emoji icons)
- **Cross-Server Fixes** - Word Duel now properly updates both player channels when matched across servers
- **Direct Challenges Same-Server Only** - Direct @user challenges must be accepted in the same server
- **Match Found Notification** - Cross-server queue matches now notify both player channels
- **Coin Rewards Disabled** - Coin awards temporarily disabled until shop is ready
- **Shop Disabled** - Coming soon with unique cosmetic items
- **Daily Streak Counter** - Tracks consecutive days of play, displayed on profile
- **Wordle Keyboard** - Shows used letters with grouped status format after each guess
- **GG Button** - Sportsmanship button appears alongside rematch after PvP games
- **Word Duel Countdown** - "3... 2... 1... GO!" animation before each round
- **Win Emojis** - 🎉 emoji added to all win announcements
- **Match History** - Profile shows last 5 matches with opponent, result, and Elo change
- **Rematch Button** - PvP games now show a rematch button after game ends
- **Word Lists** - 3,074 common everyday 5-letter words for Wordle and Word Duel (curated for ages 13-30)
- **Wordle Key Guide** - Fixed guide to correctly show ⬛ (black) for letters not in word
- **Elo Rating System** - PvP games use Elo-based ranking with rating changes after matches
- Cross-server matchmaking - players from different servers can be matched via queue
