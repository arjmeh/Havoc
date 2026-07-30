export type AvatarTier = "standard" | "exclusive";

export interface HavocAvatar {
  id: string;
  name: string;
  glyph: string;
  unicodeReference?: string;
  imageSrc?: string;
  thumbnailSrc?: string;
  background?: string;
  tier?: AvatarTier;
}

export interface PrototypeProfile {
  username: string;
  avatarId: string;
}

export interface IdentityOnboardingProps {
  onComplete: (profile: PrototypeProfile) => void;
  initialProfile?: Partial<PrototypeProfile>;
  avatarCatalog?: readonly HavocAvatar[];
  storageKey?: string;
}

export type FriendsCompletionReason =
  | "friends-added"
  | "invite-applied"
  | "skipped";

export interface MockFriend {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  status: string;
}

export interface FriendsOnboardingResult {
  reason: FriendsCompletionReason;
  addedFriendIds: string[];
  inviteCode?: string;
}

export interface FriendsOnboardingProps {
  onComplete: (result: FriendsOnboardingResult) => void;
  heroAnimationSrc?: string;
  heroPosterSrc?: string;
  friends?: readonly MockFriend[];
}
