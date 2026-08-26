import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const dataDirectory = path.join(projectRoot, "data");
const appsPath = path.join(dataDirectory, "steam-apps.json");
const gamesPath = path.join(dataDirectory, "steam-games.json");
const statePath = path.join(dataDirectory, "steam-sync-state.json");
const apiKey = process.env.STEAM_API_KEY?.trim();
const detailLimit = Math.max(1, Number.parseInt(process.env.STEAM_SYNC_DETAIL_LIMIT ?? "100", 10) || 100);
const priorityAppIds = [
  620, 413150, 292030, 1086940, 1245620, 1174180, 271590, 230410,
  570, 440, 289070, 255710, 594570, 367520, 648800, 526870,
  105600, 252490, 1966720, 739630, 1091500, 1145360, 1222670, 322330,
  400, 550, 730, 221380, 236850, 238960, 294100, 346110,
  444090, 582010, 812140, 976730, 1250410, 108600, 227300, 239140,
];
const priorityOrder = new Map(priorityAppIds.map((appid, index) => [appid, index]));

const ignReviewCatalog = {
  620: { score: 9.5, url: "https://www.ign.com/articles/2011/04/18/portal-2-review" },
  105600: { score: 9, url: "https://www.ign.com/articles/2011/05/17/terraria-review" },
  1091500: { score: 9, url: "https://www.ign.com/articles/cyberpunk-2077-review" },
  1174180: { score: 10, url: "https://www.ign.com/articles/2018/10/25/red-dead-redemption-2-review" },
  292030: { score: 9.3, url: "https://www.ign.com/articles/2015/05/12/the-witcher-3-wild-hunt-review" },
  1245620: { score: 10, url: "https://www.ign.com/articles/elden-ring-review" },
  1086940: { score: 10, url: "https://www.ign.com/articles/baldurs-gate-3-review" },
  367520: { score: 9.4, url: "https://www.ign.com/articles/2018/06/22/hollow-knight-review" },
};

const ignSlugOverrides = {
  292030: "the-witcher-3-wild-hunt",
  1086940: "baldurs-gate-3",
  1174180: "red-dead-redemption-2",
  1245620: "elden-ring",
  367520: "hollow-knight",
};

function getIgnMetadata(appid, name) {
  const knownReview = ignReviewCatalog[appid];
  const slug = ignSlugOverrides[appid] ?? name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    ...(knownReview?.score ? { ignScore: knownReview.score } : {}),
    ignUrl: knownReview?.url ?? `https://www.ign.com/games/${slug}`,
  };
}

if (!apiKey) throw new Error("STEAM_API_KEY is missing. Add it to .env.local before syncing.");

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function saveJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fetchJson(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "SteamGuideIndexer/1.0" },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Steam request failed: ${response.status} ${url.origin}${url.pathname}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

async function fetchCatalog(previousApps, lastCatalogSync) {
  const incremental = previousApps.length > 0 && lastCatalogSync > 0;
  const changedApps = [];
  let lastAppid = 0;
  let haveMoreResults = true;

  while (haveMoreResults) {
    const input = {
      include_games: true,
      include_dlc: false,
      include_software: false,
      include_videos: false,
      include_hardware: false,
      max_results: 50000,
      last_appid: lastAppid,
      ...(incremental ? { if_modified_since: lastCatalogSync } : {}),
    };
    const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("input_json", JSON.stringify(input));
    const result = await fetchJson(url);
    const response = result.response ?? {};
    const page = response.apps ?? [];
    changedApps.push(...page.map((app) => ({
      appid: Number(app.appid),
      name: app.name ?? "",
      last_modified: Number(app.last_modified ?? 0),
      price_change_number: Number(app.price_change_number ?? 0),
    })).filter((app) => Number.isFinite(app.appid) && app.appid > 0));
    haveMoreResults = Boolean(response.have_more_results) && page.length > 0;
    lastAppid = Number(response.last_appid ?? page.at(-1)?.appid ?? 0);
  }

  const merged = new Map(previousApps.map((app) => [app.appid, app]));
  for (const app of changedApps) merged.set(app.appid, app);
  return { apps: [...merged.values()].sort((first, second) => first.appid - second.appid), changed: changedApps.length, incremental };
}

async function fetchStoreTags(appid) {
  try {
    const response = await fetch(`https://store.steampowered.com/app/${appid}/?l=english`, {
      headers: { "user-agent": "SteamGuideIndexer/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    return [...html.matchAll(/class="app_tag"[^>]*>\s*([^<]+?)\s*<\/a>/g)]
      .map((match) => match[1].trim())
      .filter(Boolean)
      .filter((tag, index, tags) => tags.indexOf(tag) === index)
      .slice(0, 20);
  } catch {
    return [];
  }
}

async function fetchGameDetails(app) {
  try {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", String(app.appid));
    url.searchParams.set("l", "english");
    url.searchParams.set("cc", "cn");
    const result = await fetchJson(url);
    const data = result[String(app.appid)]?.data;
    const isGame = data?.type === "game";
    const isReleased = !data?.release_date?.coming_soon;
    const isPurchasable = Boolean(data?.is_free || data?.price_overview?.final > 0);
    if (!data?.name || !isGame || !isReleased || !isPurchasable) return { status: "excluded", game: null };

    return {
      status: "indexed",
      game: {
        appid: app.appid,
        name: data.name,
        shortDescription: data.short_description ?? "",
        headerImage: data.header_image ?? "",
        capsuleImage: data.capsule_image ?? "",
        storeUrl: `https://store.steampowered.com/app/${app.appid}/`,
        tags: await fetchStoreTags(app.appid),
        genres: (data.genres ?? []).map((genre) => genre.description).filter(Boolean),
        isFree: Boolean(data.is_free),
        price: data.is_free ? "免费" : data.price_overview?.final_formatted ?? "价格以 Steam 商店为准",
        releaseDate: data.release_date?.date ?? "",
        lastModified: app.last_modified,
        recommendationTotal: Number(data.recommendations?.total ?? 0),
        ...getIgnMetadata(app.appid, data.name),
      },
    };
  } catch {
    return { status: "failed", game: null };
  }
}

async function mapInBatches(items, size, mapper) {
  const results = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(...await Promise.all(items.slice(index, index + size).map(mapper)));
  }
  return results;
}

await mkdir(dataDirectory, { recursive: true });
const [previousApps, previousGames, previousState] = await Promise.all([
  readJson(appsPath, []),
  readJson(gamesPath, []),
  readJson(statePath, { lastCatalogSync: 0, details: {} }),
]);

const syncStartedAt = Math.floor(Date.now() / 1000);
let catalog;
let catalogSynced = true;
try {
  catalog = await fetchCatalog(previousApps, Number(previousState.lastCatalogSync ?? 0));
} catch (error) {
  if (!previousApps.length) throw error;
  catalogSynced = false;
  catalog = { apps: previousApps, changed: 0, incremental: true };
  console.warn("Steam catalog update failed; continuing detail indexing with the last complete catalog.");
}
await saveJson(appsPath, catalog.apps);

const detailsState = previousState.details ?? {};
const pending = catalog.apps
  .filter((app) => Number(detailsState[String(app.appid)]?.lastModified ?? -1) < app.last_modified)
  .sort((first, second) => {
    const firstPriority = priorityOrder.get(first.appid) ?? Number.MAX_SAFE_INTEGER;
    const secondPriority = priorityOrder.get(second.appid) ?? Number.MAX_SAFE_INTEGER;
    return firstPriority - secondPriority || second.last_modified - first.last_modified;
  })
  .slice(0, detailLimit);

const results = await mapInBatches(pending, 6, fetchGameDetails);
const gamesById = new Map(previousGames.map((game) => [game.appid, game]));
results.forEach((result, index) => {
  const app = pending[index];
  if (result.game) gamesById.set(app.appid, result.game);
  if (result.status === "excluded") gamesById.delete(app.appid);
  if (result.status !== "failed") detailsState[String(app.appid)] = { lastModified: app.last_modified, status: result.status };
});

const games = [...gamesById.values()]
  .map((game) => ({ ...game, ...getIgnMetadata(game.appid, game.name) }))
  .sort((first, second) => second.recommendationTotal - first.recommendationTotal || first.appid - second.appid);
await Promise.all([
  saveJson(gamesPath, games),
  saveJson(statePath, { lastCatalogSync: catalogSynced ? syncStartedAt : previousState.lastCatalogSync, details: detailsState }),
]);

const indexedThisRun = results.filter((result) => result.status === "indexed").length;
const excludedThisRun = results.filter((result) => result.status === "excluded").length;
const failedThisRun = results.filter((result) => result.status === "failed").length;
console.log(JSON.stringify({
  catalogMode: catalog.incremental ? "incremental" : "full",
  catalogSynced,
  catalogApps: catalog.apps.length,
  catalogChanged: catalog.changed,
  detailLimit,
  detailProcessed: pending.length,
  indexedThisRun,
  excludedThisRun,
  failedThisRun,
  indexedGames: games.length,
}, null, 2));
