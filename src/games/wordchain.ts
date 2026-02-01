import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export interface WordChainState {
  player1Id: string;
  player2Id: string;
  currentTurn: string;
  usedWords: string[];
  lastWord: string;
  turnStartTime: number;
  player1Name: string;
  player2Name: string;
  player1ChannelId: string;
  player2ChannelId: string;
  player1GuildId?: string;
  player2GuildId?: string;
  roundNumber: number;
}

const TURN_TIME = 15000;

const startingWords = [
  "apple", "beach", "chair", "dance", "eagle", "flame", "grape", "house",
  "image", "jelly", "knife", "lemon", "mango", "night", "olive", "piano",
  "queen", "river", "stone", "table", "ultra", "video", "water", "youth", "zebra"
];

export function initWordChainGame(
  player1Id: string, 
  player2Id: string, 
  player1Name: string, 
  player2Name: string,
  player1ChannelId: string,
  player2ChannelId: string,
  player1GuildId?: string,
  player2GuildId?: string
): WordChainState {
  const startWord = startingWords[Math.floor(Math.random() * startingWords.length)];
  return {
    player1Id,
    player2Id,
    currentTurn: player1Id,
    usedWords: [startWord],
    lastWord: startWord,
    turnStartTime: Date.now(),
    player1Name,
    player2Name,
    player1ChannelId,
    player2ChannelId,
    player1GuildId,
    player2GuildId,
    roundNumber: 1
  };
}

export function isValidWord(word: string): boolean {
  return word.length >= 2 && /^[a-z]+$/i.test(word);
}

export function isInDictionary(word: string): boolean {
  return word.length >= 3;
}

export function processWordChainMove(state: WordChainState, playerId: string, word: string): {
  valid: boolean;
  reason?: string;
  gameOver?: boolean;
  winner?: string;
  loser?: string;
} {
  word = word.toLowerCase().trim();
  
  if (playerId !== state.currentTurn) {
    return { valid: false, reason: "It's not your turn!" };
  }
  
  if (!isValidWord(word)) {
    return { valid: false, reason: "Invalid word! Use only letters (min 2 characters)." };
  }
  
  const requiredLetter = state.lastWord[state.lastWord.length - 1];
  if (word[0] !== requiredLetter) {
    return { 
      valid: false, 
      gameOver: true,
      winner: state.currentTurn === state.player1Id ? state.player2Id : state.player1Id,
      loser: state.currentTurn,
      reason: `Word must start with "${requiredLetter.toUpperCase()}"!`
    };
  }
  
  if (state.usedWords.includes(word)) {
    return { 
      valid: false, 
      gameOver: true,
      winner: state.currentTurn === state.player1Id ? state.player2Id : state.player1Id,
      loser: state.currentTurn,
      reason: `"${word}" was already used!`
    };
  }
  
  if (!isInDictionary(word)) {
    return { 
      valid: false, 
      gameOver: true,
      winner: state.currentTurn === state.player1Id ? state.player2Id : state.player1Id,
      loser: state.currentTurn,
      reason: `"${word}" is not in the dictionary!`
    };
  }
  
  state.usedWords.push(word);
  state.lastWord = word;
  state.currentTurn = state.currentTurn === state.player1Id ? state.player2Id : state.player1Id;
  state.turnStartTime = Date.now();
  state.roundNumber++;
  
  return { valid: true };
}

export function checkTimeout(state: WordChainState): {
  timedOut: boolean;
  winner?: string;
  loser?: string;
} {
  const elapsed = Date.now() - state.turnStartTime;
  if (elapsed >= TURN_TIME) {
    const loser = state.currentTurn;
    const winner = state.currentTurn === state.player1Id ? state.player2Id : state.player1Id;
    return { timedOut: true, winner, loser };
  }
  return { timedOut: false };
}

export function createWordChainEmbed(state: WordChainState, isGameOver = false, result?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🔗 WORD CHAIN")
    .setColor(0x5865F2);
  
  if (isGameOver) {
    embed.setDescription(result || "Game Over!");
    embed.setColor(0x57F287);
  } else {
    const currentPlayerName = state.currentTurn === state.player1Id ? state.player1Name : state.player2Name;
    const requiredLetter = state.lastWord[state.lastWord.length - 1].toUpperCase();
    const timeLeft = Math.max(0, Math.ceil((TURN_TIME - (Date.now() - state.turnStartTime)) / 1000));
    
    const recentWords = state.usedWords.slice(-5).join(" → ");
    
    embed.setDescription(
      `**${state.player1Name}** vs **${state.player2Name}**\n\n` +
      `Last word: **${state.lastWord.toUpperCase()}**\n\n` +
      `${currentPlayerName}, type a word starting with **${requiredLetter}**!\n\n` +
      `Chain: ${recentWords}`
    );
    embed.setFooter({ text: `Round ${state.roundNumber} | ${timeLeft}s left` });
  }
  
  return embed;
}

export function createWordChainButtons(gameId: string, disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`wc_quit_${gameId}`)
        .setLabel("Forfeit")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    );
  return [row];
}
