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
  roundAnswers: Record<string, { answer: string; time: number; correct: boolean }>;
  lastMoveTime: number;
  roundComplete: boolean;
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
    roundComplete: false,
  };
}

export function getCurrentScrambledWord(state: WordDuelState): string {
  return state.scrambledWords[state.currentWordIndex];
}

export function getCurrentWord(state: WordDuelState): string {
  return state.words[state.currentWordIndex];
}

export function submitAnswer(state: WordDuelState, playerId: string, answer: string): { 
  accepted: boolean; 
  correct: boolean; 
  bothAnswered: boolean;
  alreadyAnswered: boolean;
} {
  // Check if player already answered this round
  if (state.roundAnswers[playerId]) {
    return { accepted: false, correct: false, bothAnswered: false, alreadyAnswered: true };
  }
  
  // Check if round is already complete
  if (state.roundComplete) {
    return { accepted: false, correct: false, bothAnswered: false, alreadyAnswered: false };
  }
  
  const correctWord = getCurrentWord(state);
  const normalizedAnswer = answer.toLowerCase().trim();
  const isCorrect = normalizedAnswer === correctWord;
  
  // Record player's answer
  state.roundAnswers[playerId] = { 
    answer: normalizedAnswer, 
    time: Date.now(),
    correct: isCorrect
  };
  state.lastMoveTime = Date.now();
  
  // Check if both players have answered
  const bothAnswered = state.roundAnswers[state.player1Id] && state.roundAnswers[state.player2Id];
  
  return { accepted: true, correct: isCorrect, bothAnswered, alreadyAnswered: false };
}

export function resolveRound(state: WordDuelState): { 
  winnerId: string | null; 
  p1Correct: boolean; 
  p2Correct: boolean;
  correctWord: string;
} {
  const correctWord = getCurrentWord(state);
  const p1Answer = state.roundAnswers[state.player1Id];
  const p2Answer = state.roundAnswers[state.player2Id];
  
  const p1Correct = p1Answer?.correct ?? false;
  const p2Correct = p2Answer?.correct ?? false;
  
  let winnerId: string | null = null;
  
  if (p1Correct && !p2Correct) {
    // Only player 1 correct
    winnerId = state.player1Id;
    state.scores[0]++;
  } else if (p2Correct && !p1Correct) {
    // Only player 2 correct
    winnerId = state.player2Id;
    state.scores[1]++;
  } else if (p1Correct && p2Correct) {
    // Both correct - faster wins
    if (p1Answer.time < p2Answer.time) {
      winnerId = state.player1Id;
      state.scores[0]++;
    } else {
      winnerId = state.player2Id;
      state.scores[1]++;
    }
  }
  // If neither correct, no one gets a point
  
  state.roundComplete = true;
  return { winnerId, p1Correct, p2Correct, correctWord };
}

export function nextRound(state: WordDuelState): boolean {
  state.currentWordIndex++;
  state.roundAnswers = {};
  state.roundStartTime = Date.now();
  state.roundComplete = false;
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
