import fs from "node:fs";

const raw = fs.readFileSync("data/ac_characters.json", "utf8").replace(/^\uFEFF/, "");
const list = JSON.parse(raw);

if (!Array.isArray(list) || list.length === 0) {
  throw new Error("data/ac_characters.json doit contenir un tableau non vide.");
}

const required = ["id", "name", "aliases", "first_game", "year", "region", "faction", "gender", "is_historical", "image_url"];

for (const [index, item] of list.entries()) {
  for (const key of required) {
    if (!(key in item)) {
      throw new Error(`Entree ${index} manquante: ${key}`);
    }
  }
}

console.log(`OK: ${list.length} personnages charges.`);
