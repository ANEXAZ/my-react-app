import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from './Header.jsx'
import Pagination from './Pagination.jsx'

const PAGE_SIZE = 10

const emptyForm = {
  customerName: '',
  productName: '',
  price: '',
  quantity: '',
}

function parsePage(data, fallbackPage) {
  const content = Array.isArray(data?.content) ? data.content : []
  return {
    content,
    page: Number.isInteger(data?.number) ? data.number : fallbackPage,
    size: Number(data?.size) || PAGE_SIZE,
    totalElements: Number(data?.totalElements) || content.length,
    totalPages: Math.max(Number(data?.totalPages) || (content.length ? 1 : 0), 1),
  }
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
  const [pageInfo, setPageInfo] = useState({
    page: 0,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
  })
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
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState({ term: null, results: [], status: 'idle' })
  const searchSeqRef = useRef(0)

  const showStatus = (type, message) => {
    setStatus({ type, message })
  }

  const loadOrders = useCallback(async (page = 0, size = PAGE_SIZE, { silent = false } = {}) => {
    setLoadingList(true)
    try {
      let targetPage = page
      let parsed
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await fetch(`/api/orders?page=${targetPage}&size=${size}`)
        if (!res.ok) throw new Error(`Could not load orders (${res.status})`)
        parsed = parsePage(await res.json(), targetPage)
        // The page we asked for may no longer exist (e.g. after a delete) — fall back to the last page.
        const pageGone = parsed.content.length === 0 && targetPage > 0 && targetPage >= parsed.totalPages
        if (!pageGone) break
        targetPage = Math.max(0, parsed.totalPages - 1)
      }
      setOrders(parsed.content)
      setPageInfo({
        page: parsed.page,
        size: parsed.size,
        totalElements: parsed.totalElements,
        totalPages: parsed.totalPages,
      })
      if (!silent) showStatus('ok', 'Orders updated')
    } catch (error) {
      showStatus('error', error.message || 'Could not load orders')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/orders?page=0&size=${PAGE_SIZE}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load orders (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const parsed = parsePage(data, 0)
        setOrders(parsed.content)
        setPageInfo({
          page: parsed.page,
          size: parsed.size,
          totalElements: parsed.totalElements,
          totalPages: parsed.totalPages,
        })
      })
      .catch((error) => {
        if (!cancelled) showStatus('error', error.message || 'Could not load orders')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const runSearch = useCallback(async (term) => {
    const seq = searchSeqRef.current + 1
    searchSeqRef.current = seq
    setSearchState((current) => ({
      term,
      results: current.term === term ? current.results : [],
      status: 'loading',
    }))
    try {
      const res = await fetch(`/api/orders/search?query=${encodeURIComponent(term)}`)
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      const data = await res.json()
      if (seq !== searchSeqRef.current) return
      setSearchState({ term, results: Array.isArray(data) ? data : [], status: 'done' })
    } catch (error) {
      if (seq !== searchSeqRef.current) return
      setSearchState({ term, results: [], status: 'done' })
      showStatus('error', error.message || 'Could not search orders')
    }
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (!term) return undefined
    const timer = setTimeout(() => runSearch(term), 350)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  async function refreshOrders({ page = pageInfo.page, size = pageInfo.size, silent = true } = {}) {
    await loadOrders(page, size, { silent })
    const activeTerm = query.trim()
    if (activeTerm) await runSearch(activeTerm)
  }

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
      // New orders land on the last page, so jump there to show the result.
      const lastPage = Math.max(0, Math.ceil((pageInfo.totalElements + 1) / pageInfo.size) - 1)
      await refreshOrders({ page: lastPage, silent: true })
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
      await refreshOrders({ silent: true })
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

  const term = query.trim()
  const searchActive = term !== ''
  const currentResults = searchState.term === term ? searchState.results : null
  const searching = searchActive && (currentResults === null || searchState.status === 'loading')
  // While a new term is loading, keep the previous matches on screen (dimmed).
  const displayedSource = searchActive ? (currentResults ?? searchState.results) : orders

  const sortedOrders = useMemo(() => {
    return [...displayedSource].sort((a, b) => {
      const aTime = new Date(a.createdDate).getTime()
      const bTime = new Date(b.createdDate).getTime()
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return Number(b.id) - Number(a.id)
      return bTime - aTime
    })
  }, [displayedSource])

  const details = selectedOrder
  const detailsTotal = details ? lineTotal(details) : null
  const shownCount = searchActive ? sortedOrders.length : pageInfo.totalElements

  let listCaption = 'Select a row for details, or look up an id.'
  if (searching) listCaption = 'Searching…'
  else if (searchActive) {
    listCaption = `${shownCount} ${shownCount === 1 ? 'match' : 'matches'} for “${term}”`
  }

  let emptyMessage = 'No orders yet. Create one to get started.'
  if (loadingList) emptyMessage = 'Loading orders…'
  else if (searching) emptyMessage = 'Searching…'
  else if (searchActive) emptyMessage = `No orders match “${term}”.`

  return (
    <div className="app-shell">
      <Header orderCount={shownCount} />

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
              <p className="muted">{listCaption}</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => refreshOrders({ silent: false })} disabled={loadingList}>
              {loadingList ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="search-row">
            <label>
              Search orders
              <input
                type="search"
                name="search"
                placeholder="Customer or product name…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setQuery('')}
              disabled={!query}
            >
              Clear
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
            <p className="empty">{emptyMessage}</p>
          ) : (
            <div className={`table-wrap${loadingList || searching ? ' is-busy' : ''}`}>
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

          {!searchActive && (
            <Pagination
              page={pageInfo.page}
              size={pageInfo.size}
              totalPages={pageInfo.totalPages}
              totalElements={pageInfo.totalElements}
              disabled={loadingList || searching}
              onPage={(nextPage) => refreshOrders({ page: nextPage })}
              onSizeChange={(nextSize) => refreshOrders({ page: 0, size: nextSize })}
            />
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
