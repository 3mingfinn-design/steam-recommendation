import Link from "next/link";

export default async function AnalysisErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const params = await searchParams;
  const isPrivate = params.reason === "private";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080b12] px-6 text-slate-100">
      <section className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.05] p-8 sm:p-10">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-300/10 text-rose-300" aria-hidden="true">!</div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-300">Analysis unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">无法完成 Steam 游戏分析</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">
          {isPrivate
            ? "Steam 没有返回这个账号的公开资料或游戏库数据。可能是个人资料或游戏详情设置为私密，也可能是 Steam 暂时限制了公开接口访问。"
            : "本次分析没有完成，请稍后重试。"}
        </p>
        {isPrivate && (
          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-5 text-sm leading-7 text-slate-300">
            <p className="font-medium text-white">建议检查</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
              <li>打开 Steam 个人资料的隐私设置。</li>
              <li>将“我的个人资料”设置为公开。</li>
              <li>将“游戏详情”设置为公开。</li>
              <li>关闭“始终将我的总游戏时间保密”。</li>
              <li>保存设置后稍等片刻，再重新分析。</li>
            </ol>
          </div>
        )}
        <Link href="/" className="mt-7 inline-block rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">返回首页</Link>
      </section>
    </main>
  );
}
