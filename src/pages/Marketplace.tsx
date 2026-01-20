import { Store } from 'lucide-react'

export default function Marketplace() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 mx-auto mb-8 border-4 border-foreground flex items-center justify-center">
          <Store size={48} className="text-foreground" />
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
          MARKETPLACE
        </h1>

        <p className="text-xl text-muted-foreground mb-8 uppercase tracking-wider">
          Coming Soon
        </p>

        <div className="border-2 border-border-light p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The SkillHub Marketplace will allow you to discover, purchase, and sell premium AI coding skills.
            Stay tuned for updates!
          </p>
        </div>
      </div>
    </div>
  )
}
