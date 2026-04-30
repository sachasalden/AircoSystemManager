import { useId, useMemo, useState } from 'react';

type SemiCircularTemperatureSliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  virtualTemperature?: number;
  zone: 1 | 2;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const VIEWBOX_WIDTH = 280;
const VIEWBOX_HEIGHT = 180;
const CENTER_X = 140;
const CENTER_Y = 130;
const RADIUS = 96;
const STROKE_WIDTH = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, min: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Number(snapped.toFixed(1));
}

function formatNumber(value: number | undefined, fallback = '-'): string {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function SemiCircularTemperatureSlider({
  value,
  min,
  max,
  step = 0.5,
  virtualTemperature,
  zone,
  disabled = false,
  onChange,
}: SemiCircularTemperatureSliderProps) {
  const [dragging, setDragging] = useState(false);
  const generatedId = useId();
  const gradientId = `temp-gradient-${generatedId.replace(/:/g, '')}`;

  const percent = useMemo(() => {
    if (max <= min) return 0;

    return clamp(((value - min) / (max - min)) * 100, 0, 100);
  }, [value, min, max]);

  const angle = 180 - (percent / 100) * 180;
  const angleInRad = (angle * Math.PI) / 180;

  const knobX = CENTER_X + RADIUS * Math.cos(angleInRad);
  const knobY = CENTER_Y - RADIUS * Math.sin(angleInRad);

  const arcPath = `
    M ${CENTER_X - RADIUS} ${CENTER_Y}
    A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER_X + RADIUS} ${CENTER_Y}
  `;

  function updateFromPointer(
    clientX: number,
    clientY: number,
    svgElement: SVGSVGElement,
  ) {
    if (disabled) return;

    const rect = svgElement.getBoundingClientRect();

    const x = ((clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;

    const rawAngle = (Math.atan2(CENTER_Y - y, x - CENTER_X) * 180) / Math.PI;
    const clampedAngle = clamp(rawAngle, 0, 180);

    const nextPercent = (180 - clampedAngle) / 180;
    const rawValue = min + nextPercent * (max - min);
    const snappedValue = snapToStep(rawValue, min, step);

    onChange(clamp(snappedValue, min, max));
  }

  return (
    <div className={`airco-semicircle ${disabled ? 'disabled' : ''}`}>
      <svg
        className="airco-semicircle-svg"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="slider"
        aria-label="Temperature setpoint"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={(event) => {
          if (disabled) return;

          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (!dragging || disabled) return;

          updateFromPointer(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(event) => {
          if (disabled) return;

          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            onChange(clamp(value - step, min, max));
          }

          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            onChange(clamp(value + step, min, max));
          }
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="45%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>

          <filter id={`${gradientId}-glow`}>
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${percent} 100`}
          filter={`url(#${gradientId}-glow)`}
        />

        <text
          x={CENTER_X - RADIUS}
          y={CENTER_Y + 28}
          textAnchor="middle"
          className="arc-end-label"
        >
          {min}°
        </text>

        <text
          x={CENTER_X + RADIUS}
          y={CENTER_Y + 28}
          textAnchor="middle"
          className="arc-end-label"
        >
          {max}°
        </text>

        <circle cx={knobX} cy={knobY} r="15" fill="rgba(255,255,255,0.2)" />

        <circle
          cx={knobX}
          cy={knobY}
          r="11"
          fill="#ffffff"
          className="airco-semicircle-knob"
        />

        <circle cx={knobX} cy={knobY} r="5" fill={`url(#${gradientId})`} />
      </svg>

      <div className="airco-semicircle-center">
        <p className="arc-center-label">Virtual temp</p>
        <strong className="arc-center-value">
          {formatNumber(virtualTemperature)}°
        </strong>
        <span className="arc-center-sub">
          Target {formatNumber(value)}° · Zone {zone}
        </span>
      </div>
    </div>
  );
}
