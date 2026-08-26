"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { translateSteamTag } from "@/lib/steam-analysis";
import type { AnalysisDimension, AnalysisSource, GenreKeyword, SteamAnalysis, SteamGame } from "@/lib/steam-analysis";
import type { LibraryRecommendation, SteamRecommendation } from "@/lib/recommendation";
import { rankLibraryCandidates, RECOMMENDATION_LIMIT } from "@/lib/recommendation";

function formatPlaytime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours.toLocaleString()} h ${remainingMinutes} min`;
}

function GameRow({ game, recent }: { game: SteamGame; recent?: boolean }) {
  const iconUrl = game.img_icon_url
    ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
    : null;

  return (
    <li className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-4 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        {iconUrl ? (
          <div
            role="img"
            aria-label={`${game.name} 游戏图标`}
            className="h-10 w-10 shrink-0 rounded-lg bg-cover bg-center shadow-inner shadow-black/30"
            style={{ backgroundImage: `url(${iconUrl})` }}
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs text-slate-500" aria-hidden="true">🎮</div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">{game.name}</p>
          <p className="mt-1 text-xs text-slate-500">App {game.appid}</p>
          {game.tags?.length ? (
            <div className="mt-2 flex max-w-[24rem] flex-wrap gap-1.5">
              {game.tags.map((tag) => <span key={tag} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-slate-400">{translateSteamTag(tag)}</span>)}
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-cyan-300">{formatPlaytime(recent ? game.playtime_2weeks ?? 0 : game.playtime_forever)}</p>
        <p className="mt-1 text-xs text-slate-500">{recent ? "最近两周" : "累计游玩"}</p>
      </div>
    </li>
  );
}

const pieColors = ["#67e8f9", "#22d3ee", "#0891b2", "#818cf8", "#a78bfa", "#c084fc", "#f0abfc", "#64748b"];

function polarPoint(center: number, radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: center + radius * Math.cos(radians), y: center + radius * Math.sin(radians) };
}

function pieSlicePath(startAngle: number, endAngle: number) {
  const center = 110;
  const radius = 82;
  const start = polarPoint(center, radius, endAngle);
  const end = polarPoint(center, radius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function DimensionPieChart({ dimension }: { dimension: AnalysisDimension }) {
  if (!dimension.keywords.length) return <p className="text-sm text-slate-500">暂无足够的公开标签数据。</p>;

  const knownShare = dimension.keywords.reduce((sum, keyword) => sum + keyword.share, 0);
  const keywords = knownShare < 100
    ? [...dimension.keywords, { name: "其他", minutes: 0, share: 100 - knownShare }]
    : dimension.keywords;
  const totalShare = keywords.reduce((sum, keyword) => sum + keyword.share, 0) || 1;
  const slices = keywords.reduce<{ items: Array<GenreKeyword & { start: number; end: number; color: string }>; cursor: number }>((result, keyword, index) => {
    const value = keyword.share / totalShare * 360;
    const slice = { ...keyword, start: result.cursor, end: result.cursor + value, color: pieColors[index % pieColors.length] };
    return { items: [...result.items, slice], cursor: result.cursor + value };
  }, { items: [], cursor: 0 }).items;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative h-52 w-52 shrink-0" role="img" aria-label={`${dimension.label}偏好比例饼图`}>
        <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible">
          {slices.map((slice) => {
            const midpoint = slice.start + (slice.end - slice.start) / 2;
            const labelPoint = polarPoint(110, 53, midpoint);
            return (
              <g key={slice.name}>
                <path d={pieSlicePath(slice.start, slice.end)} fill={slice.color} stroke="#11151f" strokeWidth="2" />
                {slice.share >= 4 ? <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-950 text-[10px] font-bold">{slice.share.toFixed(1)}%</text> : null}
              </g>
            );
          })}
          <circle cx="110" cy="110" r="31" fill="#11151f" />
          <text x="110" y="106" textAnchor="middle" className="fill-slate-300 text-[10px]">偏好</text>
          <text x="110" y="121" textAnchor="middle" className="fill-slate-500 text-[9px]">构成</text>
        </svg>
      </div>
      <div className="w-full space-y-2 sm:max-w-[13rem]">
        {slices.map((slice) => (
          <div key={slice.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-300"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} /> <span className="truncate">{slice.name}</span></span>
            <span className="shrink-0 text-slate-400">{slice.share.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisPage({ steamid, consent }: { steamid: string; consent: boolean }) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<SteamAnalysis | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"analysis" | "recommendations">("analysis");

  useEffect(() => {
    let active = true;
    fetch(`/api/analysis?steamid=${encodeURIComponent(steamid)}&consent=${consent ? "1" : "0"}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          const error = new Error(result.error ?? "分析失败") as Error & { code?: string; status?: number };
          error.code = result.code;
          error.status = response.status;
          throw error;
        }
        return result as SteamAnalysis;
      })
      .then((result) => active && setAnalysis(result))
      .catch((reason: Error & { code?: string; status?: number }) => {
        if (!active) return;
        if (reason.code === "PRIVATE_PROFILE" || reason.status === 403) {
          router.replace(`/analysis/error?reason=private`);
          return;
        }
        setError(reason.message || "分析失败，请稍后重试。");
      });
    return () => { active = false; };
  }, [consent, router, steamid]);

  if (error) {
    return <StateCard title="暂时无法完成分析" description={error} />;
  }
  if (!analysis) {
    return <StateCard title="正在分析你的 Steam 游戏库" description="正在读取公开游戏数据并整理你的偏好趋势…" loading />;
  }

  const unplayedGames = analysis.ownedGames.filter((game) => game.playtime_forever === 0);

  return (
    <main className="min-h-screen bg-[#080b12] px-6 py-8 text-slate-100 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Steam Guide / Analysis</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">你的游戏偏好报告</h1>
            <p className="mt-2 text-sm text-slate-500">{analysis.profile?.personaname ?? "Steam 玩家"} · {steamid}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1" role="tablist" aria-label="页面视图切换">
              <button type="button" role="tab" aria-selected={activeView === "analysis"} onClick={() => setActiveView("analysis")} className={`rounded-lg px-3 py-2 text-sm transition ${activeView === "analysis" ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:text-white"}`}>分析</button>
              <button type="button" role="tab" aria-selected={activeView === "recommendations"} onClick={() => setActiveView("recommendations")} className={`rounded-lg px-3 py-2 text-sm transition ${activeView === "recommendations" ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:text-white"}`}>推荐</button>
            </div>
            <Link href="/" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-300/40 hover:text-white">重新分析</Link>
          </div>
        </header>

        {activeView === "analysis" ? (
        <>
        <section className="grid gap-5 py-8 lg:grid-cols-2">
          <Panel title="游戏库" subtitle={`${analysis.ownedGames.length} 款拥有的游戏`}>
            <div className="max-h-96 overflow-y-auto pr-2">
              <GameList games={analysis.ownedGames} />
            </div>
          </Panel>
          <Panel title="最近两周活跃" subtitle={`${analysis.recentGames.length} 款近期游玩游戏 · 按时长排序`}>
            {analysis.recentGames.length ? <div className="max-h-96 overflow-y-auto pr-2"><GameList games={analysis.recentGames} recent /></div> : <p className="text-sm text-slate-500">最近两周没有公开的游玩记录。</p>}
          </Panel>
        </section>

        <Panel title="拥有但还没开始玩的游戏" subtitle={`${unplayedGames.length} 款游戏 · 累计游玩时间为 0 h 0 min`}>
          {unplayedGames.length ? (
            <div className="max-h-80 overflow-y-auto pr-2">
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {unplayedGames.map((game) => (
                  <li key={game.appid} className="flex items-center justify-between gap-3 border-b border-white/[0.07] py-3 last:border-0">
                    <div className="flex min-w-0 items-center gap-3">
                      {game.img_icon_url ? (
                        <div
                          role="img"
                          aria-label={`${game.name} 游戏图标`}
                          className="h-8 w-8 shrink-0 rounded-md bg-cover bg-center"
                          style={{ backgroundImage: `url(https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg)` }}
                        />
                      ) : <div className="h-8 w-8 shrink-0 rounded-md bg-white/10" aria-hidden="true" />}
                      <span className="truncate text-sm text-slate-300">{game.name}</span>
                    </div>
                    <span className="shrink-0 text-xs text-slate-600">0 h 0 min</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-sm text-slate-500">你的游戏库中没有尚未开始玩的游戏。</p>}
        </Panel>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">四维偏好构成比例</h2>
            <p className="mt-1 text-xs text-slate-500">每个饼图分别展示一个维度，百分比以该维度内的游玩时间权重计算</p>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            {analysis.dimensions.map((dimension) => (
              <div key={dimension.key} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
                <h3 className="mb-4 text-center text-sm font-medium text-slate-200">{dimension.label}</h3>
                <DimensionPieChart dimension={dimension} />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Multi-dimensional trend</p>
          <h2 className="mt-3 text-xl font-semibold text-white">多维用户偏好趋势</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{analysis.trend.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {analysis.trend.signals.map((signal) => <span key={`${signal.dimension}-${signal.name}`} className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-200">{signal.dimension} · {signal.name} · {signal.share}%</span>)}
          </div>
        </section>

        <SourcesPanel sources={analysis.sources} />
      </>
        ) : <RecommendationView analysis={analysis} steamid={steamid} consent={consent} />}
      </div>
    </main>
  );
}

function RecommendationView({ analysis, steamid, consent }: { analysis: SteamAnalysis; steamid: string; consent: boolean }) {
  const [recommendations, setRecommendations] = useState<SteamRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationError, setRecommendationError] = useState("");
  const focusKeywords = analysis.dimensions.flatMap((dimension) => dimension.keywords.slice(0, 1)).slice(0, 4);
  const libraryRecommendations = rankLibraryCandidates(analysis.ownedGames, analysis.dimensions, analysis.recentDimensions);

  useEffect(() => {
    let active = true;
    fetch(`/api/recommendations?steamid=${encodeURIComponent(steamid)}&consent=${consent ? "1" : "0"}`)
      .then(async (response) => {
        const result = await response.json() as { recommendations?: SteamRecommendation[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "推荐获取失败");
        return result.recommendations ?? [];
      })
      .then((result) => active && setRecommendations(result))
      .catch((reason: Error) => active && setRecommendationError(reason.message || "推荐获取失败，请稍后重试。"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [consent, steamid]);

  return (
    <section className="py-8">
      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Personalized picks</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">找到下一款想玩的游戏</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">推荐视图会以游戏类型、玩法、内容风格和题材四维偏好为主要筛选标准，结合长期与近期游玩趋势，从 Steam 商店候选中排除你已拥有的游戏。</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {focusKeywords.map((keyword) => <span key={keyword.name} className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-200">当前偏好 · {keyword.name}</span>)}
          {!focusKeywords.length && <span className="text-sm text-slate-500">暂无足够的偏好数据</span>}
        </div>
      </div>

      <div className="mt-5">
        <Panel title="Steam 商店推荐" subtitle={loading ? `正在读取商店详情并计算匹配度…（最多 ${RECOMMENDATION_LIMIT} 款）` : `${recommendations.length} 款推荐游戏 · 已排除你的游戏库`}>
          {loading ? <div className="flex items-center gap-3 py-8 text-sm text-slate-400"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" />正在整理 Steam 商店候选游戏…</div> : recommendationError ? <p className="py-4 text-sm text-rose-300">{recommendationError}</p> : recommendations.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{recommendations.map((game) => <RecommendationCard key={game.appid} game={game} />)}</div> : <p className="py-4 text-sm text-slate-500">暂时没有找到合适的商店候选游戏。</p>}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="库内优先推荐" subtitle={`${libraryRecommendations.length} 款未开始游戏 · 按四维偏好匹配度排序`}>
          {libraryRecommendations.length ? <div className="max-h-[34rem] overflow-y-auto pr-2"><ul>{libraryRecommendations.map((game) => <LibraryRecommendationRow key={game.appid} game={game} />)}</ul></div> : <p className="text-sm text-slate-500">你的库内没有待探索游戏。</p>}
        </Panel>
        <Panel title="推荐逻辑" subtitle="当前版本的推荐依据">
          <ul className="space-y-4 text-sm leading-6 text-slate-300">
            <li className="flex gap-3"><span className="text-cyan-300">01</span><span>分别比较游戏类型、玩法、内容风格和题材四个维度。</span></li>
            <li className="flex gap-3"><span className="text-cyan-300">02</span><span>近期两周偏好占 60%，长期累计偏好占 40%，共同决定维度匹配分。</span></li>
            <li className="flex gap-3"><span className="text-cyan-300">03</span><span>优先保留至少命中两个偏好维度的游戏，再按综合匹配度排序。</span></li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}

function LibraryRecommendationRow({ game }: { game: LibraryRecommendation }) {
  const iconUrl = game.img_icon_url
    ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
    : null;
  return (
    <li className="border-b border-white/[0.07] py-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {iconUrl ? <div role="img" aria-label={`${game.name} 游戏图标`} className="h-10 w-10 shrink-0 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${iconUrl})` }} /> : <div className="h-10 w-10 shrink-0 rounded-lg bg-white/10" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{game.name}</p>
            <p className="mt-1 text-xs text-cyan-200/80">{game.reason}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-200">{game.score}%</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 pl-0 sm:pl-13">
        {game.dimensionMatches.map((match) => <span key={match.dimension} className={`rounded-md px-2 py-1 text-[10px] ${match.keyword ? "bg-cyan-300/10 text-cyan-200" : "bg-white/[0.04] text-slate-600"}`}>{match.dimension} · {match.keyword ? `${match.keyword} ${match.score.toFixed(1)}%` : "未命中"}</span>)}
      </div>
    </li>
  );
}

function RecommendationCard({ game }: { game: SteamRecommendation }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10">
      {/* Steam provides the image URL; keeping it external avoids copying store artwork into the project. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {game.headerImage ? <img src={game.headerImage} alt={`${game.name} 游戏封面`} className="aspect-[460/215] w-full object-cover" /> : <div className="aspect-[460/215] bg-white/10" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-white">{game.name}</h3>
          <span className="shrink-0 rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-200">{game.score}%</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-cyan-200/80">{game.reason}</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {game.dimensionMatches.map((match) => <span key={match.dimension} className={`rounded-md px-2 py-1 text-[10px] ${match.keyword ? "bg-cyan-300/10 text-cyan-200" : "bg-white/[0.04] text-slate-600"}`}>{match.dimension} · {match.keyword ? `${match.keyword} ${match.score.toFixed(1)}%` : "未命中"}</span>)}
        </div>
        {game.tags.length ? <div className="mt-3 flex flex-wrap gap-1.5">{game.tags.slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-slate-400">{translateSteamTag(tag)}</span>)}</div> : null}
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{game.price}</span><div className="flex items-center gap-2">{typeof game.ignScore === "number" ? <a href={game.ignUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-amber-300/20 px-2.5 py-1.5 text-amber-200 transition hover:bg-amber-300/10">IGN 评分：{game.ignScore.toFixed(1)}/10</a> : null}<a href={game.storeUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/20 px-2.5 py-1.5 text-cyan-200 transition hover:bg-cyan-300/10">查看 Steam</a></div></div>
      </div>
    </article>
  );
}

function GameList({ games, recent }: { games: SteamGame[]; recent?: boolean }) {
  return <ul>{games.map((game) => <GameRow key={game.appid} game={game} recent={recent} />)}</ul>;
}

function SourcesPanel({ sources }: { sources: AnalysisSource[] }) {
  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-7">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">分析依据与内容出处</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">本页面只使用公开信息；外部媒体内容仅作分类参考，不复制受版权保护的原文。</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((source) => (
          <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-cyan-300/30">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-200">{source.name}</span><span className="text-[10px] text-cyan-300/70">{source.role}</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{source.note}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 sm:p-7"><div className="mb-5"><h2 className="text-lg font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{children}</section>;
}

function StateCard({ title, description, loading }: { title: string; description: string; loading?: boolean }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#080b12] px-6 text-slate-100"><div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center"><div className={`mx-auto mb-5 h-3 w-3 rounded-full ${loading ? "animate-pulse bg-cyan-300" : "bg-rose-300"}`} /><h1 className="text-xl font-semibold text-white">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{description}</p><Link href="/" className="mt-6 inline-block rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:text-white">返回首页</Link></div></main>;
}
