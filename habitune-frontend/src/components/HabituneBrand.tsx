import habituneLogo from '../assets/brand/habitune-logo.png'

export default function HabituneBrand() {
  return (
    <>
      <img className="brand-logo" src={habituneLogo} alt="" aria-hidden="true" />
      <span>Habitune</span>
    </>
  )
}
