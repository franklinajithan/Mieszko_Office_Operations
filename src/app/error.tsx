"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="authPage">
      <section className="authCard">
        <h1>Something went wrong</h1>
        <p>Please try again. If this continues, contact Head Office.</p>
        <button className="button primary" type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
