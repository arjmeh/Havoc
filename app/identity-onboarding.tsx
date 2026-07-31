"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./social-onboarding.module.css";
import type {
  HavocAvatar,
  IdentityOnboardingProps,
  PrototypeProfile,
} from "./social-onboarding.types";

const DEFAULT_STORAGE_KEY = "havoc.prototype.profile";
const USERNAME_PATTERN = /^[a-z0-9_]{3,16}$/;

export const FALLBACK_AVATARS: readonly HavocAvatar[] = [
  { id: "mischief", name: "Mischief", glyph: "😏", background: "#cbb8ff" },
  { id: "grin", name: "Big grin", glyph: "😁", background: "#ffe36c" },
  { id: "starstruck", name: "Starstruck", glyph: "🤩", background: "#ffb5c0" },
  { id: "cool", name: "Cool", glyph: "😎", background: "#91e8ff" },
  { id: "wild", name: "Wild", glyph: "🤪", background: "#b9ff65" },
  { id: "wink", name: "Wink", glyph: "😉", background: "#ffbd85" },
  { id: "party", name: "Party", glyph: "🥳", background: "#d6c5ff" },
  { id: "determined", name: "Determined", glyph: "😤", background: "#ff9a96" },
  { id: "shocked", name: "Shocked", glyph: "😮", background: "#8ff0df" },
  { id: "silly", name: "Silly", glyph: "😜", background: "#ffd66b" },
  { id: "laughing", name: "Laughing", glyph: "🤣", background: "#bde4ff" },
  { id: "angel", name: "Angel", glyph: "😇", background: "#e9dfff" },
  {
    id: "fire-eyes",
    name: "Fire eyes",
    glyph: "🤯",
    background: "#ff8e74",
    tier: "exclusive",
  },
  {
    id: "royal",
    name: "Royal",
    glyph: "🤑",
    background: "#ffe266",
    tier: "exclusive",
  },
  {
    id: "cosmic",
    name: "Cosmic",
    glyph: "🫨",
    background: "#a99cff",
    tier: "exclusive",
  },
  {
    id: "chrome",
    name: "Chrome",
    glyph: "🤖",
    background: "#b9c6d2",
    tier: "exclusive",
  },
  {
    id: "electric",
    name: "Electric",
    glyph: "🤬",
    background: "#a8f5ff",
    tier: "exclusive",
  },
  {
    id: "mystery",
    name: "Mystery",
    glyph: "🥸",
    background: "#f1b8ff",
    tier: "exclusive",
  },
];

type Availability = "idle" | "invalid" | "checking" | "available";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.7 5.3 4 4M4 20l4.4-1 10.2-10.2a1.9 1.9 0 0 0 0-2.7l-.7-.7a1.9 1.9 0 0 0-2.7 0L5 15.6 4 20Z" />
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
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

function AvatarArtwork({
  avatar,
  large = false,
}: {
  avatar: HavocAvatar;
  large?: boolean;
}) {
  const src = avatar.thumbnailSrc ?? avatar.imageSrc;

  return (
    <span
      className={`${styles.avatarArtwork} ${large ? styles.avatarArtworkLarge : ""}`}
      style={{ "--avatar-bg": avatar.background ?? "#cbb8ff" } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.avatarGlow} />
      <span className={styles.avatarGlyph}>{avatar.glyph}</span>
      {src ? (
        // The catalog branch supplies generated local WebP artwork. Hiding a
        // failed image keeps this component useful before that branch lands.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading={large ? "eager" : "lazy"}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </span>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden);
}

function cleanUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
}

export function IdentityOnboardingScreen({
  onComplete,
  initialProfile,
  avatarCatalog = FALLBACK_AVATARS,
  storageKey = DEFAULT_STORAGE_KEY,
}: IdentityOnboardingProps) {
  const safeCatalog = avatarCatalog.length > 0 ? avatarCatalog : FALLBACK_AVATARS;
  const firstUnlocked =
    safeCatalog.find((avatar) => avatar.tier !== "exclusive") ?? FALLBACK_AVATARS[0];
  const [username, setUsername] = useState(
    cleanUsername(initialProfile?.username ?? ""),
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState(
    initialProfile?.avatarId ?? firstUnlocked.id,
  );
  const [availability, setAvailability] = useState<Availability>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const availabilityId = useId();
  const helpId = useId();
  const sheetTitleId = useId();
  const pencilRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const selectedAvatar =
    safeCatalog.find(
      (avatar) =>
        avatar.id === selectedAvatarId && avatar.tier !== "exclusive",
    ) ?? firstUnlocked;

  useEffect(() => {
    if (initialProfile?.username || initialProfile?.avatarId) return;

    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<PrototypeProfile>;
      const storedUsername = cleanUsername(parsed.username ?? "");
      const storedAvatar = safeCatalog.find(
        (avatar) =>
          avatar.id === parsed.avatarId && avatar.tier !== "exclusive",
      );

      if (storedUsername) setUsername(storedUsername);
      if (storedAvatar) setSelectedAvatarId(storedAvatar.id);
    } catch {
      // A corrupt or blocked session store should never block onboarding.
    }
  }, [initialProfile, safeCatalog, storageKey]);

  useEffect(() => {
    if (!username) {
      setAvailability("idle");
      return;
    }

    if (!USERNAME_PATTERN.test(username)) {
      setAvailability("invalid");
      return;
    }

    setAvailability("checking");
    const timer = window.setTimeout(() => setAvailability("available"), 450);
    return () => window.clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    if (!pickerOpen) return;

    const sheet = sheetRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      getFocusableElements(sheet ?? document.body)[0]?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPickerOpen(false);
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
      pencilRef.current?.focus();
    };
  }, [pickerOpen]);

  const statusMessage = useMemo(() => {
    if (availability === "available") return `@${username} is available`;
    if (availability === "checking") return `Checking @${username}`;
    if (availability === "invalid") {
      return username.length < 3
        ? "Keep going—usernames need at least 3 characters."
        : "Use only lowercase letters, numbers, and underscores.";
    }
    return "3–16 lowercase letters, numbers, or underscores.";
  }, [availability, username]);

  const submitProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (availability !== "available") return;

    const profile: PrototypeProfile = {
      username,
      avatarId: selectedAvatar.id,
    };

    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(profile));
    } catch {
      // Continue even when storage is unavailable (private browsing policies).
    }
    onComplete(profile);
  };

  return (
    <section className={`${styles.screen} ${styles.identityScreen}`}>
      <div className={styles.backgroundShapes} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <form
        className={styles.screenContent}
        onSubmit={submitProfile}
        inert={pickerOpen ? true : undefined}
      >
        <header className={styles.header}>
          <p className={styles.kicker}>Make it yours</p>
          <h1>What should we call you?</h1>
          <p>Pick a name and a face. You can change both later.</p>
        </header>

        <div className={styles.avatarStage}>
          <div className={styles.avatarPreview}>
            <AvatarArtwork avatar={selectedAvatar} large />
          </div>
          <button
            ref={pencilRef}
            className={styles.editAvatarButton}
            type="button"
            aria-label={`Change avatar. Current avatar: ${selectedAvatar.name}`}
            onClick={() => setPickerOpen(true)}
          >
            <PencilIcon />
          </button>
          <span className={styles.avatarName}>{selectedAvatar.name}</span>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="havoc-username">Username</label>
          <div
            className={`${styles.usernameField} ${
              availability === "available" ? styles.usernameFieldSuccess : ""
            } ${availability === "invalid" ? styles.usernameFieldInvalid : ""}`}
          >
            <span aria-hidden="true">@</span>
            <input
              id="havoc-username"
              value={username}
              onChange={(event) => setUsername(cleanUsername(event.target.value))}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="done"
              minLength={3}
              maxLength={16}
              pattern="[a-z0-9_]{3,16}"
              placeholder="yourname"
              aria-describedby={`${helpId} ${availabilityId}`}
              aria-invalid={availability === "invalid"}
              required
            />
            <span className={styles.fieldStatusIcon} aria-hidden="true">
              {availability === "checking" ? (
                <span className={styles.spinner} />
              ) : availability === "available" ? (
                <CheckIcon />
              ) : null}
            </span>
          </div>
          <p id={helpId} className={styles.srOnly}>
            Usernames must contain 3 to 16 lowercase letters, numbers, or
            underscores.
          </p>
          <p
            id={availabilityId}
            className={`${styles.fieldMessage} ${
              availability === "available" ? styles.fieldMessageSuccess : ""
            } ${availability === "invalid" ? styles.fieldMessageInvalid : ""}`}
            aria-live="polite"
          >
            {availability === "available" ? (
              <span aria-hidden="true">✓</span>
            ) : null}
            {statusMessage}
          </p>
        </div>

        <div className={styles.actionDock}>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={availability !== "available"}
          >
            Lock it in
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>

      {pickerOpen ? (
        <div
          className={styles.sheetOverlay}
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setPickerOpen(false);
          }}
        >
          <div
            ref={sheetRef}
            className={styles.bottomSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={sheetTitleId}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <div className={styles.sheetHeader}>
              <div>
                <p className={styles.kicker}>Choose your chaos</p>
                <h2 id={sheetTitleId}>Pick your face</h2>
              </div>
              <button
                className={styles.iconButton}
                type="button"
                aria-label="Close avatar picker"
                onClick={() => setPickerOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <p className={styles.sheetIntro}>
              Your avatar shows up in parties, reactions, and highlights.
            </p>
            <div className={styles.avatarGrid}>
              {safeCatalog.map((avatar) => {
                const locked = avatar.tier === "exclusive";
                const selected = avatar.id === selectedAvatar.id;

                return (
                  <button
                    key={avatar.id}
                    className={`${styles.avatarButton} ${
                      selected ? styles.avatarButtonSelected : ""
                    } ${locked ? styles.avatarButtonLocked : ""}`}
                    type="button"
                    disabled={locked}
                    aria-label={
                      locked
                        ? `${avatar.name}. Exclusive avatar—locked`
                        : `${avatar.name}${selected ? ", selected" : ""}`
                    }
                    aria-pressed={locked ? undefined : selected}
                    onClick={() => {
                      setSelectedAvatarId(avatar.id);
                      window.setTimeout(() => setPickerOpen(false), 180);
                    }}
                  >
                    <span className={styles.avatarMedia}>
                      <AvatarArtwork avatar={avatar} />
                    </span>
                    {locked ? (
                      <span className={styles.lockBadge} aria-hidden="true">
                        <LockIcon />
                      </span>
                    ) : null}
                    {selected ? (
                      <span className={styles.selectedBadge} aria-hidden="true">
                        <CheckIcon />
                      </span>
                    ) : null}
                    <span className={styles.avatarLabel}>{avatar.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default IdentityOnboardingScreen;
