import { Brain, Flower2, Leaf, MoonStar, Route, Sparkles, ThermometerSun } from 'lucide-react'
import HabituneBrand from '../components/HabituneBrand'
import ecosystemMap from '../assets/home/urban-ecosystem-map.png'
import urbanPollinationBeeVideo from '../assets/home/urban-pollination-bee.mp4'
import '../landing.css'

type LandingPageProps = { onExploreArea: () => void }
type CardItem = { title: string; description: React.ReactNode; icon: React.ReactNode }

function StatHighlight({ value, variant }: { value: string; variant: 'pill' | 'underline' }) {
  return <span className={`stat-highlight stat-highlight-${variant}`}>{value}</span>
}

const steps: CardItem[] = [
  { title: 'You choose the right plant for your balcony', description: <>Only <StatHighlight value="4 in 10" variant="pill" /> garden flowers actually feed pollinators</>, icon: <Flower2 aria-hidden="true" /> },
  { title: 'Your balcony becomes a part of a corridor', description: <>Insects become <StatHighlight value="3.4x" variant="underline" /> more likely to visit once gardens connect</>, icon: <Route aria-hidden="true" /> },
  { title: 'Pollinators visit your balcony to travel the corridor', description: <>One planting project saw <StatHighlight value="7.3x" variant="pill" /> more insect species in 3 years</>, icon: <Sparkles aria-hidden="true" /> },
  { title: 'The balcony garden thrives', description: <>More pollinator visits mean stronger, longer flowering plants</>, icon: <Leaf aria-hidden="true" /> },
]

const benefits: CardItem[] = [
  { title: 'Cooler days', description: <>Tree cover offsets up to <strong>49%</strong> of local heat island warming</>, icon: <ThermometerSun aria-hidden="true" /> },
  { title: 'Calmer mind', description: <>Regular gardening is linked to <strong>28%</strong> lower dementia risk</>, icon: <Brain aria-hidden="true" /> },
  { title: 'Better sleep', description: <>Greener streets promote better sleep</>, icon: <MoonStar aria-hidden="true" /> },
]

const contributions = [
  { title: 'Know your ecosystem.', description: 'View pollination corridors, green canopy and info on local species in and around your area of residence.', available: true },
  { title: 'Find the right plants.', description: 'Find the plant species that is compatible and promotes your local biodiversity.', available: false },
  { title: 'Plant inside and outdoors.', description: 'We will help you plant outside in your locality by verifying council guidelines.', available: false },
]

function LandingHeader({ onExploreArea }: LandingPageProps) {
  return <header className="landing-header"><div className="landing-container landing-nav">
    <a className="landing-brand" href="#top" aria-label="Habitune home"><HabituneBrand /></a>
    <button className="outline-pill nav-cta" type="button" onClick={onExploreArea}>Explore my area</button>
  </div></header>
}

function ProgressCard({ item, className = '' }: { item: CardItem; className?: string }) {
  return <article className={`progress-card ${className}`}>
    <div className="card-illustration">{item.icon}</div><h3>{item.title}</h3><div className="card-fact">{item.description}</div>
  </article>
}

export default function LandingPage({ onExploreArea }: LandingPageProps) {
  return <div className="landing-page">
    <LandingHeader onExploreArea={onExploreArea} />
    <main>
      <section className="landing-container landing-hero" id="top">
        <div className="hero-copy">
          <h1>Your balcony can help the local biodiversity thrive.</h1>
          <p>Our local biodiversity elevates our quality of life. We want to help you contribute to it, the right way.</p>
          <a className="outline-pill hero-cta" href="#big-picture">See how <span aria-hidden="true">→</span></a>
        </div>
        <div className="hero-media"><img src={ecosystemMap} alt="An illustrated map showing connected urban gardens and pollinators" /></div>
      </section>

      <section className="landing-section landing-container" id="big-picture">
        <div className="section-heading"><h2>See how you fit in the big picture</h2><p>Every balcony plays a part. Here&apos;s how yours can too.</p></div>
        <div className="steps-grid">{steps.map((step, index) => <div className="step-slot" key={step.title}>
          <ProgressCard item={step} />{index < steps.length - 1 && <span className="step-arrow" aria-hidden="true">→</span>}
        </div>)}</div>
      </section>

      <section className="landing-section landing-container benefits-section" id="benefits">
        <div className="section-heading"><h2>How your green balcony helps you</h2><p>Here&apos;s how a green balcony benefits you.</p></div>
        <div className="benefits-frame"><div className="benefits-grid">{benefits.map((benefit) => <ProgressCard item={benefit} className="benefit-card" key={benefit.title} />)}</div></div>
      </section>

      <section className="landing-section landing-container contribution-section" id="contribute">
        <div className="section-heading"><h2>How you can contribute</h2><p>This is where we come in the picture to help you contribute</p></div>
        <div className="contribution-grid">{contributions.map((item) => <article className="contribution-card" key={item.title}>
          <h3>{item.title}</h3><p>{item.description}</p>
          <button className={`contribution-button${item.available ? '' : ' is-disabled'}`} type="button" disabled={!item.available} onClick={item.available ? onExploreArea : undefined}>{item.available ? 'Explore my area' : 'coming soon'}</button>
        </article>)}</div>
      </section>

      <section className="landing-section landing-container vision-section">
        <div className="vision-media"><video autoPlay muted loop playsInline preload="auto" aria-label="A bee travelling through an urban pollination landscape"><source src={urbanPollinationBeeVideo} type="video/mp4" /></video></div>
        <div className="vision-copy"><h2>The key vision of the Urban Forest Strategy and Nature in the City Strategy isn&apos;t just more green cover, it&apos;s creating urban green space that helps promote local biodiversity.</h2></div>
      </section>
    </main>
  </div>
}
