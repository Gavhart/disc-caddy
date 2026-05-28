/** “Great for:” bullet list used on roadmap and league feature cards. */
export function GreatForList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null

  return (
    <div className="feature-great-for">
      <span className="feature-great-for-label small">Great for:</span>
      <ul className="feature-great-for-list small">
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
