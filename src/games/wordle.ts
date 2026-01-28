const WORD_LIST = [
  "apple", "brave", "crane", "dance", "eagle", "flame", "grape", "heart", "ivory", "jewel",
  "knife", "lemon", "music", "noble", "ocean", "pearl", "queen", "river", "stone", "tiger",
  "unity", "voice", "water", "youth", "zebra", "angel", "beach", "cloud", "dream", "earth",
  "arise", "bloat", "charm", "dwarf", "ember", "frost", "ghost", "haste", "input", "joker",
  "kayak", "lymph", "mirth", "nymph", "orbit", "prank", "quest", "rogue", "storm", "trick",
  "world", "about", "think", "house", "place", "party", "every", "night", "point", "great",
  "small", "story", "young", "right", "woman", "child", "three", "state", "never", "under",
  "money", "power", "learn", "force", "light", "those", "begin", "woman", "being", "study",
  "still", "write", "found", "group", "early", "build", "carry", "stand", "alone", "board",
  "break", "cover", "issue", "level", "local", "major", "maybe", "north", "plant", "press",
  "ready", "serve", "short", "since", "south", "space", "start", "trade", "train", "trial",
  "watch", "while", "whole", "among", "basic", "birth", "brain", "chair", "clean", "climb",
  "cross", "death", "drive", "event", "field", "glass", "grant", "green", "guard", "happy",
  "honor", "horse", "hotel", "later", "laugh", "legal", "limit", "lower", "march", "match",
  "metal", "model", "month", "moral", "motor", "mouth", "offer", "order", "other", "owner"
];

const VALID_WORDS = new Set([
  ...WORD_LIST,
  "about", "above", "abuse", "actor", "admit", "adopt", "adult", "after", "again", "agent",
  "agree", "ahead", "alarm", "album", "alert", "alien", "align", "alike", "alive", "allow",
  "alter", "angry", "annoy", "apart", "apple", "apply", "arena", "argue", "armor", "array",
  "arrow", "asset", "avoid", "awake", "award", "awful", "bacon", "badge", "badly", "baker",
  "bases", "basic", "basin", "basis", "beach", "bears", "beast", "begun", "below", "bench",
  "berry", "black", "blade", "blame", "blank", "blast", "blaze", "blend", "bless", "blind",
  "block", "blood", "blown", "blues", "blunt", "board", "boast", "bones", "bonus", "boost",
  "booth", "bound", "brain", "brake", "brand", "brass", "brave", "bread", "break", "breed",
  "brick", "bride", "brief", "bring", "broad", "broke", "brown", "brush", "buddy", "build",
  "built", "bunch", "burns", "burst", "buyer", "cable", "cache", "camel", "candy", "canon",
  "cargo", "carry", "carve", "catch", "cause", "cease", "chain", "chair", "chalk", "champ",
  "chaos", "charm", "chart", "chase", "cheap", "cheat", "check", "chest", "chief", "child",
  "chill", "china", "chips", "chose", "chunk", "claim", "clash", "class", "clean", "clear",
  "clerk", "click", "cliff", "climb", "clock", "clone", "close", "cloth", "cloud", "coach",
  "coast", "color", "couch", "could", "count", "court", "cover", "crack", "craft", "crane",
  "crash", "crawl", "crazy", "cream", "crime", "crisp", "cross", "crowd", "crown", "cruel",
  "crush", "curve", "cycle", "daily", "dance", "dated", "deals", "death", "debut", "delay",
  "dense", "depot", "depth", "dirty", "disco", "doing", "doubt", "dozen", "draft", "drain",
  "drama", "drank", "drawn", "dream", "dress", "dried", "drill", "drink", "drive", "drops",
  "drove", "drugs", "drums", "drunk", "dying", "eager", "early", "earth", "eaten", "eight",
  "elder", "elect", "elite", "empty", "ended", "enemy", "enjoy", "enter", "entry", "equal",
  "error", "essay", "event", "every", "exact", "exist", "extra", "faint", "fairy", "faith",
  "false", "fancy", "fatal", "fault", "feast", "fence", "ferry", "fever", "fiber", "field",
  "fifth", "fifty", "fight", "final", "finds", "fired", "first", "fixed", "flame", "flash",
  "fleet", "flesh", "float", "flood", "floor", "flour", "fluid", "focus", "force", "forge",
  "forth", "forty", "forum", "found", "frame", "frank", "fraud", "fresh", "front", "fruit",
  "fully", "fungi", "funny", "ghost", "giant", "given", "glass", "globe", "glory", "glove",
  "grace", "grade", "grain", "grand", "grant", "grape", "graph", "grasp", "grass", "grave",
  "great", "greed", "greek", "green", "greet", "grief", "grill", "grind", "grips", "gross",
  "group", "grove", "grown", "guard", "guess", "guest", "guide", "guilt", "habit", "hairy",
  "happy", "harsh", "haste", "haven", "heart", "heavy", "hello", "hence", "herbs", "hilarious",
  "horse", "hotel", "hound", "hours", "house", "human", "humor", "hurry", "ideal", "image",
  "imply", "index", "inner", "input", "issue", "items", "ivory", "jewel", "joint", "joker",
  "jones", "judge", "juice", "jumps", "keeps", "kills", "kinds", "knife", "knock", "known",
  "label", "labor", "lacks", "lance", "lands", "lanes", "large", "laser", "later", "latin",
  "laugh", "layer", "leads", "learn", "lease", "least", "leave", "legal", "lemon", "level",
  "lever", "light", "liked", "limit", "lines", "links", "lions", "lists", "lived", "liver",
  "lives", "lobby", "local", "lodge", "logic", "loose", "lotus", "loved", "lover", "lower",
  "loyal", "lucky", "lunar", "lunch", "lying", "lymph", "magic", "major", "maker", "makes",
  "manga", "manor", "maple", "march", "marks", "marry", "marsh", "match", "maybe", "mayor",
  "meals", "means", "media", "meets", "melon", "mercy", "merge", "merit", "merry", "metal",
  "meter", "midst", "might", "miles", "minds", "minor", "minus", "mirth", "mixed", "model",
  "modes", "moist", "money", "monks", "month", "moral", "motor", "motto", "mound", "mount",
  "mouse", "mouth", "moved", "movie", "music", "naive", "naked", "named", "names", "nasty",
  "naval", "nerve", "never", "newly", "night", "ninth", "noble", "noise", "norms", "north",
  "notch", "noted", "notes", "novel", "nurse", "nylon", "nymph", "occur", "ocean", "offer",
  "often", "older", "olive", "onset", "opens", "opera", "orbit", "order", "other", "ought",
  "outer", "owned", "owner", "oxide", "ozone", "packs", "pages", "paint", "pairs", "panel",
  "panic", "paper", "parks", "parts", "party", "pasta", "paste", "patch", "paths", "patio",
  "pause", "peace", "peach", "peaks", "pearl", "peers", "penny", "perch", "perks", "phone",
  "photo", "piano", "picks", "piece", "piles", "pilot", "pinch", "pipes", "pitch", "pizza",
  "place", "plain", "plane", "plans", "plant", "plate", "plaza", "plays", "plead", "plots",
  "pluck", "plumb", "plump", "plunge", "poems", "point", "poker", "polar", "poles", "polls",
  "ponds", "pools", "porch", "ports", "posed", "posts", "pound", "power", "prank", "press",
  "price", "pride", "prime", "print", "prior", "prize", "probe", "prone", "proof", "prose",
  "proud", "prove", "proxy", "pulse", "pumps", "punch", "pupil", "purse", "queen", "query",
  "quest", "quick", "quiet", "quite", "quote", "radar", "radio", "rails", "raise", "rally",
  "ranch", "range", "ranks", "rapid", "rated", "rates", "ratio", "reach", "react", "reads",
  "ready", "realm", "rebel", "refer", "reign", "relax", "relay", "reply", "rider", "ridge",
  "rifle", "right", "rigid", "rings", "rises", "risks", "risky", "rival", "river", "roads",
  "robin", "robot", "rocks", "rocky", "rogue", "roles", "roman", "rooms", "roots", "roses",
  "rough", "round", "route", "royal", "rugby", "ruins", "ruled", "ruler", "rules", "rural",
  "sadly", "saint", "salad", "sales", "salon", "sandy", "sauce", "saved", "saves", "scale",
  "scaly", "scare", "scene", "scent", "score", "scout", "scrap", "seals", "seats", "seeks",
  "sense", "serve", "setup", "seven", "shade", "shake", "shall", "shame", "shape", "share",
  "shark", "sharp", "sheep", "sheer", "sheet", "shelf", "shell", "shift", "shine", "shiny",
  "ships", "shirt", "shock", "shoes", "shook", "shoot", "shore", "short", "shots", "shout",
  "shown", "shows", "sided", "sides", "siege", "sight", "signs", "silly", "simon", "since",
  "sixth", "sixty", "sized", "sizes", "skill", "skull", "slate", "slave", "sleep", "slice",
  "slide", "slope", "slots", "small", "smart", "smell", "smile", "smith", "smoke", "snake",
  "snowy", "sober", "solar", "solid", "solve", "songs", "sorry", "sorts", "souls", "sound",
  "south", "space", "spare", "spark", "spawn", "speak", "speed", "spell", "spend", "spent",
  "spice", "spike", "spine", "split", "spoke", "spoon", "sport", "spots", "spray", "squad",
  "stack", "staff", "stage", "stair", "stake", "stamp", "stand", "stark", "stars", "start",
  "state", "stays", "steal", "steam", "steel", "steep", "stems", "steps", "stick", "stiff",
  "still", "stock", "stole", "stone", "stood", "stool", "store", "storm", "story", "stove",
  "strap", "straw", "strip", "stuck", "study", "stuff", "style", "sugar", "suite", "suits",
  "sunny", "super", "surge", "sweet", "swept", "swift", "swing", "sword", "swore", "sworn",
  "table", "taken", "takes", "tales", "talks", "tally", "tanks", "tapes", "tasks", "taste",
  "tasty", "taxes", "teach", "teams", "tears", "teens", "teeth", "tells", "tempo", "tends",
  "tenor", "tense", "tenth", "terms", "tests", "texas", "texts", "thank", "theft", "theme",
  "there", "these", "thick", "thief", "thing", "think", "third", "those", "three", "threw",
  "throw", "thumb", "tiger", "tight", "tiles", "timer", "times", "tired", "title", "toast",
  "today", "token", "tommy", "tones", "tools", "tooth", "topic", "torch", "total", "touch",
  "tough", "tours", "tower", "towns", "toxic", "trace", "track", "trade", "trail", "train",
  "trait", "tramp", "trash", "treat", "trees", "trend", "trial", "tribe", "trick", "tried",
  "tries", "trips", "troop", "truck", "truly", "trunk", "trust", "truth", "tubes", "tulip",
  "tumor", "tuned", "tunes", "twins", "twist", "typed", "types", "ultra", "uncle", "under",
  "undue", "unfair", "union", "unite", "units", "unity", "until", "upper", "upset", "urban",
  "urged", "usage", "usual", "valid", "value", "vapor", "vault", "vegas", "venue", "verge",
  "verse", "video", "views", "villa", "vinyl", "viral", "virus", "visit", "vital", "vivid",
  "vocal", "voice", "voter", "votes", "wages", "wagon", "waist", "walks", "walls", "wants",
  "warns", "waste", "watch", "water", "waves", "wears", "weary", "wedge", "weeks", "weigh",
  "weird", "wells", "welsh", "wheel", "where", "which", "while", "white", "whole", "whose",
  "wider", "widow", "width", "winds", "wines", "wings", "witch", "wives", "woken", "woman",
  "women", "woods", "words", "works", "world", "worms", "worry", "worse", "worst", "worth",
  "would", "wound", "woven", "wraps", "wrath", "wreck", "wrist", "write", "wrong", "wrote",
  "yards", "years", "yield", "young", "yours", "youth", "zebra", "zones"
]);

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
  const targetWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
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
  
  if (!VALID_WORDS.has(normalizedGuess)) {
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
    display += "⬜⬜⬜⬜⬜\n";
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
