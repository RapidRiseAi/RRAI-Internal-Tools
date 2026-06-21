export function DashboardSkeleton() {
  return (
    <div className="min-h-screen px-6 py-8 text-slate-100 xl:pl-[19.5rem]">
      <div className="mx-auto max-w-[1500px] animate-pulse">
        <div className="h-3 w-40 rounded-full bg-rapid-cyan/30" />
        <div className="mt-4 h-10 w-80 rounded-2xl bg-white/10" />
        <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rr-glass h-28 rounded-2xl" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rr-glass h-96 rounded-2xl" />
          <div className="rr-glass h-96 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
