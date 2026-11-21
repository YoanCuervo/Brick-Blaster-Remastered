import { useEffect, useRef, useState } from "react";
import { getMe, signOut } from "../../api/profile";
import logoFull from "../../assets/logo/logo-full.png";
import { Avatar } from "../../components/Avatar";
import { Backdrop } from "../../components/Backdrop";
import { BrickArt } from "../../components/BrickArt";
import {
  DIFFICULTIES,
  EMPTY_STATS,
  SHOWN_RANKS,
  WORLDS,
  type GameRow,
  type Profile,
} from "../../fixtures/profile";
import { Link, navigate } from "../../router";
import { DOWNLOAD_URL, ROUTES } from "../../routes";
import { AccountModal } from "./AccountModal";
import { AvatarModal } from "./AvatarModal";
import { BestScoresTable } from "./BestScoresTable";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { difficultyName, formatDay, formatDuration, formatScore, worldName } from "./format";
import { PasswordModal } from "./PasswordModal";
import { MultiPanel, SoloPanel } from "./PlayPanels";
import { PseudoModal } from "./PseudoModal";
import { StatsModal, counterList } from "./StatsModal";
import "./Profile.css";

type Mode = "solo" | "multi";
type ModalId = "account" | "avatar" | "pseudo" | "password" | "stats" | "delete";

// Counters of the profile, in the mockup's order: the last one spans the two columns.
const COUNTER_ORDER = ["games", "time", "level", "lives", "bricks"];

function ArrowIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

/** Best place over the three ranked leaderboards, as « 37e en Limbes · Moyen ». */
function RankLine({ profile }: { profile: Profile }) {
  const best = DIFFICULTIES.filter((d) => profile.ranked[d].rank !== null).sort(
    (a, b) => (profile.ranked[a].rank ?? 0) - (profile.ranked[b].rank ?? 0),
  )[0];
  if (best === undefined) return <span className="muted">Pas encore classé</span>;
  const rank = profile.ranked[best].rank;
  return (
    <span className="muted">
      {rank}
      <sup>{rank === 1 ? "er" : "e"}</sup> en Limbes · {difficultyName(best)}
    </span>
  );
}

/** The highest score of the account, solo or ranked: the one shown in orange. */
function personalRecord(profile: Profile): number {
  const solo = WORLDS.flatMap((w) => profile.best[w.id]);
  const ranked = profile.ranked.map((entry) => entry.record);
  return Math.max(0, ...[...solo, ...ranked].map((score) => score ?? 0));
}

function GameItem({ game, record }: { game: GameRow; record: boolean }) {
  return (
    <li className={record ? "card profile-game is-record" : "card profile-game"}>
      <span className="profile-game-text">
        <span className="profile-game-title">
          {worldName(game.world)} · {difficultyName(game.difficulty)}
        </span>
        <span className="profile-game-sub">
          {formatDay(game.playedAt)} · {formatDuration(game.durationSeconds)} · niveau {game.level}
          {record && " · record"}
        </span>
      </span>
      <span className="profile-game-score">{formatScore(game.score)}</span>
    </li>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [modal, setModal] = useState<ModalId | null>(null);
  // Remounts the modals on each opening, so a form never shows a previous attempt.
  const [opening, setOpening] = useState(0);
  const modeButtons = useRef<Record<Mode, HTMLButtonElement | null>>({ solo: null, multi: null });

  useEffect(() => {
    document.title = "Profil · Brick Blaster Remastered";
    let live = true;
    void getMe().then((me) => {
      if (!live) return;
      if (me) setProfile({ ...me, ...EMPTY_STATS });
      else navigate(ROUTES.signIn, { replace: true });
    });
    return () => {
      live = false;
    };
  }, []);

  if (!profile) {
    return (
      <div className="page">
        <Backdrop />
      </div>
    );
  }

  const open = (id: ModalId) => {
    setOpening((n) => n + 1);
    setModal(id);
  };
  const close = () => setModal(null);
  const closePanel = () => {
    const button = mode && modeButtons.current[mode];
    setMode(null);
    button?.focus();
  };
  const toggle = (next: Mode) => setMode(mode === next ? null : next);

  async function leave() {
    await signOut();
    navigate(ROUTES.home, { replace: true });
  }

  const record = personalRecord(profile);
  const counters = counterList(profile.counters);
  const rankedRecord = Math.max(0, ...profile.ranked.map((entry) => entry.record ?? 0));

  return (
    <div className="page profile">
      <Backdrop />
      <div className="profile-grid">
        <main className="profile-main">
          <section className="profile-hero" aria-labelledby="profile-title">
            <div className="card profile-hero-text">
              <h1 id="profile-title" className="profile-logo">
                <img src={logoFull} alt="Brick Blaster Remastered" width={1600} height={517} />
              </h1>
              <div className="profile-modes">
                <button
                  ref={(node) => {
                    modeButtons.current.solo = node;
                  }}
                  className="profile-mode profile-mode-solo"
                  type="button"
                  aria-expanded={mode === "solo"}
                  aria-controls={mode === "solo" ? "play-panel" : undefined}
                  onClick={() => toggle("solo")}
                >
                  Solo
                  <small>
                    {mode === "solo" ? "Choisis ton monde à droite" : "Espace, Arcade, Limbes"}
                  </small>
                </button>
                <button
                  ref={(node) => {
                    modeButtons.current.multi = node;
                  }}
                  className="profile-mode profile-mode-multi"
                  type="button"
                  aria-expanded={mode === "multi"}
                  aria-controls={mode === "multi" ? "play-panel" : undefined}
                  onClick={() => toggle("multi")}
                >
                  Multi
                  <small>
                    {mode === "multi" ? "Choisis ta difficulté à droite" : "Limbes classé, PvP"}
                  </small>
                </button>
              </div>
            </div>
            {mode === "solo" && <SoloPanel profile={profile} onClose={closePanel} />}
            {mode === "multi" && <MultiPanel profile={profile} onClose={closePanel} />}
            {mode === null && (
              <figure className="profile-art">
                <BrickArt />
              </figure>
            )}
          </section>

          <div className="profile-cols">
            <section className="profile-stats" aria-labelledby="stats-heading">
              <div className="profile-section-head profile-span">
                <h2 id="stats-heading" className="profile-h2">
                  Stats
                </h2>
                <button
                  className="profile-go"
                  type="button"
                  aria-label="Toutes mes stats"
                  title="Toutes mes stats"
                  onClick={() => open("stats")}
                >
                  <ArrowIcon />
                </button>
              </div>
              {COUNTER_ORDER.map((key) => {
                const counter = counters.find((c) => c.key === key);
                return (
                  counter && (
                    <dl
                      key={key}
                      className={
                        key === "bricks"
                          ? "card profile-counter profile-span"
                          : "card profile-counter"
                      }
                    >
                      <dt>{counter.label}</dt>
                      <dd>{counter.value}</dd>
                    </dl>
                  )
                );
              })}
            </section>

            <section className="profile-best" aria-labelledby="best-heading">
              <div className="profile-section-head">
                <h2 id="best-heading" className="profile-h2">
                  Meilleurs scores
                </h2>
                <Link
                  className="profile-go"
                  to={ROUTES.leaderboard}
                  aria-label="Classements des Limbes"
                  title="Classements des Limbes"
                >
                  <ArrowIcon />
                </Link>
              </div>
              <div className="card profile-best-card">
                <h3 id="best-solo" className="profile-h3">
                  Solo
                </h3>
                <BestScoresTable
                  best={profile.best}
                  labelledBy="best-solo"
                  className="tbl profile-tbl"
                />
                <div className="profile-best-split">
                  <h3 id="best-ranked" className="profile-h3">
                    Multi · Limbes
                  </h3>
                  <Link className="link profile-inline-link" to={ROUTES.leaderboard}>
                    Classements
                  </Link>
                </div>
                <table className="tbl profile-tbl" aria-labelledby="best-ranked">
                  <thead>
                    <tr>
                      <th scope="col">Difficulté</th>
                      <th scope="col" className="num">
                        Rang
                      </th>
                      <th scope="col" className="num">
                        Record
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIFFICULTIES.map((d) => {
                      const { rank, record: best } = profile.ranked[d];
                      const top = rankedRecord > 0 && best === rankedRecord;
                      return (
                        <tr key={d}>
                          <th scope="row">{difficultyName(d)}</th>
                          <td className="num">
                            {rank === null ? "—" : `${rank} / ${SHOWN_RANKS}`}
                          </td>
                          <td className={top ? "num gold" : "num"}>{formatScore(best)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="profile-recent" aria-labelledby="recent-heading">
              <div className="profile-section-head">
                <h2 id="recent-heading" className="profile-h2">
                  Dernières parties
                </h2>
              </div>
              {profile.games.length === 0 ? (
                <p className="card profile-empty muted">Aucune partie pour l'instant.</p>
              ) : (
                <ol className="profile-games">
                  {profile.games.slice(0, 5).map((game) => (
                    <GameItem
                      key={game.playedAt}
                      game={game}
                      record={record > 0 && game.score === record}
                    />
                  ))}
                </ol>
              )}
            </section>
          </div>
        </main>

        <aside className="profile-aside">
          <button
            className="card profile-ident"
            type="button"
            aria-haspopup="dialog"
            aria-describedby="ident-hint"
            onClick={() => open("account")}
          >
            <Avatar avatar={profile.avatar} pseudo={profile.pseudo} size={72} />
            <span className="profile-ident-text">
              <span className="profile-name">{profile.pseudo}</span>
              <RankLine profile={profile} />
              <span id="ident-hint" className="profile-ident-hint">
                {profile.pseudoChosen ? "Gérer mon compte" : "Choisis ton pseudo"}
              </span>
            </span>
          </button>

          <section className="profile-chat" aria-labelledby="chat-heading">
            <p id="chat-heading" className="profile-chat-title">
              Chat
            </p>
            <p className="profile-chat-note">En construction.</p>
          </section>

          <a
            className="card profile-tile profile-download"
            href={DOWNLOAD_URL ?? undefined}
            download={DOWNLOAD_URL ? "" : undefined}
            aria-disabled={DOWNLOAD_URL ? undefined : true}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3 5.2 10.4 4.2V11.4H3ZM11.4 4.1 21 2.8V11.4H11.4ZM3 12.6H10.4V19.8L3 18.8ZM11.4 12.6H21V21.2L11.4 19.9Z"
              />
            </svg>
            <span className="profile-download-text">
              Télécharger pour Windows
              <span className="muted">.exe, avec le mode coop</span>
            </span>
          </a>
        </aside>
      </div>

      {/* Not keyed: it must close through the dialog API so the focus goes back to the
          identity card before the next modal opens. */}
      <AccountModal
        open={modal === "account"}
        onClose={close}
        onPick={open}
        onSignOut={() => void leave()}
      />
      <AvatarModal
        key={`avatar-${opening}`}
        open={modal === "avatar"}
        avatar={profile.avatar}
        onClose={close}
        onSaved={(avatar) => {
          setProfile({ ...profile, avatar });
          close();
        }}
      />
      <PseudoModal
        key={`pseudo-${opening}`}
        open={modal === "pseudo"}
        pseudo={profile.pseudoChosen ? profile.pseudo : null}
        onClose={close}
        onSaved={(pseudo) => {
          setProfile({ ...profile, pseudo, pseudoChosen: true });
          close();
        }}
      />
      <PasswordModal key={`password-${opening}`} open={modal === "password"} onClose={close} />
      <StatsModal open={modal === "stats"} profile={profile} onClose={close} />
      <DeleteAccountModal key={`delete-${opening}`} open={modal === "delete"} onClose={close} />
    </div>
  );
}
