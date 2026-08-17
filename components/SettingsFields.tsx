"use client";

import { Settings } from "@/lib/stats";

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
};

const SPEEDS: { label: string; value: number }[] = [
  { label: "Traag", value: 0.65 },
  { label: "Normaal", value: 1 },
  { label: "Snel", value: 1.7 },
];

const CLOCKS: { label: string; value: number }[] = [
  { label: "Uit", value: 0 },
  { label: "30s", value: 30 },
  { label: "15s", value: 15 },
];

export default function SettingsFields({ settings, onChange }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="settings">
      <div className="set-row">
        <span className="set-label">Tempo</span>
        <div className="seg">
          {SPEEDS.map((s) => (
            <button
              key={s.label}
              type="button"
              className={settings.speed === s.value ? "on" : ""}
              onClick={() => set("speed", s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="set-row">
        <span className="set-label">Bedenktijd</span>
        <div className="seg">
          {CLOCKS.map((s) => (
            <button
              key={s.label}
              type="button"
              className={settings.clock === s.value ? "on" : ""}
              onClick={() => set("clock", s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <label className="set-toggle">
        <input
          type="checkbox"
          checked={settings.coach}
          onChange={(e) => set("coach", e.target.checked)}
        />
        <span>
          <b>Coach</b>
          <small>Eén zin na elke hand over je belangrijkste beslissing</small>
        </span>
      </label>

      <label className="set-toggle">
        <input
          type="checkbox"
          checked={settings.equityMeter}
          onChange={(e) => set("equityMeter", e.target.checked)}
        />
        <span>
          <b>Winkans tonen</b>
          <small>Live percentage tijdens jouw beurt — makkelijker, maar minder spannend</small>
        </span>
      </label>

      <label className="set-toggle">
        <input
          type="checkbox"
          checked={settings.chatter}
          onChange={(e) => set("chatter", e.target.checked)}
        />
        <span>
          <b>Tafelpraat</b>
          <small>De bots reageren op wat er gebeurt</small>
        </span>
      </label>

      <label className="set-toggle">
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(e) => set("sound", e.target.checked)}
        />
        <span>
          <b>Geluid</b>
          <small>Chips, kaarten en de fanfare bij winst</small>
        </span>
      </label>
    </div>
  );
}
