import type { SpeciesGroup } from '../types/iteration2'

const speciesOptions: Array<{ value: SpeciesGroup; label: string }> = [
  { value: 'native_bee', label: 'Native bee' },
  { value: 'butterfly', label: 'Butterfly' },
  { value: 'small_bird', label: 'Small bird' },
]

type SpeciesPerspectiveSelectorProps = {
  value: SpeciesGroup
  onChange: (value: SpeciesGroup) => void
}

export default function SpeciesPerspectiveSelector({ value, onChange }: SpeciesPerspectiveSelectorProps) {
  return <fieldset className="species-perspective-selector">
    <legend>Species perspective</legend>
    <div>
      {speciesOptions.map((option) => <button
        key={option.value}
        type="button"
        className={value === option.value ? 'active' : ''}
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
      >{option.label}</button>)}
    </div>
  </fieldset>
}
