function Header({ orderCount }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Order desk</p>
        <h1>Orders</h1>
      </div>
      <p className="header-meta">
        {orderCount === 1 ? '1 order' : `${orderCount.toLocaleString()} orders`}
      </p>
    </header>
  )
}

export default Header
