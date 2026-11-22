import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  SHOWN_RANKS,
  type DifficultyId,
  type Leaderboard,
  type LeaderboardEntry,
  type Me,
  type PlayerCard,
} from "@brick-blaster/contracts";
import { GENERIC_ERROR } from "../../api/http";
import { getMe } from "../../api/profile";
import { getLeaderboard, getPlayerCard } from "../../api/scores";
import { Avatar } from "../../components/Avatar";
import { PageLayout } from "../../components/PageLayout";
import { Link } from "../../router";
import { ROUTES, difficultyParam, leaderboardUrl } from "../../routes";
import { DIFFICULTIES, difficultyName, formatScore } from "../profile/format";
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
  const [failed, setFailed] = useState(false);
  /** The signed-in player, for the « Pas encore classé » row. */
  const [player, setPlayer] = useState<Me | null>(null);
  /** Hover cards already fetched, by difficulty and pseudo; null when the API had none. */
  const cards = useRef(new Map<string, PlayerCard | null>());
  const [, setCardsLoaded] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let current = true;
    setBoard(null);
    setFailed(false);
    void getLeaderboard(difficulty).then((reply) => {
      if (!current) return;
      if (reply.ok) setBoard(reply.data);
      else setFailed(true);
    });
    return () => {
      current = false;
    };
  }, [difficulty]);

  useEffect(() => {
    void getMe().then(setPlayer);
  }, []);

  const cardKey = (pseudo: string) => `${difficulty}:${pseudo}`;

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
    const key = cardKey(entry.pseudo);
    if (cards.current.has(key)) return;
    cards.current.set(key, null);
    void getPlayerCard(entry.pseudo, difficulty).then((reply) => {
      if (!reply.ok) return cards.current.delete(key);
      cards.current.set(key, reply.data);
      setCardsLoaded((n) => n + 1);
    });
  };

  const me = board?.me;
  const shown = board ? board.entries.slice(0, expanded ? SHOWN_RANKS : FIRST_ROWS) : [];
  const pinnedMe = me && me.rank > shown.length ? me : null;
  const unranked = board !== null && me === null && player !== null;
  const shownCard = card && cards.current.get(cardKey(card.entry.pseudo));

  const row = (entry: LeaderboardEntry, pinned = false) => {
    // A player may hold several rows: all of theirs are marked.
    const isMe = player !== null && entry.pseudo === player.pseudo;
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
            {entry.pseudo}
            {isMe && <span className="sr-only"> (toi)</span>}
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
              {failed && (
                <tr>
                  <td colSpan={3} role="alert" className="lb-unranked">
                    {GENERIC_ERROR}
                  </td>
                </tr>
              )}
              {board && board.entries.length === 0 && (
                <tr>
                  <td colSpan={3} className="lb-unranked">
                    Personne n'est encore classé à cette difficulté.
                  </td>
                </tr>
              )}
              {board && !expanded && board.entries.length > FIRST_ROWS && (
                <tr className="lb-gap">
                  <td colSpan={3}>
                    <button className="lb-more" type="button" onClick={() => setExpanded(true)}>
                      … jusqu'au rang {SHOWN_RANKS}
                    </button>
                  </td>
                </tr>
              )}
              {pinnedMe && row(pinnedMe, true)}
              {unranked && (
                <tr className="me">
                  <RankCell rank={null} />
                  <th scope="row">
                    <span className="lb-who">
                      <Avatar avatar={player.avatar} pseudo={player.pseudo} size={36} />
                      {player.pseudo}
                      <span className="sr-only"> (toi)</span>
                    </span>
                  </th>
                  <td className="lb-unranked">Pas encore classé</td>
                </tr>
              )}
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
              <dd>{shownCard ? formatScore(shownCard.score) : "…"}</dd>
              <dt>Parties jouées</dt>
              <dd>{shownCard ? formatScore(shownCard.gamesPlayed) : "…"}</dd>
            </dl>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
