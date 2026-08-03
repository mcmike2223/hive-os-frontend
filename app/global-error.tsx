"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- The global recovery UI must not depend on a failed App Router context. */

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
};

export default function GlobalError({ error, reset, unstable_retry }: GlobalErrorProps) {
  const retry = unstable_retry ?? reset;

  return (
    <html lang="en">
      <body className="m-0 bg-slate-950 font-sans text-slate-50 antialiased">
        <main
          aria-labelledby="global-error-heading"
          className="mx-auto flex min-h-dvh w-full max-w-2xl items-center px-6 py-12 sm:px-8"
        >
          <section className="w-full rounded-2xl border border-slate-500 bg-slate-900 p-8 shadow-2xl sm:p-10">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Hive OS</p>
            <h1 id="global-error-heading" className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
              We could not load this page
            </h1>
            <p id="global-error-message" className="mt-4 max-w-prose text-base leading-7 text-slate-200">
              Your data has not been changed. Try again, or return to the previous page and retry the action.
            </p>
            {error.digest ? (
              <p className="mt-4 text-sm leading-6 text-slate-300">Reference: {error.digest}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                autoFocus
                onClick={retry}
                disabled={!retry}
                aria-describedby="global-error-message"
                className="min-h-11 rounded-lg bg-sky-300 px-5 py-2.5 text-base font-semibold text-slate-950 shadow-sm transition-colors hover:bg-sky-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-slate-50 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-100"
              >
                Try again
              </button>
              <a
                href="/"
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-5 py-2.5 text-base font-semibold text-slate-50 transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
              >
                Return to home
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
