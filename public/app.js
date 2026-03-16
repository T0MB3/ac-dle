const MODE_CONFIG = {
  classic: {
    label: "Classique",
    fields: ["first_game", "year", "region", "faction", "gender", "is_historical"]
  },
  timeline: {
    label: "Chronologie",
    fields: ["year", "first_game", "region"]
  },
  intel: {
    label: "Renseignement",
    fields: ["faction", "region", "gender", "is_historical"]
  }
};

const FIELD_CONFIG = {
  first_game: {
    label: "Jeu",
    value: (attempt) => attempt.guess.first_game,
    status: (attempt) => attempt.feedback.first_game
  },
  year: {
    label: "Annee",
    value: (attempt) => formatYear(attempt.guess.year, attempt.feedback.year),
    status: (attempt) => attempt.feedback.year
  },
  region: {
    label: "Region",
    value: (attempt) => attempt.guess.region,
    status: (attempt) => attempt.feedback.region
  },
  faction: {
    label: "Faction",
    value: (attempt) => attempt.guess.faction,
    status: (attempt) => attempt.feedback.faction
  },
  gender: {
    label: "Genre",
    value: (attempt) => attempt.guess.gender,
    status: (attempt) => attempt.feedback.gender
  },
  is_historical: {
    label: "Historique",
    value: (attempt) => (attempt.guess.is_historical ? "Oui" : "Non"),
    status: (attempt) => attempt.feedback.is_historical
  }
};

const dom = {
  themeToggle: document.getElementById("theme-toggle"),
  menuScreen: document.getElementById("menu-screen"),
  gameScreen: document.getElementById("game-screen"),
  modeTitle: document.getElementById("mode-title"),
  modeCards: Array.from(document.querySelectorAll(".mode-card")),
  menuButton: document.getElementById("menu-btn"),
  day: document.getElementById("day"),
  input: document.getElementById("guess-input"),
  suggestions: document.getElementById("suggestions"),
  button: document.getElementById("guess-btn"),
  replayButton: document.getElementById("replay-btn"),
  missionCode: document.getElementById("mission-code"),
  triesCount: document.getElementById("tries-count"),
  gameStatus: document.getElementById("game-status"),
  message: document.getElementById("message"),
  resultsHeader: document.getElementById("results-header"),
  results: document.getElementById("results")
};

let state = {
  mode: "classic",
  gameId: "",
  attempts: [],
  done: false,
  characters: []
};

initTheme();
if (dom.themeToggle) {
  dom.themeToggle.addEventListener("click", toggleTheme);
}

init().catch((error) => {
  setMessage(`Erreur d'initialisation: ${error.message}`);
});

async function init() {
  const characters = await fetchJson("/api/characters");
  state.characters = Array.isArray(characters.characters) ? characters.characters : [];

  dom.modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      startMode(mode).catch((error) => {
        setMessage(`Erreur mode: ${error.message}`);
      });
    });
  });

  dom.menuButton.addEventListener("click", () => {
    showScreen("menu");
    hideSuggestions();
    setMessage("");
  });

  dom.button.addEventListener("click", submitGuess);
  dom.replayButton.addEventListener("click", () => {
    restartGame().catch((error) => {
      setMessage(`Erreur replay: ${error.message}`);
    });
  });

  dom.input.addEventListener("input", (event) => {
    updateSuggestions(event.target.value);
  });
  dom.input.addEventListener("focus", (event) => {
    updateSuggestions(event.target.value);
  });
  dom.input.addEventListener("blur", () => {
    setTimeout(hideSuggestions, 120);
  });
  dom.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitGuess();
    }
  });

  showScreen("menu");
}

async function startMode(mode) {
  if (!MODE_CONFIG[mode]) return;

  state.mode = mode;
  state.attempts = [];
  state.done = false;
  dom.input.value = "";
  setMessage("");
  renderHeader();

  await startNewGame();
  restoreState();
  renderResults();
  updateUiLock();
  updateHud();
  showScreen("game");
}

function showScreen(screen) {
  const isGame = screen === "game";
  dom.menuScreen.classList.toggle("hidden", isGame);
  dom.gameScreen.classList.toggle("hidden", !isGame);
}

function renderHeader() {
  const fields = activeFields();
  dom.resultsHeader.innerHTML = "";
  dom.resultsHeader.style.setProperty("--extra-cols", String(fields.length));

  const nameCell = document.createElement("span");
  nameCell.textContent = "Nom";
  dom.resultsHeader.appendChild(nameCell);

  for (const field of fields) {
    const span = document.createElement("span");
    span.textContent = FIELD_CONFIG[field].label;
    dom.resultsHeader.appendChild(span);
  }
}

async function startNewGame() {
  const game = await fetchJson("/api/new-game", { method: "POST" });
  state.gameId = game.gameId;
  dom.modeTitle.textContent = `Mode ${MODE_CONFIG[state.mode].label}`;
  dom.day.textContent = "Mode test actif - personnage random a chaque replay.";
}

async function restartGame() {
  clearCurrentStorage();
  state.attempts = [];
  state.done = false;
  dom.input.value = "";
  setMessage("");

  await startNewGame();
  hideSuggestions();
  restoreState();
  renderResults();
  updateUiLock();
  updateHud();
}

function updateSuggestions(query) {
  if (state.done) {
    hideSuggestions();
    return;
  }

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    hideSuggestions();
    return;
  }

  const matches = state.characters
    .filter((character) => normalizeText(character.name).startsWith(normalizedQuery))
    .filter((character) => !hasAttemptedCharacter(character))
    .slice(0, 20);

  dom.suggestions.innerHTML = "";
  if (matches.length === 0) {
    hideSuggestions();
    return;
  }

  for (const character of matches) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "suggestion-item";
    item.setAttribute("role", "option");
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectSuggestion(character);
    });

    if (character.image_url) {
      const image = document.createElement("img");
      image.className = "suggestion-avatar";
      image.src = character.image_url;
      image.alt = character.name;
      image.loading = "lazy";
      image.onerror = () => {
        image.replaceWith(buildAvatarFallback(character.name));
      };
      item.appendChild(image);
    } else {
      item.appendChild(buildAvatarFallback(character.name));
    }

    const label = document.createElement("span");
    label.textContent = character.name;
    item.appendChild(label);

    dom.suggestions.appendChild(item);
  }

  dom.suggestions.classList.add("open");
}

function selectSuggestion(character) {
  dom.input.value = character.name;
  hideSuggestions();
}

function hideSuggestions() {
  dom.suggestions.classList.remove("open");
  dom.suggestions.innerHTML = "";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function submitGuess() {
  if (state.done) return;
  if (!state.gameId) return;

  const guessValue = dom.input.value.trim();
  if (!guessValue) {
    setMessage("Entre un nom de personnage.");
    return;
  }

  if (hasAttemptedGuessValue(guessValue)) {
    setMessage("Ce personnage a deja ete tente.");
    hideSuggestions();
    return;
  }

  try {
    const response = await fetchJson("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess: guessValue, gameId: state.gameId })
    });

    state.attempts.push(response);
    dom.input.value = "";
    hideSuggestions();
    setMessage("");

    if (response.isCorrect) {
      state.done = true;
      setMessage("Bravo, personnage trouve. Clique sur Rejouer pour une nouvelle partie.", true);
    }

    persistState();
    renderResults();
    updateUiLock();
    updateHud();
  } catch (error) {
    setMessage(error.message || "Erreur lors du guess.");
  }
}

function renderResults() {
  dom.results.innerHTML = "";
  const fields = activeFields();

  for (const attempt of state.attempts) {
    const row = document.createElement("div");
    row.className = "grid";
    row.style.setProperty("--extra-cols", String(fields.length));

    row.appendChild(buildNameCell(attempt.guess, attempt.feedback.name));

    for (const field of fields) {
      const cfg = FIELD_CONFIG[field];
      const cell = document.createElement("span");
      cell.textContent = cfg.value(attempt);
      cell.classList.add(cfg.status(attempt) || "miss");
      row.appendChild(cell);
    }

    dom.results.appendChild(row);
  }
}

function hasAttemptedCharacter(character) {
  return state.attempts.some((attempt) => attempt.guess?.id === character.id);
}

function hasAttemptedGuessValue(guessValue) {
  const normalizedGuess = normalizeText(guessValue);
  if (!normalizedGuess) {
    return false;
  }

  const matchedCharacter = state.characters.find((character) => {
    return character.id === guessValue || normalizeText(character.name) === normalizedGuess;
  });

  if (matchedCharacter) {
    return hasAttemptedCharacter(matchedCharacter);
  }

  return state.attempts.some((attempt) => {
    return attempt.guess?.id === guessValue || normalizeText(attempt.guess?.name) === normalizedGuess;
  });
}

function activeFields() {
  return MODE_CONFIG[state.mode]?.fields ?? MODE_CONFIG.classic.fields;
}

function buildNameCell(character, status) {
  const cell = document.createElement("span");
  cell.classList.add(status || "miss");

  const wrapper = document.createElement("div");
  wrapper.className = "character-cell";

  if (character.image_url) {
    const image = document.createElement("img");
    image.className = "character-avatar";
    image.src = character.image_url;
    image.alt = character.name;
    image.loading = "lazy";
    image.onerror = () => {
      image.replaceWith(buildAvatarFallback(character.name));
    };
    wrapper.appendChild(image);
  } else {
    wrapper.appendChild(buildAvatarFallback(character.name));
  }

  const label = document.createElement("strong");
  label.textContent = character.name;
  wrapper.appendChild(label);

  cell.appendChild(wrapper);
  return cell;
}

function buildAvatarFallback(name) {
  const fallback = document.createElement("div");
  fallback.className = "avatar-fallback";
  fallback.textContent = getInitials(name);
  return fallback;
}

function getInitials(value) {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function formatYear(year, status) {
  if (status === "higher") return `${year} ↑`;
  if (status === "lower") return `${year} ↓`;
  return String(year);
}

function setMessage(text, success = false) {
  dom.message.textContent = text;
  dom.message.style.color = success ? "var(--ok)" : "var(--bad)";
}

function storageKey() {
  return `ac-dle:test:${state.mode}:${state.gameId}`;
}

function persistState() {
  if (!state.gameId) return;
  localStorage.setItem(storageKey(), JSON.stringify({
    attempts: state.attempts,
    done: state.done
  }));
}

function restoreState() {
  if (!state.gameId) return;

  const saved = localStorage.getItem(storageKey());
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
    state.done = Boolean(parsed.done);
  } catch {
    state.attempts = [];
    state.done = false;
  }
}

function clearCurrentStorage() {
  if (!state.gameId) return;
  localStorage.removeItem(storageKey());
}

function updateUiLock() {
  const locked = state.done;
  dom.input.disabled = locked;
  dom.button.disabled = locked;
}

function updateHud() {
  if (dom.missionCode) {
    dom.missionCode.textContent = state.gameId ? `#${state.gameId.slice(0, 8).toUpperCase()}` : "-";
  }
  if (dom.triesCount) {
    dom.triesCount.textContent = String(state.attempts.length);
  }
  if (dom.gameStatus) {
    dom.gameStatus.textContent = state.done ? "Cible identifiee" : "En cours";
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("ac-dle:theme");
  const theme = savedTheme === "light" ? "light" : "dark";
  applyTheme(theme);
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  localStorage.setItem("ac-dle:theme", next);
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  if (dom.themeToggle) {
    dom.themeToggle.textContent = theme === "light" ? "Mode sombre" : "Mode clair";
  }
}

async function fetchJson(url, options = undefined) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}
