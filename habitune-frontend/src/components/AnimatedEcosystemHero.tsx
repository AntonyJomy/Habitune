import ecosystemMap from '../assets/home/urban-ecosystem-map.png'

const BEE_ANIMATION_ENABLED = false

type AnimatedEcosystemHeroProps = { animated?: boolean }

export function AnimatedEcosystemHero({ animated = true }: AnimatedEcosystemHeroProps) {
  if (!animated) {
    return <img className="ecosystem-static" src={ecosystemMap} alt="A connected urban ecosystem with balcony gardens, street planting and pollinators" />
  }

  return (
    <div className={`ecosystem-animation${BEE_ANIMATION_ENABLED ? '' : ' bee-animation-disabled'}`} role="img" aria-label="A connected urban ecosystem with balcony gardens, street planting and pollinators">
      <img className="ecosystem-base" src={ecosystemMap} alt="" />
      <span className="bee-cleanup" aria-hidden="true" />
      <img className="ecosystem-motion flower-motion leaf-upper-left" src={ecosystemMap} alt="" />
      <img className="ecosystem-motion flower-motion flower-upper" src={ecosystemMap} alt="" />
      <img className="ecosystem-motion flower-motion flower-foreground" src={ecosystemMap} alt="" />
      <img className="ecosystem-motion flower-motion flower-centre" src={ecosystemMap} alt="" />
      <img className="ecosystem-motion flower-motion flower-right" src={ecosystemMap} alt="" />
      <svg className="bee-motion" viewBox="0 0 110 78" aria-hidden="true" focusable="false">
        <defs><clipPath id="bee-body-clip"><ellipse cx="55" cy="43" rx="29" ry="16" /></clipPath></defs>
        <g transform="rotate(-17 55 43)">
          <g className="bee-wing bee-wing-top"><ellipse cx="46" cy="19" rx="12" ry="20" transform="rotate(-25 46 19)" /></g>
          <g className="bee-wing bee-wing-bottom"><ellipse cx="47" cy="66" rx="11" ry="18" transform="rotate(28 47 66)" /></g>
          <g className="bee-legs"><path d="M43 53 31 66M54 57 49 72M67 54 76 67" /><path d="M42 49 27 55M66 50 83 58" /></g>
          <ellipse className="bee-body" cx="55" cy="43" rx="29" ry="16" />
          <g className="bee-stripes" clipPath="url(#bee-body-clip)"><rect x="36" y="23" width="8" height="42" rx="3" /><rect x="51" y="22" width="8" height="43" rx="3" /><rect x="67" y="25" width="7" height="38" rx="3" /></g>
          <circle className="bee-head" cx="83" cy="40" r="11" />
          <circle className="bee-eye" cx="87" cy="36" r="2" />
          <g className="bee-antennae"><path d="M88 32 Q96 23 102 28" /><path d="M91 37 Q102 33 105 39" /></g>
        </g>
      </svg>
    </div>
  )
}
