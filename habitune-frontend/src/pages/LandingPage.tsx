import { useEffect, useRef, useState } from 'react'
import { AnimatedEcosystemHero } from '../components/AnimatedEcosystemHero'
import HabituneBrand from '../components/HabituneBrand'
import flowerPlaceholderIcon from '../assets/home/flower-placeholder.svg'
import videoPlaceholderIcon from '../assets/home/video-placeholder.svg'
import '../landing.css'

const HERO_ANIMATION_ENABLED = false

const ArrowIcon = () => <span aria-hidden="true">→</span>

type LandingPageProps = {
  onExploreArea: () => void
}

function Header({ onExploreArea }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const goTo = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
    setIsMenuOpen(false)
  }

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Habitune home">
        <HabituneBrand />
      </a>

      <div className="header-actions">
        <div className="page-menu" ref={menuRef}>
          <button
            className="page-menu-trigger"
            type="button"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            Page content
            <span className={`chevron ${isMenuOpen ? 'is-open' : ''}`} aria-hidden="true">⌄</span>
          </button>

          {isMenuOpen && (
            <div className="page-menu-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => goTo('pollination-corridor')}>
                Pollination corridor
              </button>
              <button type="button" role="menuitem" onClick={() => goTo('contribute')}>
                Contribute
              </button>
            </div>
          )}
        </div>

        <button className="button button-compact" type="button" onClick={onExploreArea}>Explore my area</button>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="hero-section" id="top">
      <div className="hero-copy">
        <p className="eyebrow">Urban ecosystem</p>
        <h1>
          You are part of an<br />urban ecosystem.
          <span className="hero-heading-gap" />
          See how it works,<br />and how you can<br />contribute.
        </h1>
        <a className="button hero-button" href="#features">Explore <ArrowIcon /></a>
      </div>

      <div className="hero-visual">
        <AnimatedEcosystemHero animated={HERO_ANIMATION_ENABLED} />
      </div>
    </section>
  )
}

function PollinationCorridorSection() {
  return (
    <section className="content-section two-column corridor-section" id="pollination-corridor" data-node-id="17:36">
      <div className="section-copy corridor-copy">
        <p className="eyebrow">Pollination corridors</p>
        <h2>What is a pollination corridor?</h2>
        <p>
          A pollination corridor is your neighbourhood&apos;s path for pollinators, a connected line of
          flowering plants, trees and green spaces that lets bees, butterflies and birds move safely
          between gardens and parks. Without it, even a lush garden becomes an island pollinators
          can&apos;t reach.
        </p>
      </div>
      <div className="media-placeholder corridor-placeholder" aria-label="Botanical corridor illustration placeholder">
        <span className="corridor-icon-wrap" aria-hidden="true"><img src={flowerPlaceholderIcon} alt="" /></span>
        <span>Botanical Corridor Illustration</span>
      </div>
    </section>
  )
}

function StrategySection() {
  return (
    <section className="content-section two-column strategy-section" data-node-id="8:15">
      <div className="media-placeholder video-placeholder" aria-label="Urban forest strategy video placeholder">
        <img className="video-placeholder-icon" src={videoPlaceholderIcon} alt="" aria-hidden="true" />
      </div>
      <div className="section-copy strategy-copy">
        <h2>
          The key vision of the Urban Forest Strategy and Nature in the City Strategy isn&apos;t just
          more green cover, it&apos;s creating urban green space that helps promote local biodiversity.
        </h2>
        <p>
          One way this happens is through <strong>pollination corridors</strong>: connected planting
          that matters because fragmented urban landscapes disrupt pollination and plant reproduction.
        </p>
      </div>
    </section>
  )
}

function ContributionSection() {
  return (
    <section className="content-section contribution-section" id="contribute" data-node-id="19:4">
      <div className="contribution-container" data-node-id="19:5">
        <div className="contribution-heading" data-node-id="20:4">
          <h2>To promote biodiversity, we need to become a part of this pollination corridor.</h2>
          <p>Here&apos;s how you contribute to the corridor through your gardens, small or big:</p>
        </div>

        <div className="contribution-grid" data-node-id="19:16">
          <article className="contribution-item" data-node-id="20:5">
            <h3>Select the right plant.</h3>
            <p>Planting species that promote pollination in your garden, e.g. native species, high-nectar plants.</p>
            <div className="action-placeholder" data-node-id="19:17">
              <img className="contribution-icon" src={flowerPlaceholderIcon} alt="" aria-hidden="true" />
              <span>Plant species</span>
            </div>
          </article>

          <article className="contribution-item" data-node-id="20:6">
            <h3>Nature strip gardening.</h3>
            <p>We can help you plan an outdoor strip gardening activity by following council&apos;s guidelines.</p>
            <div className="action-placeholder" data-node-id="19:20">
              <span className="placeholder-icon trowel" aria-hidden="true">♧</span>
              <span>Nature strip planting</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

const featureCards = [
  { title: 'Know your ecosystem.', description: 'View pollination corridors, green canopy and info on local species in and around your area of residence.', action: 'Explore my area' },
  { title: 'Find the right plants.', description: 'Find the plant species that is compatible and promotes your local biodiversity.', action: 'Find my plant' },
  { title: 'Plant with confidence.', description: 'Check if you can plant outdoors in your locality. We will help you find the right plant by verifying council guidelines.', action: 'Check local nature strips' },
]

function FeatureSection({ onExploreArea }: LandingPageProps) {
  return (
    <section className="content-section feature-section" id="features" data-node-id="21:5">
      <h2>Here&apos;s what you can do with Habitune:</h2>
      <div className="feature-grid" data-node-id="21:6">
        {featureCards.map((feature, index) => (
          <article className="feature-card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <button className="button feature-button" type="button" onClick={index === 0 ? onExploreArea : undefined}>{feature.action}</button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function LandingPage({ onExploreArea }: LandingPageProps) {
  return (
    <div className="landing-page">
      <div className="app-shell">
        <Header onExploreArea={onExploreArea} />
        <main>
          <HeroSection />
          <StrategySection />
          <PollinationCorridorSection />
          <ContributionSection />
          <FeatureSection onExploreArea={onExploreArea} />
        </main>
      </div>
    </div>
  )
}
