import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

export const fetchStores = () => api.get('/stores')
export const fetchCustomers = () => api.get('/customers')
export const fetchSellers = () => api.get('/sellers')
export const fetchSales = () => api.get('/sales')
export const fetchLogs = (params) => api.get('/logs', { params })
export const fetchLogSummary = (params) => api.get('/logs/summary', { params })
export const rollbackLog = (payload) => api.post('/logs/rollback', payload)
export const fetchTables = () => api.get('/tables')
export const fetchTableData = (tableName) => api.get(`/tables/${tableName}`)
export const executeSql = (payload) => api.post('/sql', payload)
export const fetchHealth = () => api.get('/health')

export const manageCustomer = (payload) => api.post('/customers', payload)
export const manageSeller = (payload) => api.post('/sellers', payload)
export const manageSale = (payload) => api.post('/sales', payload)
