export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-[var(--space-small-gap)] px-[var(--space-screen-inline)]">
      <h1 className="font-[var(--type-display)] text-[var(--text-display-size)] leading-[var(--text-display-leading)] font-extrabold">
        WaveParticle
      </h1>
      <p className="text-center">Pick a companion, set a goal, and start.</p>
    </main>
  );
}
