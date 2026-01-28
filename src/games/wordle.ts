import { FIVE_LETTER_WORDS, WORD_SET } from "../data/wordlist.js";

export interface WordleState {
  playerId: string;
  targetWord: string;
  guesses: string[];
  maxGuesses: number;
  gameOver: boolean;
  won: boolean;
  startTime: number;
  endTime?: number;
  lastMoveTime: number;
}

export function createGameState(playerId: string): WordleState {
  const targetWord = FIVE_LETTER_WORDS[Math.floor(Math.random() * FIVE_LETTER_WORDS.length)];
  return {
    playerId,
    targetWord,
    guesses: [],
    maxGuesses: 6,
    gameOver: false,
    won: false,
    startTime: Date.now(),
    lastMoveTime: Date.now(),
  };
}

export function makeGuess(state: WordleState, guess: string): { valid: boolean; error?: string } {
  const normalizedGuess = guess.toLowerCase().trim();
  
  if (normalizedGuess.length !== 5) {
    return { valid: false, error: "Guess must be exactly 5 letters" };
  }
  
  if (!/^[a-z]+$/.test(normalizedGuess)) {
    return { valid: false, error: "Guess must contain only letters" };
  }
  
  if (!WORD_SET.has(normalizedGuess)) {
    return { valid: false, error: "Not a valid word" };
  }
  
  state.guesses.push(normalizedGuess);
  state.lastMoveTime = Date.now();
  
  if (normalizedGuess === state.targetWord) {
    state.gameOver = true;
    state.won = true;
    state.endTime = Date.now();
  } else if (state.guesses.length >= state.maxGuesses) {
    state.gameOver = true;
    state.won = false;
    state.endTime = Date.now();
  }
  
  return { valid: true };
}

export function evaluateGuess(targetWord: string, guess: string): string[] {
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

export function renderBoard(state: WordleState): string {
  let display = "WORDLE\n\n";
  
  for (const guess of state.guesses) {
    const result = evaluateGuess(state.targetWord, guess);
    display += result.join("") + " " + guess.toUpperCase() + "\n";
  }
  
  const remaining = state.maxGuesses - state.guesses.length;
  for (let i = 0; i < remaining; i++) {
    display += "🔲🔲🔲🔲🔲\n";
  }
  
  display += `\nGuesses: ${state.guesses.length}/${state.maxGuesses}`;
  
  if (state.gameOver) {
    if (state.won) {
      const time = Math.floor((state.endTime! - state.startTime) / 1000);
      display += `\n\nYou won in ${state.guesses.length} guess${state.guesses.length > 1 ? 'es' : ''}! Time: ${time}s`;
    } else {
      display += `\n\nGame over! The word was: ${state.targetWord.toUpperCase()}`;
    }
  } else {
    display += "\n\nType a 5-letter word to guess!";
  }
  
  return display;
}
