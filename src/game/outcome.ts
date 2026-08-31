import {
  COHESION_WIN,
  COVERAGE_LOSS,
  COVERAGE_WIN,
  EPILOGUES,
  FORK_LOSS_SHARE,
} from "./content";
import { cohesion, coverage } from "./graph";
import type { GameState, Outcome } from "./types";

/** The dual condition is the thesis: infrastructure and social fabric are one pool. */
export function evaluate(state: GameState): Outcome {
  const cov = coverage(state);
  const coh = cohesion(state);
  const forkShare = state.seceded.length / state.sites.length;

  let ending: Outcome["ending"];
  if (forkShare > FORK_LOSS_SHARE) ending = "lose-fork";
  else if (cov < COVERAGE_LOSS) ending = "lose-coverage";
  else if (cov >= COVERAGE_WIN && coh >= COHESION_WIN) ending = "win";
  else if (cov >= COVERAGE_WIN) ending = "partial-network";
  else ending = "partial-community";

  return {
    ending,
    coverage: cov,
    cohesion: coh,
    epilogue: EPILOGUES[ending] ?? "",
  };
}

export function endingTitle(ending: Outcome["ending"]): string {
  switch (ending) {
    case "win":
      return "The co-op holds, and so does the network";
    case "partial-network":
      return "You built a network";
    case "partial-community":
      return "You kept the room";
    case "lose-fork":
      return "The co-op forks";
    case "lose-coverage":
      return "The map stays dark";
  }
}
