import SteamIdForm from "@/components/SteamIdForm";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#080b12] text-slate-100">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-400/20">
              SG
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-200">Steam Guide</span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">
            Beta
          </span>
        </header>

        <section className="relative flex flex-1 items-center py-20">
          <div className="pointer-events-none absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative grid w-full gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-24">
            <div>
              <p className="mb-5 flex items-center gap-2 text-sm font-medium text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                Personalized game discovery
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-7xl">
                Find your next
                <span className="block text-cyan-300">great game.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
                输入你的 Steam ID，我们会根据你的游戏历史和游玩时长，为你找到真正值得玩的下一款游戏。
              </p>
              <div className="mt-10 flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-3 py-2">基于游戏历史</span>
                <span className="rounded-full border border-white/10 px-3 py-2">无需登录</span>
                <span className="rounded-full border border-white/10 px-3 py-2">免费使用</span>
              </div>
            </div>

            <SteamIdForm />
          </div>
        </section>

        <footer className="border-t border-white/10 py-5 text-xs text-slate-500">
          Steam Guide · 仅使用公开的 Steam 游戏数据
        </footer>
      </div>
    </main>
  );
}
