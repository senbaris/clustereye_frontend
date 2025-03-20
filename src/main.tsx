import ReactDOM from 'react-dom/client'
import AdminApp from './App.tsx'
import './index.css'
import { Provider } from 'react-redux';
import { store } from "../redux/store";
import Keycloak from "keycloak-js";
import { ReactKeycloakProvider } from '@react-keycloak/web';


const keycloakConf = new Keycloak({
  realm: "dbstatus.hepsi.io",
  url: "https://auth.hepsi.io",
  clientId: "dbstatus_hepsi_io",
})

const keycloakProviderInitConfig = {
  onLoad: 'check-sso',
  checkLoginIframe: false
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <ReactKeycloakProvider
    authClient={keycloakConf}
    initOptions={keycloakProviderInitConfig}
  >
    <Provider store={store}>
      <AdminApp />
    </Provider>
  </ReactKeycloakProvider>

)
