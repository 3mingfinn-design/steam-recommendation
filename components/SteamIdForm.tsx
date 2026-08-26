"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const steamIdentifierPattern = /^(?:\d{5,20}|[a-zA-Z0-9_-]{2,64}|https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[a-zA-Z0-9_-]{2,64}\/?$)$/;

export default function SteamIdForm() {
  const router = useRouter();
  const [steamId, setSteamId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = steamId.trim();

    if (!steamIdentifierPattern.test(value)) {
      setError("请输入数字 Steam ID、自定义 ID，或 Steam 个人主页 URL");
      return;
    }
    if (!confirmed) {
      setError("请先确认这是你本人的 Steam 账号，并同意公开数据使用说明");
      return;
    }

    setError("");
    setIsSubmitting(true);
    router.push(`/analysis?steamid=${encodeURIComponent(value)}&consent=1`);
  }

  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Get started</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">输入 Steam ID</h2>
        </div>
        <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.7">
            <path d="M8.5 14.5 5 18a2.8 2.8 0 1 0 4 4l3.5-3.5M14 9l3.5-3.5a2.8 2.8 0 1 1 4 4L18 13" />
            <path d="m8 16 8-8M9.5 3.5a6.5 6.5 0 0 1 9 9M14.5 20.5a6.5 6.5 0 0 1-9-9" />
          </svg>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="steam-id" className="mb-2 block text-sm font-medium text-slate-300">
          Steam ID 或自定义 ID
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="steam-id"
            name="steamId"
            value={steamId}
            onChange={(event) => {
              setSteamId(event.target.value);
              setError("");
            }}
            placeholder="76561198000000000 或 yourname"
            autoComplete="off"
            aria-describedby="steam-id-help steam-id-error"
            aria-invalid={Boolean(error)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/70 focus:ring-4 focus:ring-cyan-300/10"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-300/30 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "正在进入…" : "开始分析"}
          </button>
        </div>
        <p id="steam-id-help" className="mt-3 text-xs leading-5 text-slate-500">
          支持数字 Steam ID、自定义 ID（例如 yourname），或完整个人主页 URL。
        </p>
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setError("");
            }}
            className="mt-1 h-4 w-4 shrink-0 accent-cyan-300"
          />
          <span>我确认这是我本人的 Steam ID，并同意仅使用该账号的公开信息进行分析。</span>
        </label>
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-xs leading-5 text-slate-500">
          <p className="font-medium text-slate-400">使用说明</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>只读取公开 Steam 数据，不使用任何隐私数据。</li>
            <li>不保存 Steam 密码或登录凭据，数据仅用于本次查询。</li>
            <li>本工具不代表 Valve 或 Steam 官方，数据来自 Steam Web API。</li>
            <li>不允许批量扫描 Steam ID；你可以随时停止使用本工具。</li>
          </ul>
        </div>
        {error && (
          <p id="steam-id-error" role="alert" className="mt-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
