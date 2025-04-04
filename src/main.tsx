import ReactDOM from 'react-dom/client'
import AdminApp from './App.tsx'
import './index.css'
import { Provider } from 'react-redux'
import { store } from './store'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <AdminApp />
  </Provider>
)
