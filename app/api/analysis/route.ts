import { NextRequest, NextResponse } from "next/server";
import { analyzeSteamUser, SteamIdentifierError, SteamVisibilityError } from "@/lib/steam-analysis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const steamid = request.nextUrl.searchParams.get("steamid")?.trim();
  const consent = request.nextUrl.searchParams.get("consent");
  const apiKey = process.env.STEAM_API_KEY;

  if (!steamid || steamid.length > 200) {
    return NextResponse.json({ error: "请输入数字 Steam ID、自定义 ID，或 Steam 个人主页 URL。" }, { status: 400 });
  }
  if (consent !== "1") {
    return NextResponse.json({ error: "请先确认这是你本人的 Steam ID，并同意公开数据使用说明。" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "服务端尚未配置 STEAM_API_KEY，请先在 .env.local 中填入 Steam Web API Key。" }, { status: 503 });
  }

  try {
    return NextResponse.json(await analyzeSteamUser(steamid, apiKey));
  } catch (error) {
    console.error("Steam analysis failed", error);
    if (error instanceof SteamIdentifierError) {
      return NextResponse.json({ code: "INVALID_STEAM_ID", error: "没有找到对应的 Steam 用户，请检查自定义 ID 或主页 URL。" }, { status: 400 });
    }
    if (error instanceof SteamVisibilityError) {
      return NextResponse.json({
        code: "PRIVATE_PROFILE",
        error: "无法读取该 Steam 账号的公开资料或游戏库。",
      }, { status: 403 });
    }
    return NextResponse.json({ error: "无法获取该用户的公开 Steam 数据，请确认资料和游戏库已设为公开。" }, { status: 502 });
  }
}
