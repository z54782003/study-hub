import { TedPlayer } from "@/components/player/TedPlayer";

export const metadata = { title: "播放器・Study Hub" };

// 任意 TED 網址：/play?url=https://www.ted.com/talks/...
export default async function PlayPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  if (url) return <TedPlayer tedUrl={url} title="TED" />;
  return (
    <form className="mx-auto mt-24 max-w-md space-y-3 px-4">
      <h1 className="text-xl font-bold">貼上 TED 網址</h1>
      <input
        name="url"
        type="url"
        required
        placeholder="https://www.ted.com/talks/..."
        className="w-full card px-4 py-3 outline-none focus:border-accent"
      />
      <button className="w-full rounded-2xl bg-accent py-3 font-semibold text-on-accent">開始精聽</button>
    </form>
  );
}
