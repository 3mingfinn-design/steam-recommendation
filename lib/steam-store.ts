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

const gameKeywords = new Map<number, Set<string>>();
const keywordToAppIds = new Map<string, Set<number>>();

for (const game of indexedGames) {
  const keywords = new Set([
    ...game.genres.map(translateGenre),
    ...game.tags.map(translateSteamTag),
  ]);
  gameKeywords.set(game.appid, keywords);
  for (const keyword of keywords) {
    const appIds = keywordToAppIds.get(keyword) ?? new Set<number>();
    appIds.add(game.appid);
    keywordToAppIds.set(keyword, appIds);
  }
}

function getPrefilterScore(game: SteamStoreGame, dimensions: AnalysisDimension[], recentDimensions: AnalysisDimension[]) {
  const candidateKeywords = gameKeywords.get(game.appid) ?? new Set<string>();
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
  const preferredKeywords = new Set(
    [...dimensions, ...recentDimensions].flatMap((dimension) => dimension.keywords.map((keyword) => keyword.name)),
  );
  const matchedAppIds = new Set<number>();
  for (const keyword of preferredKeywords) {
    for (const appid of keywordToAppIds.get(keyword) ?? []) matchedAppIds.add(appid);
  }

  const sourceGames = matchedAppIds.size >= STORE_PREFILTER_LIMIT
    ? indexedGames.filter((game) => matchedAppIds.has(game.appid))
    : indexedGames;

  return sourceGames
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
    indexedKeywords: keywordToAppIds.size,
  };
}
