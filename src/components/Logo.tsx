import { useAppStore } from '../store'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const sizeMap = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10'
}

export default function Logo({ className = '', size = 'md', onClick }: LogoProps) {
  const { theme } = useAppStore()
  
  // In dark mode, use white icon; in light mode, use black icon
  const iconPath = theme === 'dark' ? '/white_icon/SVG.svg' : '/black_icon/SVG.svg'
  
  return (
    <img
      src={iconPath}
      alt="SkillHub Logo"
      className={`${sizeMap[size]} w-auto ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    />
  )
}
