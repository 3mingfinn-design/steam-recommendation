import { translateGenre, translateSteamTag } from "@/lib/steam-analysis";
import type { AnalysisDimension, SteamGame } from "@/lib/steam-analysis";
import type { SteamStoreGame } from "@/lib/steam-store";

type RecommendationScore = {
  score: number;
  matchedKeywords: string[];
  reason: string;
  dimensionMatches: Array<{ dimension: string; keyword: string | null; score: number }>;
};

export type SteamRecommendation = SteamStoreGame & RecommendationScore;

export type LibraryRecommendation = SteamGame & RecommendationScore;

const dimensionWeights: Record<AnalysisDimension["key"], number> = {
  type: 0.35,
  playstyle: 0.3,
  contentStyle: 0.2,
  theme: 0.15,
};

export const RECOMMENDATION_LIMIT = 15;

function getStoreCandidateKeywords(game: SteamStoreGame) {
  return new Set([
    ...game.genres.map(translateGenre),
    ...game.tags.map(translateSteamTag),
  ]);
}

function getLibraryCandidateKeywords(game: SteamGame) {
  return new Set([
    ...(game.genres ?? []).map((genre) => translateGenre(genre.description)),
    ...(game.tags ?? []).map(translateSteamTag),
  ]);
}

function scoreCandidate(candidateKeywords: Set<string>, dimensions: AnalysisDimension[], recentDimensions: AnalysisDimension[]): RecommendationScore {
  const matches = dimensions.map((dimension) => {
    const recentDimension = recentDimensions.find((item) => item.key === dimension.key);
    const match = dimension.keywords.find((keyword) => candidateKeywords.has(keyword.name));
    const recentMatch = recentDimension?.keywords.find((keyword) => candidateKeywords.has(keyword.name));
    const weightedShare = Math.round(((match?.share ?? 0) * 0.4 + (recentMatch?.share ?? 0) * 0.6) * 10) / 10;
    return { dimension, match: match ?? recentMatch, weightedShare };
  });
  const score = Math.min(99, Math.max(1, Math.round(matches.reduce((total, item) => total + item.weightedShare * dimensionWeights[item.dimension.key], 0))));
  const matchedKeywords = matches.filter((item) => item.match).map((item) => item.match?.name ?? "");
  return {
    score,
    matchedKeywords,
    reason: matchedKeywords.length
      ? `四维偏好命中${matchedKeywords.length}/4：${matchedKeywords.slice(0, 3).join("、")}`
      : "与当前偏好方向相近，值得探索",
    dimensionMatches: matches.map((item) => ({ dimension: item.dimension.label, keyword: item.match?.name ?? null, score: item.weightedShare })),
  };
}

function prioritizeRanked<T extends RecommendationScore>(ranked: T[]) {
  ranked.sort((first, second) => second.score - first.score || second.matchedKeywords.length - first.matchedKeywords.length);
  const qualified = ranked.filter((game) => game.matchedKeywords.length >= 2);
  const fallback = ranked.filter((game) => !qualified.includes(game));
  return [...qualified, ...fallback].slice(0, RECOMMENDATION_LIMIT);
}

export function rankStoreCandidates(candidates: SteamStoreGame[], dimensions: AnalysisDimension[], recentDimensions: AnalysisDimension[] = []): SteamRecommendation[] {
  return prioritizeRanked(candidates.map((game) => ({ ...game, ...scoreCandidate(getStoreCandidateKeywords(game), dimensions, recentDimensions) })));
}

export function rankLibraryCandidates(candidates: SteamGame[], dimensions: AnalysisDimension[], recentDimensions: AnalysisDimension[] = []): LibraryRecommendation[] {
  return prioritizeRanked(candidates
    .filter((game) => game.playtime_forever === 0)
    .map((game) => ({ ...game, ...scoreCandidate(getLibraryCandidateKeywords(game), dimensions, recentDimensions) })));
}
