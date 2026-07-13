export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="text-muted-foreground border-t px-4 py-3 text-center text-xs">
      <p>&copy; {year} LeafMind. All rights reserved.</p>
    </footer>
  )
}
