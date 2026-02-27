export function compareGuess(guess, answer) {
  return {
    name: guess.name === answer.name ? "match" : "miss",
    first_game: guess.first_game === answer.first_game ? "match" : "miss",
    year: guess.year === answer.year ? "match" : guess.year < answer.year ? "higher" : "lower",
    region: guess.region === answer.region ? "match" : "miss",
    faction: guess.faction === answer.faction ? "match" : "miss",
    gender: guess.gender === answer.gender ? "match" : "miss",
    is_historical: guess.is_historical === answer.is_historical ? "match" : "miss"
  };
}
