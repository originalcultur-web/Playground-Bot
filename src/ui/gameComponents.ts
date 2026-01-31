import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export function createTicTacToeBoard(state: any, gameId: string, disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  
  for (let row = 0; row < 3; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < 3; col++) {
      const pos = row * 3 + col;
      const cell = state.board[pos];
      
      let label = "\u200b";
      let style = ButtonStyle.Secondary;
      
      if (cell === 1) {
        label = "X";
        style = ButtonStyle.Success;
      } else if (cell === 2) {
        label = "O";
        style = ButtonStyle.Danger;
      }
      
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${gameId}_${pos}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled || cell !== 0)
      );
    }
    rows.push(actionRow);
  }
  
  return rows;
}

export function createTicTacToeEmbed(state: any, currentPlayerName: string, isGameOver = false, result?: string) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 TIC TAC TOE")
    .setColor(0x5865F2);
  
  if (state.maxRounds > 1) {
    embed.addFields({
      name: "Score",
      value: `Round ${state.currentRound}/${state.maxRounds}\n${state.roundWins[0]} - ${state.roundWins[1]}`,
      inline: true
    });
  }
  
  if (isGameOver) {
    embed.setDescription(result || "Game Over!");
    embed.setColor(0x57F287);
  } else {
    embed.setDescription(`**${currentPlayerName}**'s turn`);
  }
  
  return embed;
}

export function createConnect4Board(state: any, gameId: string, disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  for (let col = 0; col < 4; col++) {
    const colFull = state.board[0][col] !== 0;
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`c4_${gameId}_${col}`)
        .setLabel(`${col + 1}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || colFull)
    );
  }
  rows.push(row1);
  
  const row2 = new ActionRowBuilder<ButtonBuilder>();
  for (let col = 4; col < 7; col++) {
    const colFull = state.board[0][col] !== 0;
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`c4_${gameId}_${col}`)
        .setLabel(`${col + 1}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || colFull)
    );
  }
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId(`quit_${gameId}`)
      .setLabel("Q")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
  rows.push(row2);
  
  return rows;
}

export function createConnect4Display(state: any): string {
  const p1 = "🔴";
  const p2 = "🟡";
  const empty = "⚫";
  
  let display = "";
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = state.board[row][col];
      if (cell === 0) display += empty;
      else if (cell === 1) display += p1;
      else display += p2;
    }
    display += "\n";
  }
  display += "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣";
  return display;
}

export function createConnect4Embed(state: any, currentPlayerName: string, isGameOver = false, result?: string) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 CONNECT 4")
    .setDescription(createConnect4Display(state))
    .setColor(0x5865F2);
  
  if (isGameOver) {
    embed.setFooter({ text: result || "Game Over!" });
    embed.setColor(0x57F287);
  } else {
    embed.setFooter({ text: `${currentPlayerName}'s turn - Click a number to drop your piece` });
  }
  
  return embed;
}

export function createChessEmbed(state: any, currentPlayerName: string, board: string, isGameOver = false, result?: string) {
  const embed = new EmbedBuilder()
    .setTitle("♟️ CHESS")
    .setDescription("```\n" + board + "\n```")
    .setColor(0x5865F2);
  
  if (state.moveHistory.length > 0) {
    const lastMoves = state.moveHistory.slice(-5).join(", ");
    embed.addFields({ name: "Recent Moves", value: lastMoves, inline: true });
  }
  
  if (isGameOver) {
    embed.setFooter({ text: result || "Game Over!" });
    embed.setColor(0x57F287);
  } else {
    const turn = state.currentTurn === "w" ? "White" : "Black";
    embed.setFooter({ text: `${currentPlayerName} (${turn}) to move - Type your move (e.g., e4, Nf3)` });
  }
  
  return embed;
}

export function createWordleEmbed(state: any) {
  const embed = new EmbedBuilder()
    .setTitle("📝 WORDLE")
    .setColor(0x5865F2);
  
  let display = "";
  for (const guess of state.guesses) {
    const result = evaluateWordleGuess(state.targetWord, guess);
    display += result.join("") + " **" + guess.toUpperCase() + "**\n";
  }
  
  const remaining = state.maxGuesses - state.guesses.length;
  for (let i = 0; i < remaining; i++) {
    display += "⬜⬜⬜⬜⬜\n";
  }
  
  embed.setDescription(display);
  embed.addFields({ name: "Guesses", value: `${state.guesses.length}/${state.maxGuesses}`, inline: true });
  
  if (state.gameOver) {
    if (state.won) {
      const time = Math.floor((state.endTime - state.startTime) / 1000);
      embed.setFooter({ text: `🎉 You won in ${state.guesses.length} guess${state.guesses.length > 1 ? 'es' : ''}! Time: ${time}s` });
      embed.setColor(0x57F287);
    } else {
      embed.setFooter({ text: `Game over! The word was: ${state.targetWord.toUpperCase()}` });
      embed.setColor(0xED4245);
    }
  } else {
    embed.setFooter({ text: "Type a 5-letter word to guess!" });
  }
  
  return embed;
}

export function createWordDuelEmbed(state: any, isGameOver = false) {
  const embed = new EmbedBuilder()
    .setTitle("⚔️ WORD DUEL")
    .setColor(0x5865F2);
  
  if (isGameOver) {
    const winner = state.scores[0] > state.scores[1] ? state.player1Id :
                   state.scores[1] > state.scores[0] ? state.player2Id : null;
    
    if (winner) {
      embed.setDescription(`🏆 <@${winner}> wins!`);
    } else {
      embed.setDescription("🤝 It's a draw!");
    }
    embed.addFields({ name: "Final Score", value: `${state.scores[0]} - ${state.scores[1]}`, inline: true });
    embed.setColor(0x57F287);
  } else {
    const scrambled = state.scrambledWords[state.currentWordIndex].toUpperCase();
    embed.setDescription(`Unscramble: **${scrambled}**\n\nType your answer!`);
    embed.addFields(
      { name: "Round", value: `${state.currentWordIndex + 1}/5`, inline: true },
      { name: "Score", value: `${state.scores[0]} - ${state.scores[1]}`, inline: true }
    );
  }
  
  return embed;
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

export function createQuitButton(gameId: string) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`quit_${gameId}`)
        .setLabel("Quit Game")
        .setStyle(ButtonStyle.Danger)
    );
}

export function createRematchButton(gameType: string, player1Id: string, player2Id: string) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`rematch_${gameType}_${player1Id}_${player2Id}`)
        .setLabel("Rematch")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`gg_${player1Id}_${player2Id}`)
        .setLabel("GG 🤝")
        .setStyle(ButtonStyle.Secondary)
    );
}
