import { useEffect, useMemo, useState } from 'react'
import {
  executeSql,
  fetchCustomers,
  fetchHealth,
  fetchLogSummary,
  fetchLogs,
  fetchSales,
  fetchSellers,
  fetchStores,
  fetchTableData,
  fetchTables,
  manageCustomer,
  manageSale,
  manageSeller,
  rollbackLog,
} from './api'
import './App.css'

const emptyCustomer = { id: '', name: '', phone: '' }
const emptySeller = { id: '', name: '', store_id: '' }
const emptySale = {
  id: '',
  store_id: '',
  seller_id: '',
  customer_id: '',
  sale_date: '',
}

const connectionDefaults = {
  host: '82.179.14.185',
  port: '1521',
  service: 'nmics',
  username: 'stud15',
  password: 'stud15',
}

const mainTabs = [
  { label: 'SQL запрос', value: 'sql' },
  { label: 'Таблицы', value: 'tables' },
  { label: 'Процедуры', value: 'procedures' },
]

const procedureTabs = [
  { label: 'Покупатели', value: 'customers' },
  { label: 'Продавцы', value: 'sellers' },
  { label: 'Продажи', value: 'sales' },
  { label: 'Логи', value: 'logs' },
  { label: 'Сводка', value: 'summary' },
  { label: 'Откат', value: 'rollback' },
]

function App() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionForm, setConnectionForm] = useState(connectionDefaults)
  const [activeTab, setActiveTab] = useState('sql')
  const [procedureTab, setProcedureTab] = useState('customers')

  const [stores, setStores] = useState([])
  const [customers, setCustomers] = useState([])
  const [sellers, setSellers] = useState([])
  const [sales, setSales] = useState([])
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState([])
  const [tables, setTables] = useState([])
  const [tableView, setTableView] = useState({ name: '', rows: [], columns: [] })

  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM SEM_STORE')
  const [sqlResult, setSqlResult] = useState(null)

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [sellerForm, setSellerForm] = useState(emptySeller)
  const [saleForm, setSaleForm] = useState(emptySale)
  const [customerActionTab, setCustomerActionTab] = useState('add')
  const [sellerActionTab, setSellerActionTab] = useState('add')
  const [saleActionTab, setSaleActionTab] = useState('add')

  const [logFilters, setLogFilters] = useState({
    from: '',
    to: '',
    op: '',
    entity: '',
  })
  const [summarySort, setSummarySort] = useState({
    sort_entity: true,
    sort_op: true,
    sort_count: false,
  })
  const [rollbackLogId, setRollbackLogId] = useState(null)

  useEffect(() => {
    if (!snackbar.open) {
      return undefined
    }
    const timer = setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, open: false }))
    }, 4000)
    return () => clearTimeout(timer)
  }, [snackbar.open])

  const showMessage = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }

  const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback

  const refreshAll = async () => {
    try {
      console.log('[refreshAll] start')
      const [storesRes, customersRes, sellersRes, salesRes] = await Promise.all([
        fetchStores(),
        fetchCustomers(),
        fetchSellers(),
        fetchSales(),
      ])
      console.log('[refreshAll] responses', {
        stores: storesRes?.data,
        customers: customersRes?.data,
        sellers: sellersRes?.data,
        sales: salesRes?.data,
      })
      setStores(storesRes.data)
      setCustomers(customersRes.data)
      setSellers(sellersRes.data)
      setSales(salesRes.data)
    } catch (error) {
      console.error('[refreshAll] failed', error)
      showMessage(getErrorMessage(error, 'Не удалось загрузить справочники'), 'error')
    }
  }

  const loadLogs = async () => {
    try {
      console.log('[logs] load', logFilters)
      const response = await fetchLogs({
        from: logFilters.from || undefined,
        to: logFilters.to || undefined,
        op: logFilters.op || undefined,
        entity: logFilters.entity || undefined,
      })
      console.log('[logs] response', response?.data)
      setLogs(response.data)
    } catch (error) {
      console.error('[logs] failed', error)
      showMessage(getErrorMessage(error, 'Не удалось загрузить логи'), 'error')
    }
  }

  const loadSummary = async () => {
    try {
      console.log('[summary] load', summarySort)
      const response = await fetchLogSummary({
        sort_entity: summarySort.sort_entity ? 1 : 0,
        sort_op: summarySort.sort_op ? 1 : 0,
        sort_count: summarySort.sort_count ? 1 : 0,
      })
      console.log('[summary] response', response?.data)
      setSummary(response.data)
    } catch (error) {
      console.error('[summary] failed', error)
      showMessage(getErrorMessage(error, 'Не удалось загрузить сводку'), 'error')
    }
  }

  const loadTables = async () => {
    try {
      const response = await fetchTables()
      setTables(response.data)
    } catch (error) {
      console.error('[tables] failed', error)
      showMessage(getErrorMessage(error, 'Не удалось загрузить таблицы'), 'error')
    }
  }

  useEffect(() => {
    if (!connected) {
      return
    }
    refreshAll()
    loadLogs()
    loadSummary()
    loadTables()
  }, [connected])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await fetchHealth()
      setConnected(true)
      setActiveTab('sql')
      showMessage('Подключение установлено')
    } catch (error) {
      console.error('[connect] failed', error)
      showMessage(getErrorMessage(error, 'Не удалось подключиться к серверу'), 'error')
    } finally {
      setConnecting(false)
    }
  }

  const handleCustomerAction = async (action) => {
    try {
      console.log('[customers] action', action, customerForm)
      await manageCustomer({ action, ...customerForm, id: Number(customerForm.id) })
      showMessage('Операция с покупателями выполнена')
      setCustomerForm(emptyCustomer)
      await refreshAll()
    } catch (error) {
      console.error('[customers] action failed', error)
      showMessage(getErrorMessage(error, 'Ошибка при работе с покупателями'), 'error')
    }
  }

  const handleSellerAction = async (action) => {
    try {
      console.log('[sellers] action', action, sellerForm)
      await manageSeller({
        action,
        ...sellerForm,
        id: Number(sellerForm.id),
        store_id: Number(sellerForm.store_id),
      })
      showMessage('Операция с продавцами выполнена')
      setSellerForm(emptySeller)
      await refreshAll()
    } catch (error) {
      console.error('[sellers] action failed', error)
      showMessage(getErrorMessage(error, 'Ошибка при работе с продавцами'), 'error')
    }
  }

  const handleSaleAction = async (action) => {
    try {
      console.log('[sales] action', action, saleForm)
      await manageSale({
        action,
        ...saleForm,
        id: Number(saleForm.id),
        store_id: Number(saleForm.store_id),
        seller_id: Number(saleForm.seller_id),
        customer_id: Number(saleForm.customer_id),
      })
      showMessage('Операция с продажами выполнена')
      setSaleForm(emptySale)
      await refreshAll()
    } catch (error) {
      console.error('[sales] action failed', error)
      showMessage(getErrorMessage(error, 'Ошибка при работе с продажами'), 'error')
    }
  }

  const handleRollback = async () => {
    if (!rollbackLogId) {
      showMessage('Выберите лог для отката', 'warning')
      return
    }
    try {
      console.log('[rollback] action', rollbackLogId)
      await rollbackLog({ log_id: rollbackLogId })
      showMessage('Откат выполнен')
      setRollbackLogId(null)
      await refreshAll()
      await loadLogs()
      await loadSummary()
    } catch (error) {
      console.error('[rollback] failed', error)
      showMessage(getErrorMessage(error, 'Ошибка при откате'), 'error')
    }
  }

  const handleSqlRun = async () => {
    if (!sqlQuery.trim()) {
      showMessage('Введите SQL запрос', 'warning')
      return
    }
    try {
      const response = await executeSql({ query: sqlQuery })
      setSqlResult(response.data)
      showMessage('SQL запрос выполнен')
    } catch (error) {
      console.error('[sql] failed', error)
      showMessage(getErrorMessage(error, 'Ошибка при выполнении SQL'), 'error')
    }
  }

  const handleTableOpen = async (tableName) => {
    try {
      const response = await fetchTableData(tableName)
      const rows = response.data.rows || []
      const columns = rows[0] ? Object.keys(rows[0]) : []
      setTableView({ name: response.data.table, rows, columns })
    } catch (error) {
      console.error('[tables] load failed', error)
      showMessage(getErrorMessage(error, 'Не удалось загрузить таблицу'), 'error')
    }
  }

  const saleOptions = useMemo(
    () =>
      sales.map((sale) => ({
        ...sale,
        label: `#${sale.sale_id} · ${sale.store_name} · ${sale.sale_date}`,
      })),
    [sales]
  )

  const sqlColumns = sqlResult?.columns || []
  const sqlRows = sqlResult?.rows || []

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SEM_PKG</p>
          <h1>Панель данных Oracle</h1>
          <p className="subtitle">
            Подключайтесь к серверу, выполняйте запросы и управляйте процедурами в одном интерфейсе.
          </p>
        </div>
        <div className="header-actions">
          {connected && (
            <button className="btn btn-ghost" type="button" onClick={refreshAll}>
              Обновить данные
            </button>
          )}
          <div className="status-pill">
            <span className={`status-dot ${connected ? '' : 'offline'}`} />
            <span>{connected ? 'Подключено' : 'Нет подключения'}</span>
          </div>
        </div>
      </header>

      {!connected ? (
        <section className="section-card connection-card">
          <div className="section-header">
            <div>
              <h2>Подключение к серверу</h2>
              <p>Укажите параметры Oracle и нажмите «Подключиться».</p>
            </div>
            <span className="tag">CONNECT</span>
          </div>
          <div className="connection-grid">
            <label className="field">
              <span>IP адрес</span>
              <input
                className="input"
                value={connectionForm.host}
                onChange={(event) =>
                  setConnectionForm((prev) => ({ ...prev, host: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Порт</span>
              <input
                className="input"
                value={connectionForm.port}
                onChange={(event) =>
                  setConnectionForm((prev) => ({ ...prev, port: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Server name</span>
              <input
                className="input"
                value={connectionForm.service}
                onChange={(event) =>
                  setConnectionForm((prev) => ({ ...prev, service: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Логин</span>
              <input
                className="input"
                value={connectionForm.username}
                onChange={(event) =>
                  setConnectionForm((prev) => ({ ...prev, username: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input
                className="input"
                type="password"
                value={connectionForm.password}
                onChange={(event) =>
                  setConnectionForm((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </label>
            <div className="connection-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? 'Подключение...' : 'Подключиться'}
              </button>
              <p className="hint">Используются базовые параметры подключения по умолчанию.</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="tabs">
            {mainTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`tab-button ${activeTab === tab.value ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="section-divider" />

          {activeTab === 'sql' && (
            <section className="section-card">
              <div className="section-header">
                <div>
                  <h2>SQL запрос</h2>
                  <p>Введите запрос и получите результат в консоли ниже.</p>
                </div>
                <span className="tag">SQL</span>
              </div>
              <div className="section-grid">
                <div className="action-panel">
                  <label className="field">
                    <span>Запрос</span>
                    <textarea
                      className="textarea"
                      rows={8}
                      value={sqlQuery}
                      onChange={(event) => setSqlQuery(event.target.value)}
                    />
                  </label>
                  <div className="action-row">
                    <button className="btn btn-primary" type="button" onClick={handleSqlRun}>
                      Выполнить запрос
                    </button>
                  </div>
                </div>
                <div className="console-card">
                  <div className="console-header">Консоль вывода</div>
                  {sqlResult ? (
                    <>
                      <pre className="console-output">
                        {sqlResult.type === 'select'
                          ? `Получено строк: ${sqlResult.row_count}`
                          : `Запрос выполнен. Затронуто строк: ${sqlResult.row_count ?? 0}`}
                      </pre>
                      {sqlResult.type === 'select' && sqlRows.length > 0 && (
                        <div className="table-card">
                          <div
                            className="table-header"
                            style={{
                              gridTemplateColumns: `repeat(${sqlColumns.length}, minmax(120px, 1fr))`,
                            }}
                          >
                            {sqlColumns.map((col) => (
                              <span key={col}>{col}</span>
                            ))}
                          </div>
                          {sqlRows.map((row, index) => (
                            <div
                              key={`${index}-${row[sqlColumns[0]] ?? 'row'}`}
                              className="table-row"
                              style={{
                                gridTemplateColumns: `repeat(${sqlColumns.length}, minmax(120px, 1fr))`,
                              }}
                            >
                              {sqlColumns.map((col) => (
                                <span key={`${index}-${col}`}>{row[col] ?? '—'}</span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="console-placeholder">Запуск запроса выведет результат здесь.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'tables' && (
            <section className="section-card">
              <div className="section-header">
                <div>
                  <h2>Таблицы</h2>
                  <p>Просматривайте полный список таблиц базы данных.</p>
                </div>
                <span className="tag">TABLES</span>
              </div>
              {tableView.name ? (
                <div className="table-view">
                  <div className="table-view-header">
                    <div>
                      <h3>{tableView.name}</h3>
                      <p>Показаны первые {tableView.rows.length} строк.</p>
                    </div>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setTableView({ name: '', rows: [], columns: [] })}
                    >
                      Вернуться
                    </button>
                  </div>
                  <div className="table-card">
                    <div
                      className="table-header"
                      style={{
                        gridTemplateColumns: `repeat(${tableView.columns.length || 1}, minmax(140px, 1fr))`,
                      }}
                    >
                      {tableView.columns.map((col) => (
                        <span key={col}>{col}</span>
                      ))}
                    </div>
                    {tableView.rows.map((row, index) => (
                      <div
                        key={`${tableView.name}-${index}`}
                        className="table-row"
                        style={{
                          gridTemplateColumns: `repeat(${tableView.columns.length || 1}, minmax(140px, 1fr))`,
                        }}
                      >
                        {tableView.columns.map((col) => (
                          <span key={`${tableView.name}-${index}-${col}`}>{row[col] ?? '—'}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="table-grid">
                  {tables.map((table) => (
                    <button
                      key={table.table_name}
                      className="table-tile"
                      type="button"
                      onClick={() => handleTableOpen(table.table_name)}
                    >
                      <span className="table-name">{table.table_name}</span>
                      <span className="table-hint">Открыть таблицу →</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'procedures' && (
            <>
              <div className="tabs secondary-tabs">
                {procedureTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`tab-button ${procedureTab === tab.value ? 'active' : ''}`}
                    onClick={() => setProcedureTab(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {procedureTab === 'customers' && (
                <section className="section-card">
                  <div className="section-header">
                    <div>
                      <h2>Покупатели</h2>
                      <p>Управление карточками покупателей и контактами.</p>
                    </div>
                    <span className="tag">CLIENTS</span>
                  </div>
                  <div className="section-grid">
                    <div className="action-panel">
                      <div className="sub-tabs">
                        {['add', 'update', 'delete'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`tab-button ${customerActionTab === value ? 'active' : ''}`}
                            onClick={() => setCustomerActionTab(value)}
                          >
                            {value === 'add'
                              ? 'Добавление'
                              : value === 'update'
                                ? 'Редактирование'
                                : 'Удаление'}
                          </button>
                        ))}
                      </div>
                      <div className="form-grid">
                        {customerActionTab !== 'add' && (
                          <label className="field">
                            <span>Выбор покупателя</span>
                            <select
                              className="select"
                              value={customerForm.id}
                              onChange={(event) => {
                                const selected = customers.find(
                                  (customer) => customer.customer_id === Number(event.target.value)
                                )
                                if (selected) {
                                  setCustomerForm({
                                    id: selected.customer_id,
                                    name: selected.full_name,
                                    phone: selected.phone || '',
                                  })
                                }
                              }}
                            >
                              <option value="">Выберите покупателя</option>
                              {customers.map((customer) => (
                                <option key={customer.customer_id} value={customer.customer_id}>
                                  {customer.full_name} (#{customer.customer_id})
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {customerActionTab !== 'add' && (
                          <label className="field">
                            <span>ID</span>
                            <input
                              className="input"
                              value={customerForm.id}
                              onChange={(event) =>
                                setCustomerForm((prev) => ({ ...prev, id: event.target.value }))
                              }
                            />
                          </label>
                        )}
                        {customerActionTab !== 'delete' && (
                          <>
                            <label className="field">
                              <span>ФИО</span>
                              <input
                                className="input"
                                value={customerForm.name}
                                onChange={(event) =>
                                  setCustomerForm((prev) => ({ ...prev, name: event.target.value }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Телефон</span>
                              <input
                                className="input"
                                value={customerForm.phone}
                                onChange={(event) =>
                                  setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))
                                }
                              />
                            </label>
                          </>
                        )}
                        <div className="action-buttons">
                          {customerActionTab === 'add' && (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleCustomerAction('add')}
                            >
                              Добавить
                            </button>
                          )}
                          {customerActionTab === 'update' && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleCustomerAction('update')}
                            >
                              Обновить
                            </button>
                          )}
                          {customerActionTab === 'delete' && (
                            <button
                              className="btn btn-danger"
                              onClick={() => handleCustomerAction('delete')}
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="table-card">
                      <div className="table-header">
                        <span>ID</span>
                        <span>ФИО</span>
                        <span>Телефон</span>
                      </div>
                      {customers.map((customer) => (
                        <div key={customer.customer_id} className="table-row">
                          <span>{customer.customer_id}</span>
                          <span>{customer.full_name}</span>
                          <span>{customer.phone || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {procedureTab === 'sellers' && (
                <section className="section-card">
                  <div className="section-header">
                    <div>
                      <h2>Продавцы</h2>
                      <p>Управление сотрудниками и их привязкой к магазинам.</p>
                    </div>
                    <span className="tag">SALES TEAM</span>
                  </div>
                  <div className="section-grid">
                    <div className="action-panel">
                      <div className="sub-tabs">
                        {['add', 'update', 'delete'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`tab-button ${sellerActionTab === value ? 'active' : ''}`}
                            onClick={() => setSellerActionTab(value)}
                          >
                            {value === 'add'
                              ? 'Добавление'
                              : value === 'update'
                                ? 'Редактирование'
                                : 'Удаление'}
                          </button>
                        ))}
                      </div>
                      <div className="form-grid">
                        {sellerActionTab !== 'add' && (
                          <label className="field">
                            <span>Выбор продавца</span>
                            <select
                              className="select"
                              value={sellerForm.id}
                              onChange={(event) => {
                                const selected = sellers.find(
                                  (seller) => seller.seller_id === Number(event.target.value)
                                )
                                if (selected) {
                                  setSellerForm({
                                    id: selected.seller_id,
                                    name: selected.full_name,
                                    store_id: selected.store_id,
                                  })
                                }
                              }}
                            >
                              <option value="">Выберите продавца</option>
                              {sellers.map((seller) => (
                                <option key={seller.seller_id} value={seller.seller_id}>
                                  {seller.full_name} (#{seller.seller_id})
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {sellerActionTab !== 'add' && (
                          <label className="field">
                            <span>ID</span>
                            <input
                              className="input"
                              value={sellerForm.id}
                              onChange={(event) =>
                                setSellerForm((prev) => ({ ...prev, id: event.target.value }))
                              }
                            />
                          </label>
                        )}
                        {sellerActionTab !== 'delete' && (
                          <>
                            <label className="field">
                              <span>ФИО</span>
                              <input
                                className="input"
                                value={sellerForm.name}
                                onChange={(event) =>
                                  setSellerForm((prev) => ({ ...prev, name: event.target.value }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Магазин</span>
                              <select
                                className="select"
                                value={sellerForm.store_id}
                                onChange={(event) =>
                                  setSellerForm((prev) => ({ ...prev, store_id: event.target.value }))
                                }
                              >
                                <option value="">Выберите магазин</option>
                                {stores.map((store) => (
                                  <option key={store.store_id} value={store.store_id}>
                                    {store.store_name} (#{store.store_id})
                                  </option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                        <div className="action-buttons">
                          {sellerActionTab === 'add' && (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSellerAction('add')}
                            >
                              Добавить
                            </button>
                          )}
                          {sellerActionTab === 'update' && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleSellerAction('update')}
                            >
                              Обновить
                            </button>
                          )}
                          {sellerActionTab === 'delete' && (
                            <button
                              className="btn btn-danger"
                              onClick={() => handleSellerAction('delete')}
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="table-card">
                      <div className="table-header">
                        <span>ID</span>
                        <span>ФИО</span>
                        <span>Магазин</span>
                        <span>ID магазина</span>
                      </div>
                      {sellers.map((seller) => (
                        <div key={seller.seller_id} className="table-row">
                          <span>{seller.seller_id}</span>
                          <span>{seller.full_name}</span>
                          <span>{seller.store_name}</span>
                          <span>{seller.store_id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {procedureTab === 'sales' && (
                <section className="section-card">
                  <div className="section-header">
                    <div>
                      <h2>Продажи</h2>
                      <p>Контроль продаж и управление сделками.</p>
                    </div>
                    <span className="tag">SALES</span>
                  </div>
                  <div className="section-grid">
                    <div className="action-panel">
                      <div className="sub-tabs">
                        {['add', 'update', 'delete'].map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`tab-button ${saleActionTab === value ? 'active' : ''}`}
                            onClick={() => setSaleActionTab(value)}
                          >
                            {value === 'add'
                              ? 'Добавление'
                              : value === 'update'
                                ? 'Редактирование'
                                : 'Удаление'}
                          </button>
                        ))}
                      </div>
                      <div className="form-grid">
                        {saleActionTab !== 'add' && (
                          <label className="field">
                            <span>Выбор продажи</span>
                            <select
                              className="select"
                              value={saleForm.id}
                              onChange={(event) => {
                                const selected = sales.find(
                                  (sale) => sale.sale_id === Number(event.target.value)
                                )
                                if (selected) {
                                  setSaleForm({
                                    id: selected.sale_id,
                                    store_id: selected.store_id,
                                    seller_id: selected.seller_id,
                                    customer_id: selected.customer_id,
                                    sale_date: selected.sale_date,
                                  })
                                }
                              }}
                            >
                              <option value="">Выберите продажу</option>
                              {saleOptions.map((sale) => (
                                <option key={sale.sale_id} value={sale.sale_id}>
                                  {sale.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {saleActionTab !== 'add' && (
                          <label className="field">
                            <span>ID</span>
                            <input
                              className="input"
                              value={saleForm.id}
                              onChange={(event) =>
                                setSaleForm((prev) => ({ ...prev, id: event.target.value }))
                              }
                            />
                          </label>
                        )}
                        {saleActionTab !== 'delete' && (
                          <>
                            <label className="field">
                              <span>Дата</span>
                              <input
                                className="input"
                                type="date"
                                value={saleForm.sale_date}
                                onChange={(event) =>
                                  setSaleForm((prev) => ({ ...prev, sale_date: event.target.value }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Магазин</span>
                              <select
                                className="select"
                                value={saleForm.store_id}
                                onChange={(event) =>
                                  setSaleForm((prev) => ({ ...prev, store_id: event.target.value }))
                                }
                              >
                                <option value="">Выберите магазин</option>
                                {stores.map((store) => (
                                  <option key={store.store_id} value={store.store_id}>
                                    {store.store_name} (#{store.store_id})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Продавец</span>
                              <select
                                className="select"
                                value={saleForm.seller_id}
                                onChange={(event) =>
                                  setSaleForm((prev) => ({ ...prev, seller_id: event.target.value }))
                                }
                              >
                                <option value="">Выберите продавца</option>
                                {sellers.map((seller) => (
                                  <option key={seller.seller_id} value={seller.seller_id}>
                                    {seller.full_name} (#{seller.seller_id})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Покупатель</span>
                              <select
                                className="select"
                                value={saleForm.customer_id}
                                onChange={(event) =>
                                  setSaleForm((prev) => ({ ...prev, customer_id: event.target.value }))
                                }
                              >
                                <option value="">Выберите покупателя</option>
                                {customers.map((customer) => (
                                  <option key={customer.customer_id} value={customer.customer_id}>
                                    {customer.full_name} (#{customer.customer_id})
                                  </option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                        <div className="action-buttons">
                          {saleActionTab === 'add' && (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSaleAction('add')}
                            >
                              Добавить
                            </button>
                          )}
                          {saleActionTab === 'update' && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleSaleAction('update')}
                            >
                              Обновить
                            </button>
                          )}
                          {saleActionTab === 'delete' && (
                            <button
                              className="btn btn-danger"
                              onClick={() => handleSaleAction('delete')}
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="table-card">
                      <div className="table-header">
                        <span>ID</span>
                        <span>Дата</span>
                        <span>Магазин</span>
                        <span>Продавец</span>
                        <span>Покупатель</span>
                      </div>
                      {sales.map((sale) => (
                        <div key={sale.sale_id} className="table-row">
                          <span>{sale.sale_id}</span>
                          <span>{sale.sale_date}</span>
                          <span>{sale.store_name}</span>
                          <span>{sale.seller_name}</span>
                          <span>{sale.customer_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {procedureTab === 'logs' && (
                <section className="section-card">
                  <div className="section-header">
                    <div>
                      <h2>Журнал операций</h2>
                      <p>Фильтрация операций для аудита и диагностики.</p>
                    </div>
                    <span className="tag">LOGS</span>
                  </div>
                  <div className="section-grid">
                    <div className="controls-panel sticky-controls">
                      <label className="field">
                        <span>От</span>
                        <input
                          className="input"
                          type="date"
                          value={logFilters.from}
                          onChange={(event) =>
                            setLogFilters((prev) => ({ ...prev, from: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>До</span>
                        <input
                          className="input"
                          type="date"
                          value={logFilters.to}
                          onChange={(event) =>
                            setLogFilters((prev) => ({ ...prev, to: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Операция</span>
                        <select
                          className="select"
                          value={logFilters.op}
                          onChange={(event) =>
                            setLogFilters((prev) => ({ ...prev, op: event.target.value }))
                          }
                        >
                          <option value="">Все</option>
                          <option value="INSERT">INSERT</option>
                          <option value="UPDATE">UPDATE</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Сущность</span>
                        <select
                          className="select"
                          value={logFilters.entity}
                          onChange={(event) =>
                            setLogFilters((prev) => ({ ...prev, entity: event.target.value }))
                          }
                        >
                          <option value="">Все</option>
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="SELLER">SELLER</option>
                          <option value="SALE">SALE</option>
                        </select>
                      </label>
                      <div className="action-row">
                        <button className="btn btn-primary" onClick={loadLogs}>
                          Обновить логи
                        </button>
                      </div>
                    </div>
                    <div className="table-card">
                      <div className="table-header">
                        <span>ID</span>
                        <span>Сущность</span>
                        <span>PK</span>
                        <span>Операция</span>
                        <span>Дата</span>
                      </div>
                      {logs.map((log) => (
                        <div key={log.log_id} className="table-row">
                          <span>{log.log_id}</span>
                          <span>{log.entity_name}</span>
                          <span>{log.entity_pk}</span>
                          <span>{log.operation}</span>
                          <span>{log.operation_dt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {procedureTab === 'summary' && (
                <section className="section-card">
                  <div className="section-header">
                    <div>
                      <h2>Сводка по журналу</h2>
                      <p>Гибкая сортировка показателей активности.</p>
                    </div>
                    <span className="tag">SUMMARY</span>
                  </div>
                  <div className="section-grid">
                    <div className="controls-panel sticky-controls">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={summarySort.sort_entity}
                          onChange={(event) =>
                            setSummarySort((prev) => ({
                              ...prev,
                              sort_entity: event.target.checked,
                            }))
                          }
                        />
                        <span>Сортировка по сущности</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={summarySort.sort_op}
                          onChange={(event) =>
                            setSummarySort((prev) => ({ ...prev, sort_op: event.target.checked }))
                          }
                        />
                        <span>Сортировка по операции</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={summarySort.sort_count}
                          onChange={(event) =>
                            setSummarySort((prev) => ({ ...prev, sort_count: event.target.checked }))
                          }
                        />
                        <span>Сортировка по количеству</span>
                      </label>
                      <div className="action-row">
                        <button className="btn btn-primary" onClick={loadSummary}>
                          Получить сводку
                        </button>
                      </div>
                    </div>
                    <div className="table-card">
                      <div className="table-header">
                        <span>Сущность</span>
                        <span>Операция</span>
                        <span>Количество</span>
                      </div>
                      {summary.map((row, index) => (
                        <div key={`${row.entity_name}-${row.operation}-${index}`} className="table-row">
                          <span>{row.entity_name}</span>
                          <span>{row.operation}</span>
                          <span>{row.cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {procedureTab === 'rollback' && (
                <section className="section-card">
                  <div className="section-header">
                    <div>
                      <h2>Откат по логу</h2>
                      <p>Безопасный откат выбранной операции из журнала.</p>
                    </div>
                    <span className="tag">ROLLBACK</span>
                  </div>
                  <div className="section-grid wide">
                    <label className="field">
                      <span>Запись журнала для отката</span>
                      <select
                        className="select"
                        value={rollbackLogId || ''}
                        onChange={(event) =>
                          setRollbackLogId(event.target.value ? Number(event.target.value) : null)
                        }
                      >
                        <option value="">Выберите запись</option>
                        {logs.map((log) => (
                          <option key={log.log_id} value={log.log_id}>
                            #{log.log_id} · {log.entity_name} · {log.operation}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="action-row">
                      <button className="btn btn-warning" onClick={handleRollback}>
                        Выполнить откат
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {snackbar.open && (
        <div className={`toast toast-${snackbar.severity}`}>
          <span>{snackbar.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export default App
