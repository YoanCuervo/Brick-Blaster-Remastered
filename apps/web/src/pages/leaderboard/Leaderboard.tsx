import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getLeaderboard, type Leaderboard, type LeaderboardEntry } from "../../api/leaderboard";
import { Avatar } from "../../components/Avatar";
import { PageLayout } from "../../components/PageLayout";
import { DIFFICULTIES, SHOWN_RANKS, type DifficultyId } from "../../fixtures/profile";
import { Link } from "../../router";
import { ROUTES, difficultyParam, leaderboardUrl } from "../../routes";
import { difficultyName, formatScore } from "../profile/format";
import { Laurel } from "./Laurel";
import "./Leaderboard.css";

/** Rows shown before « … jusqu'au rang 100 », as on the mockup. */
const FIRST_ROWS = 10;
const PODIUM = ["lb-gold", "lb-silver", "lb-bronze"] as const;

interface Card {
  entry: LeaderboardEntry;
  top: number;
}

function RankCell({ rank }: { rank: number | null }) {
  if (rank !== null && rank <= PODIUM.length) {
    return (
      <td className="lb-rank">
        <Laurel rank={rank} />
      </td>
    );
  }
  return <td className="lb-rank">{rank ?? "—"}</td>;
}

export function LeaderboardPage() {
  const [difficulty, setDifficulty] = useState<DifficultyId>(
    () => difficultyParam(new URLSearchParams(window.location.search).get("difficulte")) ?? 1,
  );
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let current = true;
    void getLeaderboard(difficulty).then((result) => current && setBoard(result));
    return () => {
      current = false;
    };
  }, [difficulty]);

  const choose = (d: DifficultyId) => {
    setDifficulty(d);
    setCard(null);
    // The tab stays in the address for reloads; the page does not change, so no navigate().
    window.history.replaceState(null, "", leaderboardUrl(d));
  };

  const onTabKey = (event: KeyboardEvent, d: DifficultyId) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = ((d + step + DIFFICULTIES.length) % DIFFICULTIES.length) as DifficultyId;
    choose(next);
    tabRefs.current[next]?.focus();
  };

  const showCard = (entry: LeaderboardEntry, row: HTMLTableRowElement) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const top = row.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top + 4;
    setCard({ entry, top });
  };

  const me = board?.me;
  const shown = board ? board.entries.slice(0, expanded ? SHOWN_RANKS : FIRST_ROWS) : [];
  const pinnedMe = me && (me.rank === null || me.rank > shown.length) ? me : null;

  const row = (entry: LeaderboardEntry, pinned = false) => {
    const isMe = me?.rank === entry.rank;
    const classes = [PODIUM[entry.rank - 1], isMe && "me"].filter(Boolean).join(" ");
    return (
      <tr
        key={pinned ? "me" : entry.rank}
        className={classes || undefined}
        tabIndex={0}
        aria-describedby={card?.entry === entry ? "lb-card" : undefined}
        onMouseEnter={(e) => showCard(entry, e.currentTarget)}
        onFocus={(e) => showCard(entry, e.currentTarget)}
        onMouseLeave={() => setCard(null)}
        onBlur={() => setCard(null)}
      >
        <RankCell rank={entry.rank} />
        <th scope="row">
          <span className="lb-who">
            <Avatar avatar={entry.avatar} pseudo={entry.pseudo} size={36} />
            {isMe ? `${entry.pseudo} (toi)` : entry.pseudo}
          </span>
        </th>
        <td>{formatScore(entry.score)}</td>
      </tr>
    );
  };

  return (
    <PageLayout
      title="Classement des Limbes"
      actions={
        <Link className="btn btn-secondary" to={ROUTES.profile}>
          <span aria-hidden="true">←</span> Retour au profil
        </Link>
      }
    >
      <div ref={wrapRef} className="lb-page">
        <div className="lb-head">
          <div>
            <p className="lb-kicker">En ligne · top {SHOWN_RANKS}</p>
            <h1 className="lb-title">
              Classement
              <br />
              des Limbes
            </h1>
          </div>
          <div role="tablist" aria-label="Difficulté" className="lb-tabs">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                ref={(el) => {
                  tabRefs.current[d] = el;
                }}
                className="tab"
                type="button"
                role="tab"
                id={`lb-tab-${d}`}
                aria-selected={d === difficulty}
                aria-controls="lb-board"
                tabIndex={d === difficulty ? 0 : -1}
                onClick={() => choose(d)}
                onKeyDown={(e) => onTabKey(e, d)}
              >
                {difficultyName(d)}
              </button>
            ))}
          </div>
        </div>

        <section
          id="lb-board"
          className="card lb-board"
          role="tabpanel"
          aria-labelledby={`lb-tab-${difficulty}`}
          aria-busy={board === null}
        >
          <table className="lb">
            <caption className="sr-only">
              Top {SHOWN_RANKS}, {difficultyName(difficulty)}
            </caption>
            <thead>
              <tr>
                <th scope="col">Rang</th>
                <th scope="col">Joueur</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => row(entry))}
              {board && !expanded && (
                <tr className="lb-gap">
                  <td colSpan={3}>
                    <button className="lb-more" type="button" onClick={() => setExpanded(true)}>
                      … jusqu'au rang {SHOWN_RANKS}
                    </button>
                  </td>
                </tr>
              )}
              {board &&
                pinnedMe &&
                (pinnedMe.rank !== null ? (
                  row(board.entries[pinnedMe.rank - 1]!, true)
                ) : (
                  <tr className="me">
                    <RankCell rank={null} />
                    <th scope="row">
                      <span className="lb-who">
                        <Avatar avatar={pinnedMe.avatar} pseudo={pinnedMe.pseudo} size={36} />
                        {pinnedMe.pseudo} (toi)
                      </span>
                    </th>
                    <td className="lb-unranked">Pas encore classé</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        {card && (
          <div id="lb-card" role="tooltip" className="lb-card" style={{ top: card.top }}>
            <div className="lb-card-head">
              <Avatar avatar={card.entry.avatar} pseudo={card.entry.pseudo} size={46} />
              <strong>{card.entry.pseudo}</strong>
            </div>
            <dl>
              <dt>Meilleur score</dt>
              <dd>{formatScore(card.entry.score)}</dd>
              <dt>Parties jouées</dt>
              <dd>{formatScore(card.entry.gamesPlayed)}</dd>
            </dl>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
