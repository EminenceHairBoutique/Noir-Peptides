export function Slider({ defaultValue=[0,100], min=0, max=100, step=1, onValueChange }) {
  const isRange = defaultValue.length === 2;
  const [startVal, endVal] = defaultValue;

  function handleStart(e) {
    const newVal = Number(e.target.value);
    if (isRange) {
      onValueChange([newVal, endVal]);
    } else {
      onValueChange([newVal]);
    }
  }

  function handleEnd(e) {
    const newVal = Number(e.target.value);
    onValueChange([startVal, newVal]);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={startVal}
        onChange={handleStart}
        className="w-16 rounded border border-black/20 px-2 py-1 text-sm"
      />
      {isRange && (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          defaultValue={endVal}
          onChange={handleEnd}
          className="w-16 rounded border border-black/20 px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}
