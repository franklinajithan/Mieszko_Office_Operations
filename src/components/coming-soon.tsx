export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel emptyState">
      <p className="eyebrow">Coming soon</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}
