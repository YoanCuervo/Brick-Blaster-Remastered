import { AVATAR_COUNT, DELETE_CONFIRMATION, PSEUDO_MAX, PSEUDO_MIN, PSEUDO_PATTERN } from "./rules";

/** The signed-in player, as GET /api/me and a successful sign-in give it. */
export interface Me {
  pseudo: string;
  /** False while the player keeps the provisional pseudo given at sign-up. */
  pseudoChosen: boolean;
  /** Index in the avatar gallery, null until the player picks one. */
  avatar: number | null;
}

export const meReply = {
  type: "object",
  required: ["pseudo", "pseudoChosen", "avatar"],
  additionalProperties: false,
  properties: {
    pseudo: { type: "string" },
    pseudoChosen: { type: "boolean" },
    avatar: { type: ["integer", "null"] },
  },
} as const;

export interface PseudoBody {
  pseudo: string;
}
export const pseudoBody = {
  type: "object",
  required: ["pseudo"],
  additionalProperties: false,
  properties: {
    pseudo: {
      type: "string",
      minLength: PSEUDO_MIN,
      maxLength: PSEUDO_MAX,
      pattern: PSEUDO_PATTERN,
    },
  },
} as const;

export interface AvatarBody {
  avatar: number;
}
export const avatarBody = {
  type: "object",
  required: ["avatar"],
  additionalProperties: false,
  properties: { avatar: { type: "integer", minimum: 0, maximum: AVATAR_COUNT - 1 } },
} as const;

export interface DeleteAccountBody {
  confirm: typeof DELETE_CONFIRMATION;
}
export const deleteAccountBody = {
  type: "object",
  required: ["confirm"],
  additionalProperties: false,
  properties: { confirm: { type: "string", const: DELETE_CONFIRMATION } },
} as const;
