import { NextRequest, NextResponse } from "next/server";
import { analyzeSteamUser, SteamIdentifierError, SteamVisibilityError } from "@/lib/steam-analysis";
import { rankStoreCandidates } from "@/lib/recommendation";
import { getStoreCandidates, getStoreIndexStatus } from "@/lib/steam-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const steamid = request.nextUrl.searchParams.get("steamid")?.trim();
  const consent = request.nextUrl.searchParams.get("consent");
  const apiKey = process.env.STEAM_API_KEY;
  if (!steamid || steamid.length > 200) return NextResponse.json({ error: "Steam ID 无效。" }, { status: 400 });
  if (consent !== "1") return NextResponse.json({ error: "请先确认公开数据使用说明。" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "服务端尚未配置 STEAM_API_KEY。" }, { status: 503 });

  try {
    const analysis = await analyzeSteamUser(steamid, apiKey);
    const ownedAppIds = new Set(analysis.ownedGames.map((game) => game.appid));
    const candidates = getStoreCandidates(ownedAppIds, analysis.dimensions, analysis.recentDimensions);
    return NextResponse.json({
      recommendations: rankStoreCandidates(candidates, analysis.dimensions, analysis.recentDimensions),
      index: { ...getStoreIndexStatus(), candidates: candidates.length },
    });
  } catch (error) {
    console.error("Steam recommendations failed", error);
    if (error instanceof SteamIdentifierError) return NextResponse.json({ code: "INVALID_STEAM_ID", error: "没有找到对应的 Steam 用户。" }, { status: 400 });
    if (error instanceof SteamVisibilityError) return NextResponse.json({ code: "PRIVATE_PROFILE", error: "无法读取该 Steam 账号的公开游戏库。" }, { status: 403 });
    return NextResponse.json({ error: "暂时无法获取 Steam 商店推荐，请稍后重试。" }, { status: 502 });
  }
}
