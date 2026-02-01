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

export function createTicTacToeDisplay(state: any): string {
  const emptyEmoji = "⬜";
  const p1Emoji = "❌";
  const p2Emoji = "⭕";
  
  let display = "";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = state.board[row * 3 + col];
      if (cell === 0) display += emptyEmoji;
      else if (cell === 1) display += p1Emoji;
      else display += p2Emoji;
    }
    display += "\n";
  }
  return display;
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

export function createRPSButtons(gameId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`rps_${gameId}_rock`)
        .setLabel("Rock")
        .setEmoji("🪨")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`rps_${gameId}_paper`)
        .setLabel("Paper")
        .setEmoji("📄")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`rps_${gameId}_scissors`)
        .setLabel("Scissors")
        .setEmoji("✂️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );
}

export function createRPSEmbed(state: any, player1Name: string, player2Name: string, isGameOver = false, result?: string) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 ROCK PAPER SCISSORS")
    .setColor(0x5865F2);
  
  const p1Status = state.player1Choice ? "✅" : "⏳";
  const p2Status = state.player2Choice ? "✅" : "⏳";
  
  embed.setDescription(
    `**${player1Name}** ${p1Status} vs ${p2Status} **${player2Name}**\n\n` +
    `Score: **${state.player1Wins}** - **${state.player2Wins}**\n` +
    `Best of ${state.maxRounds}`
  );
  
  if (isGameOver) {
    embed.setFooter({ text: result || "Game Over!" });
    embed.setColor(0x57F287);
  } else {
    embed.setFooter({ text: "Choose your weapon!" });
  }
  
  return embed;
}

export function createHangmanEmbed(state: any, isGameOver = false, won = false) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 HANGMAN")
    .setColor(0x5865F2);
  
  const figure = getHangmanFigure(state.wrongGuesses);
  const displayWord = state.word.split("").map((letter: string) => 
    state.guessedLetters.includes(letter) ? letter : "_"
  ).join(" ");
  
  const wrongLetters = state.guessedLetters.filter((l: string) => !state.word.includes(l)).join(" ");
  
  embed.setDescription(figure + `\n\n**Word:** \`${displayWord}\`\n\n` +
    (wrongLetters ? `Wrong: ${wrongLetters}` : ""));
  
  if (isGameOver) {
    if (won) {
      const time = Math.floor((state.lastGuessTime - state.startTime) / 1000);
      embed.setFooter({ text: `🎉 You won! Time: ${time}s` });
      embed.setColor(0x57F287);
    } else {
      embed.setFooter({ text: `Game over! The word was: ${state.word}` });
      embed.setColor(0xED4245);
    }
  } else {
    embed.setFooter({ text: `Guesses left: ${state.maxWrongGuesses - state.wrongGuesses}` });
  }
  
  return embed;
}

function getHangmanFigure(wrongGuesses: number): string {
  const stages = [
    "```\n  +---+\n      |\n      |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n      |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n  |   |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|   |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|\\  |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|\\  |\n /    |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```"
  ];
  return stages[Math.min(wrongGuesses, 6)];
}

export function createHangmanButtons(gameId: string, guessedLetters: string[], disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const rowSize = 5;
  
  for (let i = 0; i < alphabet.length; i += rowSize) {
    if (rows.length >= 5) break;
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let j = i; j < i + rowSize && j < alphabet.length; j++) {
      const letter = alphabet[j];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`hm_${gameId}_${letter}`)
          .setLabel(letter)
          .setStyle(guessedLetters.includes(letter) ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(disabled || guessedLetters.includes(letter))
      );
    }
    rows.push(row);
  }
  
  return rows;
}

export function createTriviaDuelEmbed(state: any, player1Name: string, player2Name: string, isGameOver = false, result?: string) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 TRIVIA DUEL")
    .setColor(0x5865F2);
  
  if (isGameOver) {
    embed.setDescription(result || "Game Over!");
    embed.setColor(0x57F287);
  } else if (state.currentQuestion) {
    const p1Status = state.player1Answered ? "✅" : "⏳";
    const p2Status = state.player2Answered ? "✅" : "⏳";
    
    embed.setDescription(
      `**${player1Name}** ${p1Status} vs ${p2Status} **${player2Name}**\n` +
      `Score: **${state.player1Score}** - **${state.player2Score}**\n\n` +
      `📚 *${state.currentQuestion.category}*\n\n` +
      `**${state.currentQuestion.question}**`
    );
    embed.setFooter({ text: `Round ${state.currentRound}/${state.maxRounds}` });
  }
  
  return embed;
}

export function createTriviaDuelButtons(gameId: string, answers: string[], disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const row2 = new ActionRowBuilder<ButtonBuilder>();
  
  const labels = ["A", "B", "C", "D"];
  
  for (let i = 0; i < answers.length; i++) {
    const btn = new ButtonBuilder()
      .setCustomId(`td_${gameId}_${i}`)
      .setLabel(`${labels[i]}: ${answers[i]}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled);
    
    if (i < 2) row1.addComponents(btn);
    else row2.addComponents(btn);
  }
  
  rows.push(row1, row2);
  return rows;
}

export function createMathBlitzEmbed(state: any, player1Name: string, player2Name: string, isGameOver = false, result?: string) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 MATH BLITZ")
    .setColor(0x5865F2);
  
  if (isGameOver) {
    embed.setDescription(result || "Game Over!");
    embed.setColor(0x57F287);
  } else if (state.currentProblem) {
    const p1Status = state.player1Answered ? "✅" : "⏳";
    const p2Status = state.player2Answered ? "✅" : "⏳";
    
    embed.setDescription(
      `**${player1Name}** ${p1Status} vs ${p2Status} **${player2Name}**\n` +
      `Score: **${state.player1Score}** - **${state.player2Score}**\n\n` +
      `🧮 **${state.currentProblem.question} = ?**\n\n` +
      `Type your answer!`
    );
    embed.setFooter({ text: `Round ${state.currentRound}/${state.maxRounds}` });
  }
  
  return embed;
}

export function createBattleshipEmbed(state: any, player1Name: string, player2Name: string, forPlayerId: string, isGameOver = false, result?: string) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 BATTLESHIP")
    .setColor(0x5865F2);
  
  if (isGameOver) {
    embed.setDescription(result || "Game Over!");
    embed.setColor(0x57F287);
  } else {
    const isPlayer1 = forPlayerId === state.player1Id;
    const myBoard = isPlayer1 ? state.player1Board : state.player2Board;
    const shooterBoard = isPlayer1 ? state.player1Board : state.player2Board;
    
    const myShipsLeft = myBoard.ships.filter((s: any) => s.hits.length < s.positions.length).length;
    const theirShipsLeft = (isPlayer1 ? state.player2Board : state.player1Board).ships.filter((s: any) => s.hits.length < s.positions.length).length;
    
    const isMyTurn = state.currentTurn === forPlayerId;
    const turnText = isMyTurn ? "**Your turn!** Type a coordinate (e.g., A1, B3)" : "Waiting for opponent...";
    
    const boardDisplay = renderAttackBoard(shooterBoard, isPlayer1 ? state.player2Board : state.player1Board);
    
    embed.setDescription(
      `**${player1Name}** vs **${player2Name}**\n\n` +
      `Your ships: ${myShipsLeft}/2 | Enemy ships: ${theirShipsLeft}/2\n\n` +
      `${turnText}\n\n` +
      `**Enemy Waters:**\n${boardDisplay}`
    );
  }
  
  return embed;
}

function renderAttackBoard(shooterBoard: any, targetBoard: any): string {
  const GRID_SIZE = 5;
  const cols = "ABCDE";
  let display = "  " + cols.split("").join(" ") + "\n";
  
  for (let row = 0; row < GRID_SIZE; row++) {
    display += `${row + 1} `;
    for (let col = 0; col < GRID_SIZE; col++) {
      const pos = row * GRID_SIZE + col;
      const wasShot = shooterBoard.shots.includes(pos);
      const isHit = shooterBoard.hits.includes(pos);
      
      if (isHit) {
        display += "💥";
      } else if (wasShot) {
        display += "⬜";
      } else {
        display += "🌊";
      }
    }
    display += "\n";
  }
  
  return "```\n" + display + "```";
}

export function createBattleshipButtons(gameId: string, shooterBoard: any, disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const GRID_SIZE = 5;
  const cols = "ABCDE";
  
  for (let row = 0; row < GRID_SIZE; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < GRID_SIZE; col++) {
      const pos = row * GRID_SIZE + col;
      const wasShot = shooterBoard.shots.includes(pos);
      const isHit = shooterBoard.hits.includes(pos);
      const coord = cols[col] + (row + 1);
      
      let style = ButtonStyle.Primary;
      if (isHit) style = ButtonStyle.Danger;
      else if (wasShot) style = ButtonStyle.Secondary;
      
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`bs_${gameId}_${pos}`)
          .setLabel(coord)
          .setStyle(style)
          .setDisabled(disabled || wasShot)
      );
    }
    rows.push(actionRow);
  }
  
  return rows;
}
