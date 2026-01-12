import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Рендерим корневой React-компонент в контейнер #root.
// StrictMode помогает выявлять потенциальные проблемы в режиме разработки.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
