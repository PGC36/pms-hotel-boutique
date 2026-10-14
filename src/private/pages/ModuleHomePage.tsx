export function ModuleHomePage({ title }: { title: string }) {
  return (
    <section className="content">
      <p className="eyebrow">Panel privado</p>
      <h1>{title}</h1>
      <p className="muted">Las funciones de esta sección estarán disponibles próximamente.</p>
    </section>
  );
}
