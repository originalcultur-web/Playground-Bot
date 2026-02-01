import { FIVE_LETTER_WORDS } from "../data/wordlist.js";

export interface HangmanState {
  playerId: string;
  word: string;
  guessedLetters: string[];
  wrongGuesses: number;
  maxWrongGuesses: number;
  startTime: number;
  lastGuessTime: number;
}

export function createGameState(playerId: string): HangmanState {
  const word = FIVE_LETTER_WORDS[Math.floor(Math.random() * FIVE_LETTER_WORDS.length)].toUpperCase();
  return {
    playerId,
    word,
    guessedLetters: [],
    wrongGuesses: 0,
    maxWrongGuesses: 6,
    startTime: Date.now(),
    lastGuessTime: Date.now(),
  };
}

export function guessLetter(state: HangmanState, letter: string): { valid: boolean; correct: boolean; alreadyGuessed: boolean } {
  const upperLetter = letter.toUpperCase();
  
  if (state.guessedLetters.includes(upperLetter)) {
    return { valid: true, correct: false, alreadyGuessed: true };
  }
  
  state.guessedLetters.push(upperLetter);
  state.lastGuessTime = Date.now();
  
  if (state.word.includes(upperLetter)) {
    return { valid: true, correct: true, alreadyGuessed: false };
  } else {
    state.wrongGuesses++;
    return { valid: true, correct: false, alreadyGuessed: false };
  }
}

export function isGameWon(state: HangmanState): boolean {
  return state.word.split("").every(letter => state.guessedLetters.includes(letter));
}

export function isGameLost(state: HangmanState): boolean {
  return state.wrongGuesses >= state.maxWrongGuesses;
}

export function getDisplayWord(state: HangmanState): string {
  return state.word.split("").map(letter => 
    state.guessedLetters.includes(letter) ? letter : "_"
  ).join(" ");
}

export function getHangmanFigure(wrongGuesses: number): string {
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

export function renderGame(state: HangmanState): string {
  const figure = getHangmanFigure(state.wrongGuesses);
  const displayWord = getDisplayWord(state);
  const wrongLetters = state.guessedLetters.filter(l => !state.word.includes(l)).join(" ");
  
  return `${figure}\n\n` +
    `**Word:** \`${displayWord}\`\n\n` +
    `Wrong guesses: ${state.wrongGuesses}/${state.maxWrongGuesses}\n` +
    (wrongLetters ? `Tried: ${wrongLetters}` : "");
}

export function getCompletionTime(state: HangmanState): number {
  return Math.floor((state.lastGuessTime - state.startTime) / 1000);
}

export function getAvailableLetters(state: HangmanState): string[] {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return alphabet.filter(letter => !state.guessedLetters.includes(letter));
}
