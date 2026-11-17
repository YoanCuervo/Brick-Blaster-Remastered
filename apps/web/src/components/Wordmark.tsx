import { Link } from "../router";
import { ROUTES } from "../routes";

export function Wordmark() {
  return (
    <Link className="wordmark" to={ROUTES.home}>
      <i aria-hidden="true" />
      Brick Blaster
    </Link>
  );
}
