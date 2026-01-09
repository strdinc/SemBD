import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  fetchCustomers,
  fetchLogSummary,
  fetchLogs,
  fetchSales,
  fetchSellers,
  fetchStores,
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

const tabs = [
  { label: 'Покупатели', value: 'customers' },
  { label: 'Продавцы', value: 'sellers' },
  { label: 'Продажи', value: 'sales' },
  { label: 'Логи', value: 'logs' },
  { label: 'Сводка', value: 'summary' },
  { label: 'Откат', value: 'rollback' },
]

function App() {
  const [activeTab, setActiveTab] = useState('customers')
  const [stores, setStores] = useState([])
  const [customers, setCustomers] = useState([])
  const [sellers, setSellers] = useState([])
  const [sales, setSales] = useState([])
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState([])
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [sellerForm, setSellerForm] = useState(emptySeller)
  const [saleForm, setSaleForm] = useState(emptySale)

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

  const refreshAll = async () => {
    try {
      const [storesRes, customersRes, sellersRes, salesRes] = await Promise.all([
        fetchStores(),
        fetchCustomers(),
        fetchSellers(),
        fetchSales(),
      ])
      setStores(storesRes.data)
      setCustomers(customersRes.data)
      setSellers(sellersRes.data)
      setSales(salesRes.data)
    } catch (error) {
      showMessage('Не удалось загрузить справочники', 'error')
    }
  }

  useEffect(() => {
    refreshAll()
    loadLogs()
    loadSummary()
  }, [])

  const showMessage = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }

  const handleCustomerAction = async (action) => {
    try {
      await manageCustomer({ action, ...customerForm, id: Number(customerForm.id) })
      showMessage('Операция с покупателями выполнена')
      setCustomerForm(emptyCustomer)
      await refreshAll()
    } catch (error) {
      showMessage('Ошибка при работе с покупателями', 'error')
    }
  }

  const handleSellerAction = async (action) => {
    try {
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
      showMessage('Ошибка при работе с продавцами', 'error')
    }
  }

  const handleSaleAction = async (action) => {
    try {
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
      showMessage('Ошибка при работе с продажами', 'error')
    }
  }

  const loadLogs = async () => {
    try {
      const response = await fetchLogs({
        from: logFilters.from || undefined,
        to: logFilters.to || undefined,
        op: logFilters.op || undefined,
        entity: logFilters.entity || undefined,
      })
      setLogs(response.data)
    } catch (error) {
      showMessage('Не удалось загрузить логи', 'error')
    }
  }

  const loadSummary = async () => {
    try {
      const response = await fetchLogSummary({
        sort_entity: summarySort.sort_entity ? 1 : 0,
        sort_op: summarySort.sort_op ? 1 : 0,
        sort_count: summarySort.sort_count ? 1 : 0,
      })
      setSummary(response.data)
    } catch (error) {
      showMessage('Не удалось загрузить сводку', 'error')
    }
  }

  const handleRollback = async () => {
    if (!rollbackLogId) {
      showMessage('Выберите лог для отката', 'warning')
      return
    }
    try {
      await rollbackLog({ log_id: rollbackLogId })
      showMessage('Откат выполнен')
      setRollbackLogId(null)
      await refreshAll()
      await loadLogs()
      await loadSummary()
    } catch (error) {
      showMessage('Ошибка при откате', 'error')
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

  return (
    <Box className="app-shell">
      <Box className="app-header">
        <Typography variant="h4">SEM_PKG GUI</Typography>
        <Typography color="text.secondary">
          Графический доступ к процедурам и журналу аудита.
        </Typography>
      </Box>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
        {tabs.map((tab) => (
          <Tab key={tab.value} label={tab.label} value={tab.value} />
        ))}
      </Tabs>

      <Divider className="section-divider" />

      {activeTab === 'customers' && (
        <Card className="section-card">
          <CardContent>
            <Typography variant="h6">Покупатели</Typography>
            <Grid container spacing={3} className="section-grid">
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => `${option.full_name} (#${option.customer_id})`}
                  onChange={(_, value) => {
                    if (value) {
                      setCustomerForm({
                        id: value.customer_id,
                        name: value.full_name,
                        phone: value.phone || '',
                      })
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Выбор покупателя для редактирования" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  label="ID"
                  value={customerForm.id}
                  onChange={(event) =>
                    setCustomerForm((prev) => ({ ...prev, id: event.target.value }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="ФИО"
                  value={customerForm.name}
                  onChange={(event) =>
                    setCustomerForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Телефон"
                  value={customerForm.phone}
                  onChange={(event) =>
                    setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={8} className="action-row">
                <Button variant="contained" onClick={() => handleCustomerAction('add')}>
                  Добавить
                </Button>
                <Button variant="outlined" onClick={() => handleCustomerAction('update')}>
                  Обновить
                </Button>
                <Button color="error" variant="outlined" onClick={() => handleCustomerAction('delete')}>
                  Удалить
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Box className="table">
                  <Box className="table-header">
                    <span>ID</span>
                    <span>ФИО</span>
                    <span>Телефон</span>
                  </Box>
                  {customers.map((customer) => (
                    <Box key={customer.customer_id} className="table-row">
                      <span>{customer.customer_id}</span>
                      <span>{customer.full_name}</span>
                      <span>{customer.phone || '—'}</span>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 'sellers' && (
        <Card className="section-card">
          <CardContent>
            <Typography variant="h6">Продавцы</Typography>
            <Grid container spacing={3} className="section-grid">
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={sellers}
                  getOptionLabel={(option) => `${option.full_name} (#${option.seller_id})`}
                  onChange={(_, value) => {
                    if (value) {
                      setSellerForm({
                        id: value.seller_id,
                        name: value.full_name,
                        store_id: value.store_id,
                      })
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Выбор продавца для редактирования" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  label="ID"
                  value={sellerForm.id}
                  onChange={(event) =>
                    setSellerForm((prev) => ({ ...prev, id: event.target.value }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="ФИО"
                  value={sellerForm.name}
                  onChange={(event) =>
                    setSellerForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={stores}
                  getOptionLabel={(option) => `${option.store_name} (#${option.store_id})`}
                  value={stores.find((store) => store.store_id === Number(sellerForm.store_id)) || null}
                  onChange={(_, value) =>
                    setSellerForm((prev) => ({ ...prev, store_id: value ? value.store_id : '' }))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Магазин" />
                  )}
                />
              </Grid>
              <Grid item xs={12} className="action-row">
                <Button variant="contained" onClick={() => handleSellerAction('add')}>
                  Добавить
                </Button>
                <Button variant="outlined" onClick={() => handleSellerAction('update')}>
                  Обновить
                </Button>
                <Button color="error" variant="outlined" onClick={() => handleSellerAction('delete')}>
                  Удалить
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Box className="table">
                  <Box className="table-header">
                    <span>ID</span>
                    <span>ФИО</span>
                    <span>Магазин</span>
                    <span>ID магазина</span>
                  </Box>
                  {sellers.map((seller) => (
                    <Box key={seller.seller_id} className="table-row">
                      <span>{seller.seller_id}</span>
                      <span>{seller.full_name}</span>
                      <span>{seller.store_name}</span>
                      <span>{seller.store_id}</span>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 'sales' && (
        <Card className="section-card">
          <CardContent>
            <Typography variant="h6">Продажи</Typography>
            <Grid container spacing={3} className="section-grid">
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={saleOptions}
                  getOptionLabel={(option) => option.label}
                  onChange={(_, value) => {
                    if (value) {
                      setSaleForm({
                        id: value.sale_id,
                        store_id: value.store_id,
                        seller_id: value.seller_id,
                        customer_id: value.customer_id,
                        sale_date: value.sale_date,
                      })
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Выбор продажи для редактирования" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  label="ID"
                  value={saleForm.id}
                  onChange={(event) =>
                    setSaleForm((prev) => ({ ...prev, id: event.target.value }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Дата"
                  type="date"
                  value={saleForm.sale_date}
                  onChange={(event) =>
                    setSaleForm((prev) => ({ ...prev, sale_date: event.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={stores}
                  getOptionLabel={(option) => `${option.store_name} (#${option.store_id})`}
                  value={stores.find((store) => store.store_id === Number(saleForm.store_id)) || null}
                  onChange={(_, value) =>
                    setSaleForm((prev) => ({ ...prev, store_id: value ? value.store_id : '' }))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Магазин" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={sellers}
                  getOptionLabel={(option) => `${option.full_name} (#${option.seller_id})`}
                  value={sellers.find((seller) => seller.seller_id === Number(saleForm.seller_id)) || null}
                  onChange={(_, value) =>
                    setSaleForm((prev) => ({ ...prev, seller_id: value ? value.seller_id : '' }))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Продавец" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => `${option.full_name} (#${option.customer_id})`}
                  value={
                    customers.find((customer) => customer.customer_id === Number(saleForm.customer_id)) ||
                    null
                  }
                  onChange={(_, value) =>
                    setSaleForm((prev) => ({ ...prev, customer_id: value ? value.customer_id : '' }))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Покупатель" />
                  )}
                />
              </Grid>
              <Grid item xs={12} className="action-row">
                <Button variant="contained" onClick={() => handleSaleAction('add')}>
                  Добавить
                </Button>
                <Button variant="outlined" onClick={() => handleSaleAction('update')}>
                  Обновить
                </Button>
                <Button color="error" variant="outlined" onClick={() => handleSaleAction('delete')}>
                  Удалить
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Box className="table">
                  <Box className="table-header">
                    <span>ID</span>
                    <span>Дата</span>
                    <span>Магазин</span>
                    <span>Продавец</span>
                    <span>Покупатель</span>
                  </Box>
                  {sales.map((sale) => (
                    <Box key={sale.sale_id} className="table-row">
                      <span>{sale.sale_id}</span>
                      <span>{sale.sale_date}</span>
                      <span>{sale.store_name}</span>
                      <span>{sale.seller_name}</span>
                      <span>{sale.customer_name}</span>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card className="section-card">
          <CardContent>
            <Typography variant="h6">Журнал операций</Typography>
            <Grid container spacing={3} className="section-grid">
              <Grid item xs={12} md={3}>
                <TextField
                  label="От"
                  type="date"
                  value={logFilters.from}
                  onChange={(event) =>
                    setLogFilters((prev) => ({ ...prev, from: event.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="До"
                  type="date"
                  value={logFilters.to}
                  onChange={(event) =>
                    setLogFilters((prev) => ({ ...prev, to: event.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Операция</InputLabel>
                  <Select
                    value={logFilters.op}
                    label="Операция"
                    onChange={(event) =>
                      setLogFilters((prev) => ({ ...prev, op: event.target.value }))
                    }
                  >
                    <MenuItem value="">Все</MenuItem>
                    <MenuItem value="INSERT">INSERT</MenuItem>
                    <MenuItem value="UPDATE">UPDATE</MenuItem>
                    <MenuItem value="DELETE">DELETE</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Сущность</InputLabel>
                  <Select
                    value={logFilters.entity}
                    label="Сущность"
                    onChange={(event) =>
                      setLogFilters((prev) => ({ ...prev, entity: event.target.value }))
                    }
                  >
                    <MenuItem value="">Все</MenuItem>
                    <MenuItem value="CUSTOMER">CUSTOMER</MenuItem>
                    <MenuItem value="SELLER">SELLER</MenuItem>
                    <MenuItem value="SALE">SALE</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={loadLogs}>
                  Обновить логи
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Box className="table">
                  <Box className="table-header">
                    <span>ID</span>
                    <span>Сущность</span>
                    <span>PK</span>
                    <span>Операция</span>
                    <span>Дата</span>
                  </Box>
                  {logs.map((log) => (
                    <Box key={log.log_id} className="table-row">
                      <span>{log.log_id}</span>
                      <span>{log.entity_name}</span>
                      <span>{log.entity_pk}</span>
                      <span>{log.operation}</span>
                      <span>{log.operation_dt}</span>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 'summary' && (
        <Card className="section-card">
          <CardContent>
            <Typography variant="h6">Сводка по журналу</Typography>
            <Grid container spacing={3} className="section-grid">
              <Grid item xs={12} md={4}>
                <Box className="checkbox-row">
                  <Checkbox
                    checked={summarySort.sort_entity}
                    onChange={(event) =>
                      setSummarySort((prev) => ({ ...prev, sort_entity: event.target.checked }))
                    }
                  />
                  <Typography>Сортировка по сущности</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box className="checkbox-row">
                  <Checkbox
                    checked={summarySort.sort_op}
                    onChange={(event) =>
                      setSummarySort((prev) => ({ ...prev, sort_op: event.target.checked }))
                    }
                  />
                  <Typography>Сортировка по операции</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box className="checkbox-row">
                  <Checkbox
                    checked={summarySort.sort_count}
                    onChange={(event) =>
                      setSummarySort((prev) => ({ ...prev, sort_count: event.target.checked }))
                    }
                  />
                  <Typography>Сортировка по количеству</Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={loadSummary}>
                  Получить сводку
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Box className="table">
                  <Box className="table-header">
                    <span>Сущность</span>
                    <span>Операция</span>
                    <span>Количество</span>
                  </Box>
                  {summary.map((row, index) => (
                    <Box key={`${row.entity_name}-${row.operation}-${index}`} className="table-row">
                      <span>{row.entity_name}</span>
                      <span>{row.operation}</span>
                      <span>{row.cnt}</span>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 'rollback' && (
        <Card className="section-card">
          <CardContent>
            <Typography variant="h6">Откат по логу</Typography>
            <Grid container spacing={3} className="section-grid">
              <Grid item xs={12} md={8}>
                <Autocomplete
                  options={logs}
                  getOptionLabel={(option) =>
                    `#${option.log_id} · ${option.entity_name} · ${option.operation}`
                  }
                  value={logs.find((log) => log.log_id === rollbackLogId) || null}
                  onChange={(_, value) => setRollbackLogId(value ? value.log_id : null)}
                  renderInput={(params) => (
                    <TextField {...params} label="Запись журнала для отката" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4} className="action-row">
                <Button color="warning" variant="contained" onClick={handleRollback}>
                  Выполнить откат
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default App
