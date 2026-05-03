import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { SignInButton } from "@/components/auth/sign-in-button";
import { AirlineMark } from "@/components/shell/airline-mark";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh flex-col bg-paper text-ink">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-ink/15 px-8 py-5">
        <div className="flex items-center gap-3 text-ink">
          <span className="text-persimmon">
            <AirlineMark className="h-7 w-7" />
          </span>
          <span className="font-display text-[15px] uppercase tracking-[0.32em]">
            Airline · Tycoon
          </span>
        </div>
        <span className="label-code text-ink-faint">EST. 2026 · OPS BOARD</span>
      </header>

      {/* Hero — editorial split */}
      <section className="relative flex flex-1 items-stretch">
        <div className="grid w-full grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
          {/* Left: type-led editorial */}
          <div className="relative flex flex-col justify-between border-r border-ink/15 px-8 py-12 lg:px-16 lg:py-20">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.36em] text-persimmon">
                Issue No. 01
              </span>
              <span className="h-px w-12 bg-ink/30" />
              <span className="label-code text-ink-faint">An idle tycoon</span>
            </div>

            <div className="my-auto flex max-w-3xl flex-col gap-6 py-12">
              <h1 className="font-display text-[68px] leading-[0.96] tracking-[-0.025em] sm:text-[88px]">
                Build an airline.
                <br />
                <span className="italic text-persimmon">Bend the world</span>
                <br />
                to your timetable.
              </h1>
              <p className="max-w-xl text-[17px] leading-relaxed text-ink-soft">
                Start with a single regional charter and grow into a multinational
                empire — competing inside the real-world airline industry, against
                the carriers you already know.
              </p>
              <p className="max-w-xl text-[14px] leading-relaxed text-ink-faint">
                Sessions are short. Progress accrues offline. The dopamine hit lives
                in the morning paper that's waiting when you come back.
              </p>
            </div>

            <div className="flex flex-col items-start gap-4">
              <SignInButton />
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-faint">
                Sign in with Google · Phase 0 · build 0.0.1
              </p>
            </div>
          </div>

          {/* Right: timetable / boarding pass detail */}
          <div className="relative flex flex-col bg-midnight text-paper">
            <div className="flex items-center justify-between border-b border-paper/20 px-8 py-5">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.32em]">
                Forecast Timetable
              </span>
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/65">
                <span className="size-1.5 rounded-full bg-runway pulse-beacon" />
                Awaiting captain
              </span>
            </div>

            <div className="flex-1 px-8 py-8">
              <table className="w-full font-mono text-[12px]">
                <thead className="text-paper/55 uppercase tracking-[0.18em]">
                  <tr>
                    <th className="text-left font-normal pb-2">Phase</th>
                    <th className="text-left font-normal pb-2">Section</th>
                    <th className="text-right font-normal pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper/15 text-paper/85">
                  {ROADMAP.map((row) => (
                    <tr key={row.phase}>
                      <td className="py-2.5 text-paper/55">{row.phase}</td>
                      <td className="py-2.5">{row.section}</td>
                      <td
                        className={`py-2.5 text-right ${
                          row.status === "DONE"
                            ? "text-hangar"
                            : row.status === "NEXT"
                              ? "text-persimmon"
                              : "text-paper/55"
                        }`}
                      >
                        {row.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="border-t border-paper/20 px-8 py-5">
              <div className="flex items-end justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/55">
                    The plan
                  </span>
                  <p className="mt-1 font-display text-[20px] leading-tight">
                    Six phases. One growing world.
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/55">
                  See SPEC.md
                </span>
              </div>
            </footer>
          </div>
        </div>
      </section>

      {/* Strip: voice, columns of editorial blurb */}
      <section className="border-t border-ink/15 bg-paper-deep">
        <div className="grid grid-cols-1 divide-y divide-ink/10 md:grid-cols-3 md:divide-x md:divide-y-0">
          {COLUMNS.map((c) => (
            <article key={c.code} className="flex flex-col gap-3 px-8 py-8">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-persimmon">
                {c.code} · {c.eyebrow}
              </span>
              <h3 className="font-display text-[26px] leading-[1.05] tracking-[-0.015em]">
                {c.title}
              </h3>
              <p className="text-[13.5px] leading-relaxed text-ink-soft">
                {c.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink/15 px-8 py-4 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
        © Airline Tycoon · A long-haul idle tycoon
      </footer>
    </main>
  );
}

const ROADMAP = [
  { phase: "00", section: "Foundation · auth · DB · Docker", status: "DONE" },
  { phase: "01", section: "Static world · seed · 3D globe", status: "NEXT" },
  { phase: "02", section: "Core sim · time model · newsroom", status: "QUEUED" },
  { phase: "03", section: "Depth · finance · reputation", status: "QUEUED" },
  { phase: "04", section: "Content · tech · events · AI", status: "QUEUED" },
  { phase: "05", section: "Endgame · merger / prestige", status: "QUEUED" },
];

const COLUMNS = [
  {
    code: "I",
    eyebrow: "Idle, by design",
    title: "Built for short sessions and long absences.",
    body: "1 real hour ≈ 1 game day. Slower offline, but capped — so a week away doesn't drown you. The morning paper summarises everything the world did while you were gone.",
  },
  {
    code: "II",
    eyebrow: "Real industry, real pressure",
    title: "You're competing against airlines you've actually flown.",
    body: "Real airports, real aircraft, real carriers as AI competitors. They open and close routes, defend their hubs, and respond when you encroach.",
  },
  {
    code: "III",
    eyebrow: "Specialise, then merge",
    title: "Pick a doctrine. Then start over, stronger.",
    body: "Tech tree branches into low-cost, premium, cargo, or charter — exclusive choices that reward replay. End-game merger resets the run with persistent perks.",
  },
];
