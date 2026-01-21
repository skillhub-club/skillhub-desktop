/**
 * Spinner - Grid style loading indicator from Craft Agents
 * Uses CSS-based 3x3 grid animation
 */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span className={`spinner ${className}`}>
      <span className="spinner-cube" />
      <span className="spinner-cube" />
      <span className="spinner-cube" />
      <span className="spinner-cube" />
      <span className="spinner-cube" />
      <span className="spinner-cube" />
      <span className="spinner-cube" />
      <span className="spinner-cube" />
      <span className="spinner-cube" />
    </span>
  )
}
