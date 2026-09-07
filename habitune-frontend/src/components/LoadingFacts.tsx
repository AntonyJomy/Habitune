import { useEffect, useState } from 'react'

const biodiversityFacts = [
  'Melbourne’s urban forest connects natural ecosystems and provides habitat for wildlife.',
  'Urban trees support biodiversity while helping cool streets and neighbourhoods.',
  'Flies, butterflies, moths and beetles can all act as pollinators.',
  'Many flowering plants rely on insect pollinators to produce fruit and seeds.',
  'Pollinators need water and nesting places as well as flowers.',
  'Hollow stems, dead wood and bare sandy ground can provide native bee nesting sites.',
  'Flowers available across the seasons support a wider variety of pollinators.',
  'Reducing chemical sprays can help protect pollinators and other beneficial insects.',
  'Native vegetation supports wildlife, stabilises soil and helps purify water.',
  'Artificial light at night can disrupt nocturnal pollinators such as moths.',
]

export default function LoadingFacts() {
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * biodiversityFacts.length))
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    let fadeTimer: number | undefined
    const rotationTimer = window.setInterval(() => {
      setIsVisible(false)
      fadeTimer = window.setTimeout(() => {
        setFactIndex((current) => (current + 1) % biodiversityFacts.length)
        setIsVisible(true)
      }, 350)
    }, 3600)

    return () => {
      window.clearInterval(rotationTimer)
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer)
    }
  }, [])

  return (
    <p className={`loading-fact${isVisible ? ' is-visible' : ''}`} aria-live="polite">
      <span>Did you know?</span> {biodiversityFacts[factIndex]}
    </p>
  )
}
