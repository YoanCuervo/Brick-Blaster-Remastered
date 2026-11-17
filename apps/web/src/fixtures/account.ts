/** Stand-in data for the account screens until the API has its auth routes. */

/** Already registered pseudos; the check ignores case, as the server will. */
export const TAKEN_PSEUDOS = ["NovaKrak", "Limbo", "BrickLord"];

/** The one account the fake sign-in accepts. */
export const DEMO_ACCOUNT = { email: "nova@exemple.fr", password: "motdepasse12" };

/** A reset link carrying this token behaves as an expired one. */
export const EXPIRED_RESET_TOKEN = "expire";
