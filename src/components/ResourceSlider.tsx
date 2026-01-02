interface ResourceSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  available: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

export default function ResourceSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  available,
  icon: Icon,
  color = 'accent',
}: ResourceSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const maxAllowed = Math.min(max, available);
  const exceeds = value > available;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label flex items-center gap-2">
          <Icon className={`w-4 h-4 text-${color}-400`} />
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${exceeds ? 'text-red-400' : 'text-white'}`}>
            {value.toLocaleString()} {unit}
          </span>
          <span className="text-xs text-gray-500">
            / {available.toLocaleString()} {unit}
          </span>
        </div>
      </div>
      
      <div className="relative">
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          min={min}
          max={maxAllowed}
          step={step}
          className="slider w-full"
          style={{
            background: `linear-gradient(to right, 
              rgb(var(--color-${color})) 0%, 
              rgb(var(--color-${color})) ${percentage}%, 
              rgb(31, 41, 55) ${percentage}%, 
              rgb(31, 41, 55) 100%)`
          }}
        />
        {exceeds && (
          <p className="text-xs text-red-400 mt-1">
            ⚠️ Insufficient resources available
          </p>
        )}
      </div>
    </div>
  );
}
