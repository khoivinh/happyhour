import { useEffect, useRef } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

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

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  use24Hour: boolean;
  onToggle24Hour: (value: boolean) => void;
  sortEastToWest: boolean;
  onToggleSortEastToWest: (value: boolean) => void;
}

export function Sidebar({
  open,
  onClose,
  use24Hour,
  onToggle24Hour,
  sortEastToWest,
  onToggleSortEastToWest,
}: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const sidebarRef = useRef<HTMLDivElement>(null);

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
    if (theme === "system") return <Monitor className="h-[24px] w-[24px]" />;
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
        className={`absolute top-[28px] right-[-20px] z-[70] w-[320px] bg-[#333] rounded-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.15)] overflow-hidden ${
          open
            ? "pointer-events-auto"
            : "pointer-events-none"
        }`}
        style={{
          height: "calc(100vh - 56px)",
          animation: open
            ? "sidebar-open 350ms cubic-bezier(0.32, 0.72, 0, 1) forwards"
            : "sidebar-close 250ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
        }}
      >
        <div
          className={`flex flex-col gap-[53px] h-full pl-[25px] pr-[20px] pt-[18px] pb-[28px] transition-opacity duration-200 ${
            open ? "opacity-100 delay-150" : "opacity-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-start gap-[23px]">
            <div className="flex-1 min-w-0">
              <button
                className="bg-[#4e82ee] rounded-[6px] px-[12px] pt-[6px] pb-[7px] text-white font-semibold text-[14px] leading-[21px] tracking-[-0.1px] whitespace-nowrap"
                onClick={() => {/* No-op for now */}}
              >
                Login or Sign Up
              </button>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-[#efefef] hover:text-white transition-colors"
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
          </div>
        </div>
      </div>
    </>
  );
}

export { DrawerToggleIcon };
