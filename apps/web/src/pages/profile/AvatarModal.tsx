import { useRef, useState, type KeyboardEvent } from "react";
import { changeAvatar } from "../../api/profile";
import { AVATARS, AvatarArt } from "../../components/Avatar";
import { Modal } from "../../components/Modal";

interface AvatarModalProps {
  open: boolean;
  avatar: number | null;
  onClose: () => void;
  onSaved: (avatar: number) => void;
}

const COLUMNS = 3;
const MOVES: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: COLUMNS,
  ArrowUp: -COLUMNS,
};

export function AvatarModal({ open, avatar, onClose, onSaved }: AvatarModalProps) {
  const [selected, setSelected] = useState(avatar);
  const [pending, setPending] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Radio group: arrows move the choice and the focus together, wrapping around the grid.
  const onKeyDown = (event: KeyboardEvent) => {
    const move = MOVES[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next = ((selected ?? 0) + move + AVATARS.length) % AVATARS.length;
    setSelected(next);
    buttons.current[next]?.focus();
  };

  async function save() {
    if (pending) return;
    if (selected === null || selected === avatar) {
      onClose();
      return;
    }
    setPending(true);
    await changeAvatar(selected);
    setPending(false);
    onSaved(selected);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="avatar-title" width={440}>
      <div className="modal-head">
        <h2 id="avatar-title" className="h2">
          Choisir un avatar
        </h2>
        <button className="close" type="button" aria-label="Fermer" onClick={onClose}>
          ×
        </button>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="avatar-title"
        className="avatar-grid"
        onKeyDown={onKeyDown}
      >
        {AVATARS.map((item, index) => (
          <button
            key={item.label}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected === index}
            aria-label={item.label}
            tabIndex={index === (selected ?? 0) ? 0 : -1}
            className="avatar-choice"
            onClick={() => setSelected(index)}
          >
            <AvatarArt index={index} />
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          Annuler
        </button>
        <button
          className="btn btn-primary"
          type="button"
          aria-busy={pending}
          onClick={() => void save()}
        >
          Valider
        </button>
      </div>
    </Modal>
  );
}
