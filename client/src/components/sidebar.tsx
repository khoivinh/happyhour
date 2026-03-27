import { useEffect, useRef } from "react";
import { Monitor, Smartphone, Sun, Moon, Check, Loader2, CloudOff, AlertCircle } from "lucide-react";
import { SignInButton, SignOutButton, useUser, useAuth } from "@clerk/clerk-react";
import { useTheme } from "@/lib/theme-provider";
import type { SyncStatus } from "@/hooks/use-cloud-sync";

const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-[33px] h-[18px] rounded-full border transition-colors duration-200 shrink-0 bg-transparent ${
        checked
          ? "border-[#22c55e]"
          : "border-[#6b7280]"
      }`}
    >
      <span
        className={`absolute left-0 top-[2px] w-[12px] h-[12px] rounded-full transition-transform duration-200 ${
          checked
            ? "translate-x-[17px] bg-[#22c55e]"
            : "translate-x-[2px] bg-[#6b7280]"
        }`}
      />
    </button>
  );
}

function DrawerToggleIcon({ open }: { open: boolean }) {
  if (open) {
    // Opened state: lines with right-pointing collapse indicator
    return (
      <svg width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="23" height="19" rx="2.5" stroke="currentColor" />
        <line x1="16" y1="0.5" x2="16" y2="19.5" stroke="currentColor" />
        <path d="M6.75 7L9.25 10L6.75 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // Closed state: simple sidebar icon
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="23" height="19" rx="2.5" stroke="currentColor" />
      <line x1="16" y1="0.5" x2="16" y2="19.5" stroke="currentColor" />
    </svg>
  );
}

function SyncStatusIndicator({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;

  const config = {
    syncing: { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Syncing..." },
    synced: { icon: <Check className="h-3 w-3" />, label: "Synced" },
    offline: { icon: <CloudOff className="h-3 w-3" />, label: "Offline" },
    error: { icon: <AlertCircle className="h-3 w-3" />, label: "Sync error" },
  }[status];

  if (!config) return null;

  return (
    <div className="flex items-center gap-[6px] text-[12px] text-[#9ca3af]">
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}

// Auth header section when Clerk is configured
function AuthHeader({ showLogout }: { showLogout?: boolean }) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  if (isSignedIn && user) {
    const firstName = user.firstName || user.fullName?.split(" ")[0] || "User";
    const email = user.primaryEmailAddress?.emailAddress;

    return (
      <>
        <div className="flex-1 min-w-0">
          <p className="font-display text-[14px] font-black leading-[22px] tracking-[-0.43px] text-[#efefef]">
            Welcome back,
          </p>
          <p className="font-display text-[29px] font-black leading-[32px] tracking-[-0.43px] text-[#efefef]">
            {firstName}
          </p>
          {email && (
            <p className="text-[14px] font-normal leading-[23px] text-[#efefef]">
              {email}
            </p>
          )}
        </div>
        {/* Logout rendered as a menu item via the showLogout flag */}
      </>
    );
  }

  return (
    <SignInButton mode="modal">
      <button
        className="bg-[#4e82ee] rounded-[6px] px-[12px] pt-[7px] pb-[7px] text-white font-semibold text-[14px] leading-[21px] tracking-[-0.1px] whitespace-nowrap"
      >
        Login or Sign Up
      </button>
    </SignInButton>
  );
}

function LogoutMenuItem() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return null;

  return (
    <SignOutButton>
      <button className="flex items-center h-[28px] w-full">
        <span className="flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#efefef] text-left">
          Logout
        </span>
      </button>
    </SignOutButton>
  );
}

// Fallback header when Clerk isn't configured
function AuthHeaderFallback() {
  return (
    <button
      className="bg-[#4e82ee] rounded-[6px] px-[12px] pt-[7px] pb-[7px] text-white font-semibold text-[14px] leading-[21px] tracking-[-0.1px] whitespace-nowrap opacity-50 cursor-not-allowed"
      disabled
    >
      Login or Sign Up
    </button>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  use24Hour: boolean;
  onToggle24Hour: (value: boolean) => void;
  sortEastToWest: boolean;
  onToggleSortEastToWest: (value: boolean) => void;
  showRelativeTime: boolean;
  onToggleShowRelativeTime: (value: boolean) => void;
  topOffset?: number;
  syncStatus: SyncStatus;
}

export function Sidebar({
  open,
  onClose,
  use24Hour,
  onToggle24Hour,
  sortEastToWest,
  onToggleSortEastToWest,
  showRelativeTime,
  onToggleShowRelativeTime,
  topOffset = 28,
  syncStatus,
}: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hasBeenOpened = useRef(false);

  useEffect(() => {
    if (open) hasBeenOpened.current = true;
  }, [open]);

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close when clicking outside the sidebar
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use setTimeout to avoid the same click that opened the sidebar from closing it
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  function cycleTheme() {
    if (theme === "system") {
      setTheme("light");
    } else if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("system");
    }
  }

  function getThemeIcon() {
    if (theme === "system") {
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      return isTouchDevice
        ? <Smartphone className="h-[24px] w-[24px]" />
        : <Monitor className="h-[24px] w-[24px]" />;
    }
    if (theme === "light") return <Sun className="h-[24px] w-[24px]" />;
    return <Moon className="h-[24px] w-[24px]" />;
  }

  function getThemeLabel() {
    if (theme === "system") return "System";
    if (theme === "light") return "Light";
    return "Dark";
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
          open ? "bg-black/30 opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        className={`absolute right-[-10px] z-[70] w-[calc(100vw-32px)] sm:w-[320px] bg-[#333] rounded-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.15)] overflow-hidden ${
          open
            ? "pointer-events-auto"
            : "pointer-events-none"
        }`}
        style={{
          top: `${topOffset - 18}px`,
          height: `calc(92dvh - ${topOffset - 18 + 28}px)`,
          animation: open
            ? "sidebar-open 350ms cubic-bezier(0.32, 0.72, 0, 1) forwards"
            : hasBeenOpened.current
              ? "sidebar-close 250ms cubic-bezier(0.32, 0.72, 0, 1) forwards"
              : "none",
          opacity: !open && !hasBeenOpened.current ? 0 : undefined,
        }}
      >
        <div
          className={`flex flex-col gap-[53px] h-full pl-[20px] pr-[20px] pt-[18px] pb-[28px] transition-opacity duration-200 ${
            open ? "opacity-100 delay-150" : "opacity-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-start gap-[23px]">
            <div className="flex-1 min-w-0">
              {isClerkConfigured ? <AuthHeader /> : <AuthHeaderFallback />}
              {syncStatus !== "idle" && (
                <div className="mt-[8px]">
                  <SyncStatusIndicator status={syncStatus} />
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-[24px] h-[20px] text-[#efefef] hover:text-white transition-colors mt-[2px]"
              aria-label="Close sidebar"
            >
              <DrawerToggleIcon open={true} />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex flex-col gap-[20px]">
            {/* Appearance */}
            <button
              onClick={cycleTheme}
              className="flex items-center h-[28px] w-full"
            >
              <span className="flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#efefef] text-left">
                Appearance
              </span>
              <span className="shrink-0 text-[#efefef]" title={getThemeLabel()}>
                {getThemeIcon()}
              </span>
            </button>

            {/* 24-Hour Clock */}
            <div className="flex items-center h-[28px]">
              <span className="flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#efefef]">
                24-Hour Clock
              </span>
              <ToggleSwitch checked={use24Hour} onChange={onToggle24Hour} />
            </div>

            {/* Sort East-to-West */}
            <div className="flex items-center h-[28px]">
              <span className="flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#efefef]">
                Sort East-to-West
              </span>
              <ToggleSwitch checked={sortEastToWest} onChange={onToggleSortEastToWest} />
            </div>

            {/* Show Relative Time */}
            <div className="flex items-center h-[28px]">
              <span className="flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#efefef]">
                Show Relative Time
              </span>
              <ToggleSwitch checked={showRelativeTime} onChange={onToggleShowRelativeTime} />
            </div>

            {/* Logout (only shown when signed in) */}
            {isClerkConfigured && <LogoutMenuItem />}
          </div>
        </div>
      </div>
    </>
  );
}

export { DrawerToggleIcon };
