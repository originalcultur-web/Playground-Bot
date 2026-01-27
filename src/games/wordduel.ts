const WORD_LIST = [
  "apple", "brave", "crane", "dance", "eagle", "flame", "grape", "heart", "ivory", "jewel",
  "knife", "lemon", "music", "noble", "ocean", "pearl", "queen", "river", "stone", "tiger",
  "unity", "voice", "water", "youth", "zebra", "angel", "beach", "cloud", "dream", "earth",
  "forest", "golden", "happy", "island", "jungle", "knight", "leader", "magic", "nature", "orange",
  "planet", "quiet", "rocket", "silver", "thunder", "unique", "violet", "winter", "yellow", "zenith",
  "bridge", "castle", "dragon", "energy", "frozen", "garden", "harbor", "impact", "journey", "kitchen",
  "legend", "memory", "nation", "oxygen", "palace", "quality", "rainbow", "shadow", "temple", "umbrella"
];

export interface WordDuelState {
  player1Id: string;
  player2Id: string;
  words: string[];
  scrambledWords: string[];
  currentWordIndex: number;
  scores: [number, number];
  roundStartTime: number;
  roundAnswers: Record<string, { answer: string; time: number }>;
  lastMoveTime: number;
}

function scrambleWord(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const scrambled = arr.join('');
  return scrambled === word ? scrambleWord(word) : scrambled;
}

export function createGameState(player1Id: string, player2Id: string): WordDuelState {
  const shuffled = [...WORD_LIST].sort(() => Math.random() - 0.5);
  const words = shuffled.slice(0, 5);
  const scrambledWords = words.map(scrambleWord);
  
  return {
    player1Id,
    player2Id,
    words,
    scrambledWords,
    currentWordIndex: 0,
    scores: [0, 0],
    roundStartTime: Date.now(),
    roundAnswers: {},
    lastMoveTime: Date.now(),
  };
}

export function getCurrentScrambledWord(state: WordDuelState): string {
  return state.scrambledWords[state.currentWordIndex];
}

export function getCurrentWord(state: WordDuelState): string {
  return state.words[state.currentWordIndex];
}

export function submitAnswer(state: WordDuelState, playerId: string, answer: string): { correct: boolean; first: boolean } {
  const correctWord = getCurrentWord(state);
  const normalizedAnswer = answer.toLowerCase().trim();
  
  if (normalizedAnswer !== correctWord) {
    return { correct: false, first: false };
  }
  
  if (state.roundAnswers[playerId]) {
    return { correct: true, first: false };
  }
  
  const isFirst = Object.keys(state.roundAnswers).length === 0;
  state.roundAnswers[playerId] = { answer: normalizedAnswer, time: Date.now() };
  state.lastMoveTime = Date.now();
  
  if (isFirst) {
    const playerIndex = playerId === state.player1Id ? 0 : 1;
    state.scores[playerIndex]++;
  }
  
  return { correct: true, first: isFirst };
}

export function nextRound(state: WordDuelState): boolean {
  state.currentWordIndex++;
  state.roundAnswers = {};
  state.roundStartTime = Date.now();
  return state.currentWordIndex < 5;
}

export function isGameOver(state: WordDuelState): boolean {
  return state.currentWordIndex >= 5;
}

export function getWinner(state: WordDuelState): string | null {
  if (state.scores[0] > state.scores[1]) return state.player1Id;
  if (state.scores[1] > state.scores[0]) return state.player2Id;
  return null;
}

export function renderStatus(state: WordDuelState): string {
  const scrambled = getCurrentScrambledWord(state).toUpperCase();
  return `WORD DUEL - Round ${state.currentWordIndex + 1}/5
Score: ${state.scores[0]} - ${state.scores[1]}

Unscramble: **${scrambled}**

Type your answer!`;
}

export function renderFinalResult(state: WordDuelState): string {
  const winner = getWinner(state);
  let result = `WORD DUEL - FINAL RESULT

Score: ${state.scores[0]} - ${state.scores[1]}

`;
  if (winner === state.player1Id) {
    result += `<@${state.player1Id}> wins!`;
  } else if (winner === state.player2Id) {
    result += `<@${state.player2Id}> wins!`;
  } else {
    result += "It's a draw!";
  }
  return result;
}
