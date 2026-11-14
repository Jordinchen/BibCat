import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

window.bibcraft.app.info().then((info) => {
  document.documentElement.dataset.platform = info.platform
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App info={info} />
    </StrictMode>
  )
})
