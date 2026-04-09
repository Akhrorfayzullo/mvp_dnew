export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F6E56] via-[#0d5e48] to-[#0a4a38] flex items-center justify-center p-4">
      {children}
    </div>
  )
}
