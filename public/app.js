const dom = {
  day: document.getElementById("day"),
  input: document.getElementById("guess-input"),
  list: document.getElementById("character-list"),
  button: document.getElementById("guess-btn"),
  message: document.getElementById("message"),
  results: document.getElementById("results"),
  guessBox: document.getElementById("guess-box")
};

let state = {
  day: "",
  attempts: [],
  done: false,
  names: []
};

init().catch((error) => {
  setMessage(`Erreur d'initialisation: ${error.message}`);
});

async function init() {
  const daily = await fetchJson("/api/daily");
  const characters = await fetchJson("/api/characters");

  state.day = daily.day;
  state.names = characters.characters;

  dom.day.textContent = `Jour: ${state.day}`;
  updateDatalist("");

  restoreState();
  renderResults();
  updateUiLock();

  dom.button.addEventListener("click", submitGuess);
  dom.input.addEventListener("input", (event) => {
    updateDatalist(event.target.value);
  });
  dom.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitGuess();
    }
  });
}

function updateDatalist(query) {
  const normalizedQuery = normalizeText(query);
  const names = !normalizedQuery
    ? []
    : state.names.filter((name) => normalizeText(name).startsWith(normalizedQuery)).slice(0, 20);

  dom.list.innerHTML = "";
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    dom.list.appendChild(option);
  }
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
      body: JSON.stringify({ guess: guessValue })
    });

    state.attempts.push(response);
    dom.input.value = "";
    updateDatalist("");
    setMessage("");

    if (response.isCorrect) {
      state.done = true;
      setMessage("Bravo, personnage trouvé.", true);
    }

    persistState();
    renderResults();
    updateUiLock();
  } catch (error) {
    setMessage(error.message || "Erreur lors du guess.");
  }
}

function renderResults() {
  dom.results.innerHTML = "";

  for (const attempt of state.attempts) {
    const row = document.createElement("div");
    row.className = "grid";

    const cells = [
      [attempt.guess.name, attempt.feedback.name],
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
  return `ac-dle:${state.day}`;
}

function persistState() {
  localStorage.setItem(storageKey(), JSON.stringify({
    attempts: state.attempts,
    done: state.done
  }));
}

function restoreState() {
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

function updateUiLock() {
  const locked = state.done;
  dom.input.disabled = locked;
  dom.button.disabled = locked;
}

async function fetchJson(url, options = undefined) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

