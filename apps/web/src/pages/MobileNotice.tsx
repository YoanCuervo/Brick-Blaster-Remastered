import { PageLayout } from "../components/PageLayout";

/** Shown instead of the site on devices without a mouse or trackpad. */
export function MobileNotice() {
  return (
    <PageLayout title="Ce jeu se joue sur ordinateur">
      <section
        className="card"
        style={{
          margin: "auto 0",
          width: "100%",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            display: "grid",
            placeItems: "center",
            background: "var(--blue)",
            color: "#ffffff",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </svg>
        </div>
        <h1 className="h2">Ce jeu se joue sur ordinateur</h1>
        <p className="muted" style={{ margin: 0 }}>
          Brick Blaster Remastered demande une souris et un clavier. Reviens sur ordinateur pour
          jouer.
        </p>
      </section>
    </PageLayout>
  );
}
