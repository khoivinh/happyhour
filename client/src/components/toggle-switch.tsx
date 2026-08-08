interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Inert + grayed. Used where the setting has no effect on the current view (e.g. Relative Time
   *  in the Sharing View, where the viewer's own time isn't on screen to be relative to). */
  disabled?: boolean;
  testId?: string;
}

/**
 * The settings toggle, shared by the Sidebar and the Commit Bar's Sharing Options popover.
 *
 * Extracted from `sidebar.tsx` when the popover arrived (2026-08-08) rather than copied: the two
 * surfaces are meant to be visibly the same control, and a second hand-rolled switch is exactly how
 * they'd drift. There is no `ui/switch.tsx` — this is the app's only one.
 */
export function ToggleSwitch({ checked, onChange, disabled = false, testId }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onChange(!checked)}
      data-testid={testId}
      className={`relative w-[33px] h-[18px] rounded-full border transition-colors duration-200 shrink-0 bg-transparent ${
        disabled ? "opacity-40 cursor-not-allowed " : ""
      }${
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
