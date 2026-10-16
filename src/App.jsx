import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from './Header.jsx'

const emptyForm = {
  customerName: '',
  productName: '',
  price: '',
  quantity: '',
}

function formatMoney(value) {
  const amount = Number(value)
  if (Number.isNaN(amount)) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function lineTotal(order) {
  const price = Number(order?.price)
  const quantity = Number(order?.quantity)
  if (Number.isNaN(price) || Number.isNaN(quantity)) return null
  return price * quantity
}

function App() {
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [lookupId, setLookupId] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [status, setStatus] = useState(null)
  const [formError, setFormError] = useState('')

  const showStatus = (type, message) => {
    setStatus({ type, message })
  }

  const loadOrders = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoadingList(true)
    try {
      const res = await fetch('/api/orders')
      if (!res.ok) throw new Error(`Could not load orders (${res.status})`)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
      if (!silent) showStatus('ok', 'Orders updated')
    } catch (error) {
      showStatus('error', error.message || 'Could not load orders')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadOrders({ silent: true })
  }, [loadOrders])

  const selectOrder = useCallback(async (id, fallback) => {
    if (id == null || id === '') return
    setSelectedId(id)
    setLookupId(String(id))
    if (fallback) setSelectedOrder(fallback)
    setLoadingDetails(true)
    try {
      const res = await fetch(`/api/orders/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedOrder(data)
        return
      }
      if (res.status === 404) {
        setSelectedOrder(fallback ?? null)
        if (!fallback) showStatus('error', 'Order not found')
        return
      }
      if (!fallback) {
        throw new Error(`Could not load order ${id}`)
      }
    } catch (error) {
      if (!fallback) {
        showStatus('error', error.message || 'Could not load order details')
        setSelectedOrder(null)
      }
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function createOrder(event) {
    event.preventDefault()
    setFormError('')

    if (!form.customerName.trim() || !form.productName.trim()) {
      setFormError('Customer and product are required.')
      return
    }

    const price = Number(form.price)
    const quantity = Number(form.quantity)
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Enter a valid price.')
      return
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setFormError('Quantity must be a whole number of at least 1.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          productName: form.productName.trim(),
          price,
          quantity,
        }),
      })
      if (!res.ok) throw new Error(`Create failed (${res.status})`)
      const created = await res.json().catch(() => null)
      setForm(emptyForm)
      showStatus('ok', 'Order created')
      await loadOrders({ silent: true })
      if (created?.id != null) {
        selectOrder(created.id, created)
      }
    } catch (error) {
      showStatus('error', error.message || 'Could not create order')
    } finally {
      setSaving(false)
    }
  }

  async function deleteOrder(id) {
    if (id == null || id === '') return
    const confirmed = window.confirm(`Delete order #${id}?`)
    if (!confirmed) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
      if (res.status === 404) {
        showStatus('error', 'Order not found')
        return
      }
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      showStatus('ok', `Deleted order #${id}`)
      if (String(selectedId) === String(id)) {
        setSelectedId(null)
        setSelectedOrder(null)
      }
      await loadOrders({ silent: true })
    } catch (error) {
      showStatus('error', error.message || 'Could not delete order')
    } finally {
      setDeletingId(null)
    }
  }

  function lookupOrder(event) {
    event.preventDefault()
    const id = lookupId.trim()
    if (!id) {
      showStatus('error', 'Enter an order id')
      return
    }
    const fromList = orders.find((order) => String(order.id) === id)
    selectOrder(id, fromList)
  }

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.createdDate).getTime()
      const bTime = new Date(b.createdDate).getTime()
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return Number(b.id) - Number(a.id)
      return bTime - aTime
    })
  }, [orders])

  const details = selectedOrder
  const detailsTotal = details ? lineTotal(details) : null

  return (
    <div className="app-shell">
      <Header orderCount={orders.length} />

      {status && (
        <p className={`banner banner-${status.type}`} role="status">
          {status.message}
        </p>
      )}

      <div className="layout">
        <section className="panel" aria-labelledby="create-heading">
          <h2 id="create-heading">Create order</h2>
          <p className="muted">New tickets go to the API, then show up in the list.</p>
          <form className="stack" onSubmit={createOrder}>
            <label>
              Customer
              <input
                name="customerName"
                autoComplete="name"
                placeholder="Ada Lovelace"
                value={form.customerName}
                onChange={(e) => updateField('customerName', e.target.value)}
              />
            </label>
            <label>
              Product
              <input
                name="productName"
                placeholder="Mechanical keyboard"
                value={form.productName}
                onChange={(e) => updateField('productName', e.target.value)}
              />
            </label>
            <div className="field-row">
              <label>
                Price
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="49.00"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                />
              </label>
              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={form.quantity}
                  onChange={(e) => updateField('quantity', e.target.value)}
                />
              </label>
            </div>
            {formError && <p className="field-error">{formError}</p>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create order'}
            </button>
          </form>
        </section>

        <section className="panel panel-wide" aria-labelledby="list-heading">
          <div className="panel-toolbar">
            <div>
              <h2 id="list-heading">All orders</h2>
              <p className="muted">Select a row for details, or look up an id.</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => loadOrders()} disabled={loadingList}>
              {loadingList ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <form className="lookup" onSubmit={lookupOrder}>
            <label>
              Order id
              <input
                name="lookupId"
                placeholder="e.g. 12"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-secondary">
              Show details
            </button>
          </form>

          {sortedOrders.length === 0 ? (
            <p className="empty">
              {loadingList ? 'Loading orders…' : 'No orders yet. Create one to get started.'}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => {
                    const active = String(order.id) === String(selectedId)
                    return (
                      <tr
                        key={order.id}
                        className={active ? 'row-active' : undefined}
                        onClick={() => selectOrder(order.id, order)}
                      >
                        <td>{order.id}</td>
                        <td>{order.customerName}</td>
                        <td>{order.productName}</td>
                        <td>{order.quantity}</td>
                        <td>{formatMoney(order.price)}</td>
                        <td>{formatDate(order.createdDate)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-danger"
                            disabled={deletingId === order.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              deleteOrder(order.id)
                            }}
                          >
                            {deletingId === order.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="panel details" aria-labelledby="details-heading">
        <h2 id="details-heading">Order details</h2>
        {loadingDetails && <p className="muted">Loading details…</p>}
        {!details && !loadingDetails && (
          <p className="empty">Choose an order from the list, or look one up by id.</p>
        )}
        {details && (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Id</dt>
                <dd>{details.id ?? selectedId}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{details.customerName || '—'}</dd>
              </div>
              <div>
                <dt>Product</dt>
                <dd>{details.productName || '—'}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{details.quantity ?? '—'}</dd>
              </div>
              <div>
                <dt>Unit price</dt>
                <dd>{formatMoney(details.price)}</dd>
              </div>
              <div>
                <dt>Line total</dt>
                <dd>{detailsTotal == null ? '—' : formatMoney(detailsTotal)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(details.createdDate)}</dd>
              </div>
            </dl>
            <div className="detail-actions">
              <button
                type="button"
                className="btn-danger"
                disabled={details.id == null || deletingId === details.id}
                onClick={() => deleteOrder(details.id)}
              >
                Delete this order
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setSelectedId(null)
                  setSelectedOrder(null)
                }}
              >
                Clear
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default App
