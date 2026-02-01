import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export interface MemoryMatchState {
  playerId: string;
  grid: string[];
  revealed: boolean[];
  matched: boolean[];
  firstPick: number | null;
  moves: number;
  pairs: number;
  totalPairs: number;
  startTime: number;
}

const EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🍒", "🥝"];

export function createGameState(playerId: string): MemoryMatchState {
  const pairs = 6;
  const selectedEmojis = EMOJIS.slice(0, pairs);
  const cards = [...selectedEmojis, ...selectedEmojis];
  
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  
  return {
    playerId,
    grid: cards,
    revealed: new Array(cards.length).fill(false),
    matched: new Array(cards.length).fill(false),
    firstPick: null,
    moves: 0,
    pairs: 0,
    totalPairs: pairs,
    startTime: Date.now()
  };
}

export function flipCard(state: MemoryMatchState, index: number): {
  success: boolean;
  needsReset?: boolean;
  isMatch?: boolean;
  gameOver?: boolean;
} {
  if (index < 0 || index >= state.grid.length) {
    return { success: false };
  }
  
  if (state.matched[index] || state.revealed[index]) {
    return { success: false };
  }
  
  state.revealed[index] = true;
  
  if (state.firstPick === null) {
    state.firstPick = index;
    return { success: true };
  }
  
  state.moves++;
  const firstIndex = state.firstPick;
  const isMatch = state.grid[firstIndex] === state.grid[index];
  
  if (isMatch) {
    state.matched[firstIndex] = true;
    state.matched[index] = true;
    state.pairs++;
    state.firstPick = null;
    
    const gameOver = state.pairs === state.totalPairs;
    return { success: true, isMatch: true, gameOver };
  }
  
  return { success: true, needsReset: true };
}

export function resetRevealed(state: MemoryMatchState): void {
  for (let i = 0; i < state.revealed.length; i++) {
    if (!state.matched[i]) {
      state.revealed[i] = false;
    }
  }
  state.firstPick = null;
}

export function createMemoryMatchEmbed(state: MemoryMatchState, isGameOver = false): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🧠 MEMORY MATCH")
    .setColor(0x5865F2);
  
  if (isGameOver) {
    const time = Math.floor((Date.now() - state.startTime) / 1000);
    embed.setDescription(
      `🎉 You matched all pairs!\n\n` +
      `Moves: **${state.moves}**\n` +
      `Time: **${time}s**`
    );
    embed.setColor(0x57F287);
  } else {
    embed.setDescription(
      `Match the pairs by clicking the cards!\n\n` +
      `Pairs found: **${state.pairs}/${state.totalPairs}**\n` +
      `Moves: **${state.moves}**`
    );
  }
  
  return embed;
}

export function createMemoryMatchButtons(gameId: string, state: MemoryMatchState, disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const cols = 4;
  const cardRows = Math.ceil(state.grid.length / cols);
  
  for (let row = 0; row < cardRows; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (index >= state.grid.length) break;
      
      const isRevealed = state.revealed[index];
      const isMatched = state.matched[index];
      const label = (isRevealed || isMatched) ? state.grid[index] : "❓";
      
      let style = ButtonStyle.Secondary;
      if (isMatched) style = ButtonStyle.Success;
      else if (isRevealed) style = ButtonStyle.Primary;
      
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`mm_${gameId}_${index}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled || isMatched)
      );
    }
    rows.push(actionRow);
  }
  
  return rows;
}
