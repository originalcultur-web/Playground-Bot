export interface MathProblem {
  question: string;
  answer: number;
  difficulty: number;
}

export interface MathBlitzState {
  player1Id: string;
  player2Id: string;
  player1Score: number;
  player2Score: number;
  currentRound: number;
  maxRounds: number;
  currentProblem: MathProblem | null;
  player1Answered: boolean;
  player2Answered: boolean;
  roundWinner: string | null;
  lastMoveTime: number;
}

function generateProblem(round: number): MathProblem {
  const difficulty = Math.min(round, 5);
  let a: number, b: number, question: string, answer: number;
  
  const type = Math.floor(Math.random() * 4);
  
  switch (type) {
    case 0:
      if (difficulty <= 2) {
        a = Math.floor(Math.random() * 50) + 10;
        b = Math.floor(Math.random() * 50) + 10;
      } else {
        a = Math.floor(Math.random() * 200) + 50;
        b = Math.floor(Math.random() * 200) + 50;
      }
      question = `${a} + ${b}`;
      answer = a + b;
      break;
    case 1:
      if (difficulty <= 2) {
        a = Math.floor(Math.random() * 50) + 20;
        b = Math.floor(Math.random() * 20) + 1;
      } else {
        a = Math.floor(Math.random() * 200) + 100;
        b = Math.floor(Math.random() * 100) + 1;
      }
      question = `${a} - ${b}`;
      answer = a - b;
      break;
    case 2:
      if (difficulty <= 2) {
        a = Math.floor(Math.random() * 12) + 2;
        b = Math.floor(Math.random() * 12) + 2;
      } else if (difficulty <= 4) {
        a = Math.floor(Math.random() * 15) + 5;
        b = Math.floor(Math.random() * 12) + 2;
      } else {
        a = Math.floor(Math.random() * 20) + 10;
        b = Math.floor(Math.random() * 15) + 2;
      }
      question = `${a} × ${b}`;
      answer = a * b;
      break;
    case 3:
    default:
      if (difficulty <= 2) {
        b = Math.floor(Math.random() * 10) + 2;
        answer = Math.floor(Math.random() * 10) + 1;
      } else {
        b = Math.floor(Math.random() * 12) + 2;
        answer = Math.floor(Math.random() * 15) + 2;
      }
      a = b * answer;
      question = `${a} ÷ ${b}`;
      break;
  }
  
  return { question, answer, difficulty };
}

export function createGameState(player1Id: string, player2Id: string): MathBlitzState {
  return {
    player1Id,
    player2Id,
    player1Score: 0,
    player2Score: 0,
    currentRound: 1,
    maxRounds: 5,
    currentProblem: null,
    player1Answered: false,
    player2Answered: false,
    roundWinner: null,
    lastMoveTime: Date.now(),
  };
}

export function getNextProblem(state: MathBlitzState): MathProblem {
  state.currentProblem = generateProblem(state.currentRound);
  state.player1Answered = false;
  state.player2Answered = false;
  state.roundWinner = null;
  state.lastMoveTime = Date.now();
  return state.currentProblem;
}

export function submitAnswer(state: MathBlitzState, playerId: string, answer: number): { correct: boolean; firstCorrect: boolean } {
  if (!state.currentProblem) return { correct: false, firstCorrect: false };
  
  const isCorrect = answer === state.currentProblem.answer;
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

export function bothAnswered(state: MathBlitzState): boolean {
  return state.player1Answered && state.player2Answered;
}

export function isMatchOver(state: MathBlitzState): { over: boolean; winner?: string } {
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

export function nextRound(state: MathBlitzState): void {
  state.currentRound++;
}

export function renderProblem(state: MathBlitzState, player1Name: string, player2Name: string): string {
  if (!state.currentProblem) return "No problem available";
  
  const p1Status = state.player1Answered ? "✅" : "⏳";
  const p2Status = state.player2Answered ? "✅" : "⏳";
  
  return `**Math Blitz** - Round ${state.currentRound}/${state.maxRounds}\n` +
    `${player1Name} ${p1Status} vs ${p2Status} ${player2Name}\n` +
    `Score: **${state.player1Score}** - **${state.player2Score}**\n\n` +
    `🧮 **${state.currentProblem.question} = ?**\n\n` +
    `Type your answer!`;
}
