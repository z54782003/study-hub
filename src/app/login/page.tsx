export const metadata = { title: "登入・Study Hub" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form method="post" action="/api/login" className="mx-auto mt-24 max-w-xs space-y-4">
      <h1 className="text-center text-2xl font-bold">Study Hub</h1>
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="密碼"
        required
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-bad">密碼不對</p>}
      <button className="w-full rounded-2xl bg-accent py-3 font-semibold text-white">登入</button>
    </form>
  );
}
