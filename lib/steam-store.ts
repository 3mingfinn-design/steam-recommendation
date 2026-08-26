import steamGamesJson from "@/data/steam-games.json";
import { translateGenre, translateSteamTag } from "@/lib/steam-analysis";
import type { AnalysisDimension } from "@/lib/steam-analysis";

export type SteamStoreGame = {
  appid: number;
  name: string;
  shortDescription: string;
  headerImage: string;
  capsuleImage: string;
  storeUrl: string;
  tags: string[];
  genres: string[];
  isFree: boolean;
  price: string;
  releaseDate: string;
  lastModified: number;
  recommendationTotal: number;
  ignScore?: number;
  ignUrl: string;
};

export const STORE_PREFILTER_LIMIT = 80;

const indexedGames = steamGamesJson as SteamStoreGame[];

function getCandidateKeywords(game: SteamStoreGame) {
  return new Set([
    ...game.genres.map(translateGenre),
    ...game.tags.map(translateSteamTag),
  ]);
}

function getPrefilterScore(game: SteamStoreGame, dimensions: AnalysisDimension[], recentDimensions: AnalysisDimension[]) {
  const candidateKeywords = getCandidateKeywords(game);
  return dimensions.reduce((total, dimension) => {
    const recentDimension = recentDimensions.find((item) => item.key === dimension.key);
    const historicalScore = dimension.keywords
      .filter((keyword) => candidateKeywords.has(keyword.name))
      .reduce((sum, keyword) => sum + keyword.share, 0);
    const recentScore = (recentDimension?.keywords ?? [])
      .filter((keyword) => candidateKeywords.has(keyword.name))
      .reduce((sum, keyword) => sum + keyword.share, 0);
    return total + historicalScore * 0.4 + recentScore * 0.6;
  }, 0);
}

export function getStoreCandidates(excludedAppIds: Set<number>, dimensions: AnalysisDimension[], recentDimensions: AnalysisDimension[]) {
  return indexedGames
    .filter((game) => !excludedAppIds.has(game.appid))
    .map((game) => ({ game, prefilterScore: getPrefilterScore(game, dimensions, recentDimensions) }))
    .sort((first, second) => second.prefilterScore - first.prefilterScore || second.game.recommendationTotal - first.game.recommendationTotal)
    .slice(0, STORE_PREFILTER_LIMIT)
    .map(({ game }) => game);
}

export function getStoreIndexStatus() {
  return {
    indexedGames: indexedGames.length,
    prefilterLimit: STORE_PREFILTER_LIMIT,
  };
}
