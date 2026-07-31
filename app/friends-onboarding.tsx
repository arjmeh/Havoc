"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import styles from "./social-onboarding.module.css";
import type {
  FriendsOnboardingProps,
  MockFriend,
} from "./social-onboarding.types";

export const DEFAULT_MOCK_FRIENDS: readonly MockFriend[] = [
  {
    id: "maya",
    name: "Maya",
    handle: "@mayhemaya",
    avatar: "😈",
    status: "Ready for a rematch",
  },
  {
    id: "jules",
    name: "Jules",
    handle: "@juleswins",
    avatar: "😎",
    status: "Online now",
  },
  {
    id: "kai",
    name: "Kai",
    handle: "@chaoskai",
    avatar: "🤪",
    status: "2 mutual friends",
  },
  {
    id: "nora",
    name: "Nora",
    handle: "@no.rules.nora",
    avatar: "🤠",
    status: "Joined yesterday",
  },
  {
    id: "leo",
    name: "Leo",
    handle: "@loudleo",
    avatar: "🥳",
    status: "Looking for a party",
  },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13" />
      <path d="M12 7H8.8a2.3 2.3 0 1 1 2.3-2.3L12 7Zm0 0h3.2a2.3 2.3 0 1 0-2.3-2.3L12 7Z" />
    </svg>
  );
}

function cleanInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden);
}

function FriendsHero({
  src,
  poster,
}: {
  src?: string;
  poster?: string;
}) {
  const [failed, setFailed] = useState(false);
  const isVideo = src ? /\.(mp4|webm|mov)(?:\?.*)?$/i.test(src) : false;

  return (
    <div className={styles.friendsHero} aria-label="Three friends reacting together">
      <div className={styles.heroBurst} aria-hidden="true" />
      {src && !failed ? (
        isVideo ? (
          <video
            className={styles.heroMedia}
            src={src}
            poster={poster}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            onError={() => setFailed(true)}
          />
        ) : (
          // The asset branch supplies a transparent animated WebP.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.heroMedia}
            src={src}
            alt=""
            width={260}
            height={150}
            aria-hidden="true"
            onError={() => setFailed(true)}
          />
        )
      ) : null}
      <div
        className={`${styles.heroFallback} ${
          src && !failed ? styles.heroFallbackUnderlay : ""
        }`}
        aria-hidden="true"
      >
        <span>😈</span>
        <span>😎</span>
        <span>🤪</span>
      </div>
    </div>
  );
}

export function FriendsOnboardingScreen({
  onComplete,
  heroAnimationSrc,
  heroPosterSrc,
  friends = DEFAULT_MOCK_FRIENDS,
}: FriendsOnboardingProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const [inviteCode, setInviteCode] = useState("");
  const [inviteState, setInviteState] = useState<
    "idle" | "invalid" | "accepted"
  >("idle");
  const searchTitleId = useId();
  const inviteMessageId = useId();
  const findFriendsRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const filteredFriends = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(query) ||
        friend.handle.toLowerCase().includes(query),
    );
  }, [friends, search]);

  useEffect(() => {
    if (!searchOpen) return;

    const sheet = sheetRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      sheet?.querySelector<HTMLInputElement>("input")?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSearchOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sheet) return;

      const focusable = getFocusableElements(sheet);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      findFriendsRef.current?.focus();
    };
  }, [searchOpen]);

  const toggleFriend = (friendId: string) => {
    setAddedIds((current) => {
      const next = new Set(current);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const applyInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteState(inviteCode.length === 6 ? "accepted" : "invalid");
  };

  const canContinue = addedIds.size > 0 || inviteState === "accepted";

  return (
    <section className={`${styles.screen} ${styles.friendsScreen}`}>
      <div className={styles.backgroundShapes} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div
        className={`${styles.screenContent} ${styles.friendsContent}`}
        inert={searchOpen ? true : undefined}
      >
        <FriendsHero src={heroAnimationSrc} poster={heroPosterSrc} />

        <header className={`${styles.header} ${styles.friendsHeader}`}>
          <p className={styles.kicker}>Bring your people</p>
          <h1>Havoc is better with friends.</h1>
          <p>
            Find your people now, or enter an invite code. If a friend invited
            you, you&apos;ll both unlock a reward.
          </p>
        </header>

        <button
          ref={findFriendsRef}
          className={styles.primaryButton}
          type="button"
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon />
          {addedIds.size > 0
            ? `${addedIds.size} friend${addedIds.size === 1 ? "" : "s"} added`
            : "Find friends"}
        </button>

        <div className={styles.orDivider}>
          <span />
          <b>or</b>
          <span />
        </div>

        <form className={styles.inviteCard} onSubmit={applyInvite}>
          <div className={styles.inviteHeading}>
            <span className={styles.giftBadge} aria-hidden="true">
              <GiftIcon />
            </span>
            <div>
              <label htmlFor="havoc-invite-code">Have an invite code?</label>
              <p>You&apos;ll both be rewarded.</p>
            </div>
          </div>
          <div className={styles.inviteRow}>
            <input
              id="havoc-invite-code"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(cleanInviteCode(event.target.value));
                setInviteState("idle");
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              placeholder="ABC123"
              aria-describedby={inviteMessageId}
              aria-invalid={inviteState === "invalid"}
            />
            <button type="submit" disabled={inviteCode.length !== 6}>
              Apply code
            </button>
          </div>
          <p
            id={inviteMessageId}
            className={`${styles.inviteMessage} ${
              inviteState === "accepted" ? styles.inviteMessageSuccess : ""
            } ${inviteState === "invalid" ? styles.inviteMessageInvalid : ""}`}
            aria-live="polite"
          >
            {inviteState === "accepted" ? (
              <>
                <CheckIcon />
                Code accepted—your rewards are queued.
              </>
            ) : inviteState === "invalid" ? (
              "Enter all 6 letters or numbers."
            ) : (
              "6 letters or numbers"
            )}
          </p>
        </form>

        <div className={styles.actionDock}>
          {canContinue ? (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() =>
                onComplete({
                  reason:
                    inviteState === "accepted"
                      ? "invite-applied"
                      : "friends-added",
                  addedFriendIds: Array.from(addedIds),
                  inviteCode:
                    inviteState === "accepted" ? inviteCode : undefined,
                })
              }
            >
              Continue to Havoc
              <span aria-hidden="true">→</span>
            </button>
          ) : null}
          <button
            className={styles.textButton}
            type="button"
            onClick={() =>
              onComplete({ reason: "skipped", addedFriendIds: [] })
            }
          >
            Skip for now
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div
          className={styles.sheetOverlay}
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
        >
          <div
            ref={sheetRef}
            className={styles.bottomSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={searchTitleId}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <div className={styles.sheetHeader}>
              <div>
                <p className={styles.kicker}>Build the crew</p>
                <h2 id={searchTitleId}>Find friends</h2>
              </div>
              <button
                className={styles.iconButton}
                type="button"
                aria-label="Close friend search"
                onClick={() => setSearchOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Search mock friends</span>
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search a name or username"
              />
            </label>
            <div className={styles.friendList} aria-live="polite">
              {filteredFriends.length > 0 ? (
                filteredFriends.map((friend) => {
                  const added = addedIds.has(friend.id);
                  return (
                    <article className={styles.friendRow} key={friend.id}>
                      <span className={styles.friendAvatar} aria-hidden="true">
                        {friend.avatar}
                      </span>
                      <div>
                        <strong>{friend.name}</strong>
                        <span>{friend.handle}</span>
                        <small>{friend.status}</small>
                      </div>
                      <button
                        className={added ? styles.addedButton : styles.addButton}
                        type="button"
                        aria-pressed={added}
                        onClick={() => toggleFriend(friend.id)}
                      >
                        {added ? (
                          <>
                            <CheckIcon />
                            Added
                          </>
                        ) : (
                          "Add"
                        )}
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className={styles.emptyState}>
                  <strong>No players found</strong>
                  <p>Try another name—your future rival is out there.</p>
                </div>
              )}
            </div>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => setSearchOpen(false)}
            >
              {addedIds.size > 0
                ? `Done — ${addedIds.size} added`
                : "Done for now"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default FriendsOnboardingScreen;
