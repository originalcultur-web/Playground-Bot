import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export interface NumberGuessState {
  playerId: string;
  targetNumber: number;
  minRange: number;
  maxRange: number;
  guesses: number[];
  maxGuesses: number;
  startTime: number;
}

export function createGameState(playerId: string): NumberGuessState {
  const min = 1;
  const max = 100;
  const target = Math.floor(Math.random() * (max - min + 1)) + min;
  
  return {
    playerId,
    targetNumber: target,
    minRange: min,
    maxRange: max,
    guesses: [],
    maxGuesses: 7,
    startTime: Date.now()
  };
}

export function makeGuess(state: NumberGuessState, guess: number): {
  valid: boolean;
  result?: "correct" | "higher" | "lower";
  gameOver?: boolean;
  won?: boolean;
} {
  if (guess < state.minRange || guess > state.maxRange) {
    return { valid: false };
  }
  
  if (state.guesses.includes(guess)) {
    return { valid: false };
  }
  
  state.guesses.push(guess);
  
  if (guess === state.targetNumber) {
    return { valid: true, result: "correct", gameOver: true, won: true };
  }
  
  if (state.guesses.length >= state.maxGuesses) {
    return { valid: true, result: guess < state.targetNumber ? "higher" : "lower", gameOver: true, won: false };
  }
  
  if (guess < state.targetNumber) {
    state.minRange = Math.max(state.minRange, guess + 1);
    return { valid: true, result: "higher" };
  } else {
    state.maxRange = Math.min(state.maxRange, guess - 1);
    return { valid: true, result: "lower" };
  }
}

export function createNumberGuessEmbed(state: NumberGuessState, lastResult?: string, isGameOver = false, won = false): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🔢 NUMBER GUESS")
    .setColor(0x5865F2);
  
  if (isGameOver) {
    if (won) {
      const time = Math.floor((Date.now() - state.startTime) / 1000);
      embed.setDescription(
        `🎉 Correct! The number was **${state.targetNumber}**!\n\n` +
        `Guesses: **${state.guesses.length}**\n` +
        `Time: **${time}s**`
      );
      embed.setColor(0x57F287);
    } else {
      embed.setDescription(
        `Game over! The number was **${state.targetNumber}**\n\n` +
        `You used all ${state.maxGuesses} guesses.`
      );
      embed.setColor(0xED4245);
    }
  } else {
    let resultText = "";
    if (lastResult === "higher") {
      resultText = `📈 **Go higher!**\n\n`;
    } else if (lastResult === "lower") {
      resultText = `📉 **Go lower!**\n\n`;
    }
    
    const guessHistory = state.guesses.length > 0 
      ? `Previous guesses: ${state.guesses.join(", ")}\n\n` 
      : "";
    
    embed.setDescription(
      `Guess the number between **${state.minRange}** and **${state.maxRange}**!\n\n` +
      resultText +
      guessHistory +
      `Type a number to guess!`
    );
    embed.setFooter({ text: `Guesses: ${state.guesses.length}/${state.maxGuesses}` });
  }
  
  return embed;
}

export function createNumberGuessButtons(gameId: string, disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`ng_quit_${gameId}`)
        .setLabel("Give Up")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    );
  return [row];
}
