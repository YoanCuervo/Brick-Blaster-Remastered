import logoCompact from "../assets/logo/logo-compact.png";
import { Link } from "../router";
import { ROUTES } from "../routes";

export function Wordmark() {
  return (
    <Link className="wordmark" to={ROUTES.home}>
      <img src={logoCompact} alt="Brick Blaster Remastered" width={266} height={72} />
    </Link>
  );
}
