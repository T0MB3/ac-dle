import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeText } from "./normalize.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, "../../data/ac_characters.json");

function loadCharacters() {
  const raw = fs.readFileSync(DATA_PATH, "utf8").replace(/^\uFEFF/, "");
  const characters = JSON.parse(raw);
  if (!Array.isArray(characters) || characters.length === 0) {
    throw new Error("Character data is empty or invalid.");
  }
  return characters;
}

export function getAllCharacters() {
  return loadCharacters();
}

export function sanitizeCharacter(character) {
  const { image_url, ...rest } = character;
  return { ...rest, image_url: image_url ?? "" };
}

export function buildSearchIndex(characters) {
  const index = new Map();

  for (const character of characters) {
    const keys = [character.id, character.name, ...(character.aliases ?? [])];
    for (const key of keys) {
      const normalized = normalizeText(key);
      if (normalized) {
        index.set(normalized, character);
      }
    }
  }

  return index;
}

export function findCharacterByInput(input, index) {
  const normalized = normalizeText(input);
  if (!normalized) {
    return null;
  }
  return index.get(normalized) ?? null;
}

export function getCharacterOfDay(characters, date = new Date()) {
  const dayKey = date.toISOString().slice(0, 10);
  const hash = simpleHash(dayKey);
  const selectedIndex = Math.abs(hash) % characters.length;
  return {
    dayKey,
    index: selectedIndex,
    character: characters[selectedIndex]
  };
}

function simpleHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
