import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './shared/theme'
import { SoundProvider } from './shared/sound'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <SoundProvider>
        <App />
      </SoundProvider>
    </ThemeProvider>
  </React.StrictMode>
)
