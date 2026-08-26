export type SteamGenre = {
  description: string;
};

export type SteamGame = {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url?: string;
  img_logo_url?: string;
  genres?: SteamGenre[];
  tags?: string[];
  last_played?: number;
};

export type GenreKeyword = {
  name: string;
  minutes: number;
  share: number;
};

export type AnalysisDimension = {
  key: "type" | "playstyle" | "contentStyle" | "theme";
  label: string;
  keywords: GenreKeyword[];
};

export type AnalysisSource = {
  name: string;
  url: string;
  role: string;
  note: string;
};

export type PreferenceSignal = {
  dimension: string;
  name: string;
  share: number;
};

export type SteamAnalysis = {
  profile: {
    steamid: string;
    personaname: string;
    profileurl?: string;
    avatarfull?: string;
  } | null;
  ownedGames: SteamGame[];
  recentGames: SteamGame[];
  historicalKeywords: GenreKeyword[];
  recentKeywords: GenreKeyword[];
  dimensions: AnalysisDimension[];
  recentDimensions: AnalysisDimension[];
  preferenceMix: GenreKeyword[];
  sources: AnalysisSource[];
  trend: {
    summary: string;
    signals: PreferenceSignal[];
  };
};

type SteamPlayerSummary = {
  steamid: string;
  personaname: string;
  profileurl?: string;
  avatarfull?: string;
};

type OwnedGamesResponse = {
  response?: { games?: SteamGame[] };
};

type PlayerSummaryResponse = {
  response?: { players?: SteamPlayerSummary[] };
};

type StoreDetailsResponse = Record<string, { success?: boolean; data?: { genres?: SteamGenre[] } }>;

type RecentlyPlayedResponse = {
  response?: { games?: SteamGame[] };
};

const steamApiBase = "https://api.steampowered.com";
const steamStoreBase = "https://store.steampowered.com/api/appdetails";

const genreTranslations: Record<string, string> = {
  Action: "动作",
  Adventure: "冒险",
  Casual: "休闲",
  "Early Access": "抢先体验",
  Indie: "独立游戏",
  "Free to Play": "免费游玩",
  "Massively Multiplayer": "大型多人在线",
  RPG: "角色扮演",
  Racing: "竞速",
  Simulation: "模拟",
  Sports: "体育",
  Strategy: "策略",
  Violent: "暴力",
  Gore: "血腥",
  Nudity: "裸露",
  "Sexual Content": "成人内容",
  Utilities: "实用工具",
  "Design & Illustration": "设计与插画",
  Education: "教育",
  "Audio Production": "音频制作",
  "Animation & Modeling": "动画与建模",
  "Photo Editing": "照片编辑",
  "Video Production": "视频制作",
  "Web Publishing": "网页发布",
  "Game Development": "游戏开发",
};

export function translateGenre(genre: string) {
  return genreTranslations[genre] ?? genre;
}

export class SteamVisibilityError extends Error {}

export class SteamIdentifierError extends Error {}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`Steam request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

async function getGenres(appid: number): Promise<SteamGenre[]> {
  try {
    const url = `${steamStoreBase}?appids=${appid}&l=english`;
    const result = await fetchJson<StoreDetailsResponse>(url);
    return result[String(appid)]?.data?.genres ?? [];
  } catch {
    return [];
  }
}

async function getStoreTags(appid: number): Promise<string[]> {
  try {
    const response = await fetch(`https://store.steampowered.com/app/${appid}/?l=english`, {
      next: { revalidate: 3600 },
      headers: { "user-agent": "SteamGuide/1.0" },
    });
    if (!response.ok) return [];
    const html = await response.text();
    const tags = [...html.matchAll(/class="app_tag"[^>]*>\s*([^<]+?)\s*<\/a>/g)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    return [...new Set(tags)].slice(0, 8);
  } catch {
    return [];
  }
}

async function resolveSteamId(identifier: string, apiKey: string): Promise<string> {
  const value = identifier.trim();
  if (/^\d{5,20}$/.test(value)) return value;

  let vanity = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.hostname.toLowerCase() !== "steamcommunity.com") throw new Error("Unsupported host");
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 2 || !["id", "profiles"].includes(parts[0].toLowerCase())) throw new Error("Unsupported profile URL");
      if (parts[0].toLowerCase() === "profiles" && /^\d{5,20}$/.test(parts[1])) return parts[1];
      vanity = parts[1];
    } catch {
      throw new SteamIdentifierError("Invalid Steam profile URL");
    }
  }
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(vanity)) throw new SteamIdentifierError("Invalid Steam custom ID");

  const query = new URLSearchParams({ key: apiKey, vanityurl: vanity, url_type: "1", format: "json" });
  const result = await fetchJson<{ response?: { success?: number; steamid?: string } }>(`${steamApiBase}/ISteamUser/ResolveVanityURL/v0001/?${query}`);
  if (result.response?.success !== 1 || !result.response.steamid) throw new SteamIdentifierError("Steam custom ID was not found");
  return result.response.steamid;
}

async function enrichGenres(games: SteamGame[]): Promise<SteamGame[]> {
  const enriched: SteamGame[] = [];
  for (let index = 0; index < games.length; index += 8) {
    const batch = games.slice(index, index + 8);
    enriched.push(
      ...(await Promise.all(
        batch.map(async (game) => ({
          ...game,
          genres: await getGenres(game.appid),
          tags: await getStoreTags(game.appid),
        })),
      )),
    );
  }
  return enriched;
}

function buildKeywords(games: SteamGame[], minutesKey: "playtime_forever" | "playtime_2weeks") {
  const totals = new Map<string, number>();
  for (const game of games) {
    const minutes = game[minutesKey] ?? 0;
    for (const genre of game.genres ?? []) {
      const name = translateGenre(genre.description);
      totals.set(name, (totals.get(name) ?? 0) + minutes);
    }
  }

  const totalMinutes = [...totals.values()].reduce((total, minutes) => total + minutes, 0) || 1;
  return [...totals.entries()]
    .sort(([, first], [, second]) => second - first)
    .slice(0, 6)
    .map(([name, minutes]) => ({ name, minutes, share: Math.round((minutes / totalMinutes) * 100) }));
}

const dimensionLabels = {
  type: "游戏类型",
  playstyle: "游戏玩法",
  contentStyle: "内容风格",
  theme: "游戏题材",
} as const;

const dimensionTaxonomy: Record<AnalysisDimension["key"], Record<string, string>> = {
  type: {
    Action: "动作", Adventure: "冒险", Casual: "休闲", Indie: "独立游戏", RPG: "角色扮演", Racing: "竞速", Simulation: "模拟", Sports: "体育", Strategy: "策略", "Free to Play": "免费游玩", "Early Access": "抢先体验",
  },
  playstyle: {
    Singleplayer: "单人", Multiplayer: "多人", "Online Co-Op": "在线合作", "Co-op": "合作", PvP: "玩家对战", "Open World": "开放世界", Sandbox: "沙盒", "Turn-Based": "回合制", "Real Time": "实时制", "First-Person": "第一人称", "Third Person": "第三人称", "Point & Click": "点击探索", "Character Customization": "角色自定义",
  },
  contentStyle: {
    "Story Rich": "剧情丰富", Atmospheric: "氛围感", Relaxing: "轻松治愈", Funny: "幽默", Cute: "可爱", Dark: "黑暗", Horror: "恐怖", Psychological: "心理向", "Choices Matter": "选择影响剧情", "Multiple Endings": "多结局", "Emotional": "情感浓厚", "Replay Value": "重复游玩价值高",
  },
  theme: {
    Fantasy: "奇幻", "Sci-fi": "科幻", Cyberpunk: "赛博朋克", Medieval: "中世纪", Space: "太空", "Post-apocalyptic": "末日废土", Historical: "历史", Zombies: "丧尸", Survival: "生存", Military: "军事", Anime: "动漫风", Nature: "自然", Pirates: "海盗", Western: "西部",
  },
};

export function translateSteamTag(tag: string) {
  for (const taxonomy of Object.values(dimensionTaxonomy)) {
    if (taxonomy[tag]) return taxonomy[tag];
  }
  return translateGenre(tag);
}

function buildDimensions(games: SteamGame[]): AnalysisDimension[] {
  return (Object.keys(dimensionLabels) as AnalysisDimension["key"][]).map((key) => {
    const totals = new Map<string, number>();
    for (const game of games) {
      const weight = game.playtime_forever || 1;
      const labels = [
        ...(key === "type" ? (game.genres ?? []).map((genre) => translateGenre(genre.description)) : []),
        ...(game.tags ?? []).map((tag) => dimensionTaxonomy[key][tag]).filter((value): value is string => Boolean(value)),
      ];
      for (const label of new Set(labels)) totals.set(label, (totals.get(label) ?? 0) + weight);
    }
    const total = [...totals.values()].reduce((sum, value) => sum + value, 0) || 1;
    const keywords = [...totals.entries()].sort(([, first], [, second]) => second - first).slice(0, 8).map(([name, minutes]) => ({ name, minutes, share: Math.round((minutes / total) * 1000) / 10 }));
    return { key, label: dimensionLabels[key], keywords };
  });
}

const analysisSources: AnalysisSource[] = [
  { name: "Steam Web API", url: "https://partner.steamgames.com/doc/webapi/IPlayerService", role: "实际数据源", note: "用户公开游戏库、累计游玩时间和最近两周游玩数据。" },
  { name: "Steam Store 标签", url: "https://store.steampowered.com/", role: "实际数据源", note: "用于生成玩法、内容风格和题材维度。" },
  { name: "IGN Games", url: "https://www.ign.com/games", role: "参考来源", note: "用于参考游戏分类与评价语境；不复制评论正文或评分。" },
  { name: "哔哩哔哩游戏视频", url: "https://search.bilibili.com/all?keyword=游戏推荐", role: "参考来源", note: "后续仅纳入粉丝数超过 50 万且可核验的视频；当前不引用未经核实的 UP 主观点。" },
];

function buildDimensionTrend(dimensions: AnalysisDimension[]) {
  const signals = dimensions.flatMap((dimension) => dimension.keywords.slice(0, 2).map((keyword) => ({ dimension: dimension.label, name: keyword.name, share: keyword.share })));
  const highlights = dimensions
    .filter((dimension) => dimension.keywords.length)
    .map((dimension) => `${dimension.label}偏向${dimension.keywords[0].name}（${dimension.keywords[0].share}%）`);
  const strongest = [...signals].sort((first, second) => second.share - first.share).slice(0, 2);
  const summary = highlights.length
    ? `综合你的游戏库与累计游玩时间，你的偏好大致可以概括为：${highlights.join("，")}。其中${strongest.map((signal) => `${signal.dimension}中的${signal.name}`).join("和")}是最突出的信号，说明你通常更容易被这类游戏体验吸引。`
    : "暂无足够的公开标签数据来判断多维偏好趋势。";
  return { summary, signals };
}

function buildPreferenceMix(dimensions: AnalysisDimension[]) {
  const candidates = dimensions.flatMap((dimension) => dimension.keywords.slice(0, 2).map((keyword) => ({ ...keyword, name: `${dimension.label} · ${keyword.name}` })));
  const total = candidates.reduce((sum, keyword) => sum + keyword.minutes, 0) || 1;
  return candidates.sort((first, second) => second.minutes - first.minutes).slice(0, 8).map((keyword) => ({ ...keyword, share: Math.round((keyword.minutes / total) * 100) }));
}

export async function analyzeSteamUser(steamid: string, apiKey: string): Promise<SteamAnalysis> {
  const resolvedSteamId = await resolveSteamId(steamid, apiKey);
  const params = new URLSearchParams({ key: apiKey, steamid: resolvedSteamId });
  const summaryUrl = `${steamApiBase}/ISteamUser/GetPlayerSummaries/v0002/?${new URLSearchParams({ key: apiKey, steamids: resolvedSteamId })}`;
  const ownedUrl = `${steamApiBase}/IPlayerService/GetOwnedGames/v0001/?${new URLSearchParams({ ...Object.fromEntries(params), include_appinfo: "1", include_played_free_games: "1", format: "json" })}`;
  const recentUrl = `${steamApiBase}/IPlayerService/GetRecentlyPlayedGames/v0001/?${params}`;

  const [summary, owned, recent] = await Promise.all([
    fetchJson<PlayerSummaryResponse>(summaryUrl),
    fetchJson<OwnedGamesResponse>(ownedUrl),
    fetchJson<RecentlyPlayedResponse>(recentUrl),
  ]);

  const ownedGames = owned.response?.games ?? [];
  const recentGames = recent.response?.games ?? [];
  const hasOwnedGamesField = Object.prototype.hasOwnProperty.call(owned.response ?? {}, "games");
  const hasRecentGamesField = Object.prototype.hasOwnProperty.call(recent.response ?? {}, "games");
  if (!summary.response?.players?.[0] || (!hasOwnedGamesField && !hasRecentGamesField)) {
    throw new SteamVisibilityError("Steam profile or library is private");
  }
  const byAppid = new Map<number, SteamGame>();
  for (const game of [...ownedGames, ...recentGames]) byAppid.set(game.appid, { ...byAppid.get(game.appid), ...game });

  const genreTargets = [...byAppid.values()]
    .sort((first, second) => (second.playtime_forever + (second.playtime_2weeks ?? 0)) - (first.playtime_forever + (first.playtime_2weeks ?? 0)));
  const enriched = await enrichGenres(genreTargets);
  const enrichedByAppid = new Map(enriched.map((game) => [game.appid, game]));
  const withGenres = (game: SteamGame) => enrichedByAppid.get(game.appid) ?? game;
  const sortedOwned = ownedGames.map(withGenres).sort((first, second) => second.playtime_forever - first.playtime_forever);
  const sortedRecent = recentGames.map(withGenres).sort((first, second) => (second.playtime_2weeks ?? 0) - (first.playtime_2weeks ?? 0));
  const historicalKeywords = buildKeywords(sortedOwned, "playtime_forever");
  const recentKeywords = buildKeywords(sortedRecent, "playtime_2weeks");
  const dimensions = buildDimensions(sortedOwned);
  const recentDimensions = buildDimensions(sortedRecent);

  return {
    profile: summary.response?.players?.[0] ?? null,
    ownedGames: sortedOwned,
    recentGames: sortedRecent,
    historicalKeywords,
    recentKeywords,
    dimensions,
    recentDimensions,
    preferenceMix: buildPreferenceMix(dimensions),
    sources: analysisSources,
    trend: buildDimensionTrend(dimensions),
  };
}
