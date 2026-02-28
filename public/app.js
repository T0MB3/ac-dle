const dom = {
  day: document.getElementById("day"),
  input: document.getElementById("guess-input"),
  suggestions: document.getElementById("suggestions"),
  button: document.getElementById("guess-btn"),
  replayButton: document.getElementById("replay-btn"),
  themeToggle: document.getElementById("theme-toggle"),
  missionCode: document.getElementById("mission-code"),
  triesCount: document.getElementById("tries-count"),
  gameStatus: document.getElementById("game-status"),
  message: document.getElementById("message"),
  results: document.getElementById("results")
};

let state = {
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

  await startNewGame();
  hideSuggestions();
  restoreState();
  renderResults();
  updateUiLock();
  updateHud();

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

async function startNewGame() {
  const game = await fetchJson("/api/new-game", { method: "POST" });
  state.gameId = game.gameId;
  dom.day.textContent = "Mode test actif - personnage random a chaque replay.";
  updateHud();
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

  const guessValue = dom.input.value.trim();
  if (!guessValue) {
    setMessage("Entre un nom de personnage.");
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

  for (const attempt of state.attempts) {
    const row = document.createElement("div");
    row.className = "grid";

    row.appendChild(buildNameCell(attempt.guess, attempt.feedback.name));

    const cells = [
      [attempt.guess.first_game, attempt.feedback.first_game],
      [formatYear(attempt.guess.year, attempt.feedback.year), attempt.feedback.year],
      [attempt.guess.region, attempt.feedback.region],
      [attempt.guess.faction, attempt.feedback.faction],
      [attempt.guess.gender, attempt.feedback.gender],
      [attempt.guess.is_historical ? "Oui" : "Non", attempt.feedback.is_historical]
    ];

    for (const [value, status] of cells) {
      const cell = document.createElement("span");
      cell.textContent = value;
      cell.classList.add(status || "miss");
      row.appendChild(cell);
    }

    dom.results.appendChild(row);
  }
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
  return `ac-dle:test:${state.gameId}`;
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

async function fetchJson(url, options = undefined) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}
