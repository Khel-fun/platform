interface GameStatusProps {
  xp: number;
  revealedCount: number;
  /** When false, stats row is hidden (disconnected empty state). */
  connected: boolean;
}

export default function GameStatus({ xp, revealedCount, connected }: GameStatusProps) {
  if (!connected) {
    return null;
  }

  return (
    <div className="status-bar">
      <div className="stat-pills-row">
        <div className="stat-pill stat-pill--gold" id="xp-counter">
          <span className="stat-pill-icon" aria-hidden>
            ⭐
          </span>
          <span className="stat-pill-value">{xp} XP</span>
        </div>
        <div className="stat-pill stat-pill--blue" id="cells-revealed">
          <span className="stat-pill-icon" aria-hidden>
            ⛏️
          </span>
          <span className="stat-pill-value">{revealedCount}/71</span>
        </div>
      </div>
    </div>
  );
}
