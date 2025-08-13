import { useRef } from "react";
import { ClockIcon } from "../components/Icons";

export function TimeField({
  value, onChange, min
}: { value: string; onChange: (v: string) => void; min?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => ref.current?.showPicker ? ref.current.showPicker() : ref.current?.focus();

  return (
    <div className="w-full relative">
      <input
        ref={ref}
        type="time"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="tg-time w-full bg-tg-secondaryBg text-tg-text rounded-[12px] p-2 focus-input"
      />
      {/* Скрываем нативный индикатор, чтобы не было «стрелки» */}
      <style>{`input[type="time"]::-webkit-calendar-picker-indicator{display:none}`}</style>

      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-tg-secondaryBg rounded-r-[12px]"
        style={{ zIndex: 1 }}
      />

      <button
        type="button"
        onClick={open}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full hover:bg-tg-secondaryBg"
        style={{ zIndex: 2 }}
        aria-label="Выбрать время"
      >
        <ClockIcon className="w-5 h-5 text-tg-accent" />
      </button>

      <style>{`
        .tg-time::-webkit-calendar-picker-indicator{ opacity:0; }
      `}</style>
    </div>
  );
}
