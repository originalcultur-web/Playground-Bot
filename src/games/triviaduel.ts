export interface TriviaQuestion {
  question: string;
  answers: string[];
  correctIndex: number;
  category: string;
}

export interface TriviaDuelState {
  player1Id: string;
  player2Id: string;
  player1Score: number;
  player2Score: number;
  currentRound: number;
  maxRounds: number;
  currentQuestion: TriviaQuestion | null;
  player1Answered: boolean;
  player2Answered: boolean;
  roundWinner: string | null;
  usedQuestionIndices: number[];
  lastMoveTime: number;
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { question: "What planet is known as the Red Planet?", answers: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1, category: "Science" },
  { question: "What is the largest ocean on Earth?", answers: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3, category: "Geography" },
  { question: "How many legs does a spider have?", answers: ["6", "8", "10", "12"], correctIndex: 1, category: "Nature" },
  { question: "What year did World War II end?", answers: ["1943", "1944", "1945", "1946"], correctIndex: 2, category: "History" },
  { question: "What is the chemical symbol for gold?", answers: ["Go", "Gd", "Au", "Ag"], correctIndex: 2, category: "Science" },
  { question: "Which country is home to the kangaroo?", answers: ["New Zealand", "South Africa", "Australia", "Brazil"], correctIndex: 2, category: "Geography" },
  { question: "How many colors are in a rainbow?", answers: ["5", "6", "7", "8"], correctIndex: 2, category: "Science" },
  { question: "What is the smallest prime number?", answers: ["0", "1", "2", "3"], correctIndex: 2, category: "Math" },
  { question: "Who painted the Mona Lisa?", answers: ["Michelangelo", "Da Vinci", "Picasso", "Van Gogh"], correctIndex: 1, category: "Art" },
  { question: "What is the capital of Japan?", answers: ["Seoul", "Beijing", "Tokyo", "Bangkok"], correctIndex: 2, category: "Geography" },
  { question: "How many sides does a hexagon have?", answers: ["5", "6", "7", "8"], correctIndex: 1, category: "Math" },
  { question: "What is the largest mammal?", answers: ["Elephant", "Blue Whale", "Giraffe", "Hippo"], correctIndex: 1, category: "Nature" },
  { question: "In what year did the Titanic sink?", answers: ["1910", "1912", "1914", "1916"], correctIndex: 1, category: "History" },
  { question: "What gas do plants breathe in?", answers: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correctIndex: 2, category: "Science" },
  { question: "How many continents are there?", answers: ["5", "6", "7", "8"], correctIndex: 2, category: "Geography" },
  { question: "What is the square root of 144?", answers: ["10", "11", "12", "14"], correctIndex: 2, category: "Math" },
  { question: "Which planet has the most moons?", answers: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctIndex: 1, category: "Science" },
  { question: "What is the hardest natural substance?", answers: ["Gold", "Iron", "Diamond", "Platinum"], correctIndex: 2, category: "Science" },
  { question: "Who wrote Romeo and Juliet?", answers: ["Dickens", "Shakespeare", "Austen", "Hemingway"], correctIndex: 1, category: "Literature" },
  { question: "What is the capital of France?", answers: ["London", "Berlin", "Madrid", "Paris"], correctIndex: 3, category: "Geography" },
  { question: "How many hours are in a day?", answers: ["12", "18", "24", "36"], correctIndex: 2, category: "General" },
  { question: "What is 15 x 15?", answers: ["200", "215", "225", "250"], correctIndex: 2, category: "Math" },
  { question: "Which animal is known as man's best friend?", answers: ["Cat", "Dog", "Horse", "Bird"], correctIndex: 1, category: "General" },
  { question: "What is the boiling point of water in Celsius?", answers: ["90", "95", "100", "110"], correctIndex: 2, category: "Science" },
  { question: "How many bones are in the adult human body?", answers: ["186", "196", "206", "216"], correctIndex: 2, category: "Science" },
  { question: "What is the largest country by area?", answers: ["China", "USA", "Canada", "Russia"], correctIndex: 3, category: "Geography" },
  { question: "Who invented the telephone?", answers: ["Edison", "Bell", "Tesla", "Marconi"], correctIndex: 1, category: "History" },
  { question: "What is the currency of the UK?", answers: ["Euro", "Dollar", "Pound", "Franc"], correctIndex: 2, category: "General" },
  { question: "How many players are on a soccer team?", answers: ["9", "10", "11", "12"], correctIndex: 2, category: "Sports" },
  { question: "What is the fastest land animal?", answers: ["Lion", "Cheetah", "Leopard", "Tiger"], correctIndex: 1, category: "Nature" },
  { question: "What year did humans first land on the Moon?", answers: ["1965", "1967", "1969", "1971"], correctIndex: 2, category: "History" },
  { question: "What is the main ingredient in guacamole?", answers: ["Tomato", "Onion", "Avocado", "Pepper"], correctIndex: 2, category: "Food" },
  { question: "How many strings does a standard guitar have?", answers: ["4", "5", "6", "8"], correctIndex: 2, category: "Music" },
  { question: "What is the largest desert in the world?", answers: ["Sahara", "Arabian", "Gobi", "Antarctic"], correctIndex: 3, category: "Geography" },
  { question: "What element does 'O' represent on the periodic table?", answers: ["Gold", "Osmium", "Oxygen", "Oganesson"], correctIndex: 2, category: "Science" },
  { question: "In which sport would you perform a slam dunk?", answers: ["Tennis", "Basketball", "Football", "Golf"], correctIndex: 1, category: "Sports" },
  { question: "What is the tallest mountain in the world?", answers: ["K2", "Kangchenjunga", "Everest", "Lhotse"], correctIndex: 2, category: "Geography" },
  { question: "How many degrees are in a circle?", answers: ["180", "270", "360", "400"], correctIndex: 2, category: "Math" },
  { question: "Which planet is closest to the Sun?", answers: ["Venus", "Mercury", "Earth", "Mars"], correctIndex: 1, category: "Science" },
  { question: "What is the national animal of the USA?", answers: ["Lion", "Bear", "Bald Eagle", "Buffalo"], correctIndex: 2, category: "General" }
];

export function createGameState(player1Id: string, player2Id: string): TriviaDuelState {
  return {
    player1Id,
    player2Id,
    player1Score: 0,
    player2Score: 0,
    currentRound: 1,
    maxRounds: 5,
    currentQuestion: null,
    player1Answered: false,
    player2Answered: false,
    roundWinner: null,
    usedQuestionIndices: [],
    lastMoveTime: Date.now(),
  };
}

export function getNextQuestion(state: TriviaDuelState): TriviaQuestion | null {
  const availableIndices = TRIVIA_QUESTIONS.map((_, i) => i)
    .filter(i => !state.usedQuestionIndices.includes(i));
  
  if (availableIndices.length === 0) return null;
  
  const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  state.usedQuestionIndices.push(randomIndex);
  state.currentQuestion = TRIVIA_QUESTIONS[randomIndex];
  state.player1Answered = false;
  state.player2Answered = false;
  state.roundWinner = null;
  state.lastMoveTime = Date.now();
  
  return state.currentQuestion;
}

export function submitAnswer(state: TriviaDuelState, playerId: string, answerIndex: number): { correct: boolean; firstCorrect: boolean } {
  if (!state.currentQuestion) return { correct: false, firstCorrect: false };
  
  const isCorrect = answerIndex === state.currentQuestion.correctIndex;
  const isPlayer1 = playerId === state.player1Id;
  
  if (isPlayer1 && state.player1Answered) return { correct: false, firstCorrect: false };
  if (!isPlayer1 && state.player2Answered) return { correct: false, firstCorrect: false };
  
  if (isPlayer1) {
    state.player1Answered = true;
  } else {
    state.player2Answered = true;
  }
  
  let firstCorrect = false;
  if (isCorrect && !state.roundWinner) {
    state.roundWinner = playerId;
    if (isPlayer1) {
      state.player1Score++;
    } else {
      state.player2Score++;
    }
    firstCorrect = true;
  }
  
  state.lastMoveTime = Date.now();
  return { correct: isCorrect, firstCorrect };
}

export function bothAnswered(state: TriviaDuelState): boolean {
  return state.player1Answered && state.player2Answered;
}

export function isMatchOver(state: TriviaDuelState): { over: boolean; winner?: string } {
  const winsNeeded = 3;
  if (state.player1Score >= winsNeeded) {
    return { over: true, winner: state.player1Id };
  }
  if (state.player2Score >= winsNeeded) {
    return { over: true, winner: state.player2Id };
  }
  if (state.currentRound > state.maxRounds) {
    if (state.player1Score > state.player2Score) {
      return { over: true, winner: state.player1Id };
    } else if (state.player2Score > state.player1Score) {
      return { over: true, winner: state.player2Id };
    }
    return { over: true };
  }
  return { over: false };
}

export function nextRound(state: TriviaDuelState): void {
  state.currentRound++;
}

export function renderQuestion(state: TriviaDuelState, player1Name: string, player2Name: string): string {
  if (!state.currentQuestion) return "No question available";
  
  const q = state.currentQuestion;
  const p1Status = state.player1Answered ? "✅" : "⏳";
  const p2Status = state.player2Answered ? "✅" : "⏳";
  
  return `**Trivia Duel** - Round ${state.currentRound}/${state.maxRounds}\n` +
    `${player1Name} ${p1Status} vs ${p2Status} ${player2Name}\n` +
    `Score: **${state.player1Score}** - **${state.player2Score}**\n\n` +
    `📚 *${q.category}*\n\n` +
    `**${q.question}**`;
}
