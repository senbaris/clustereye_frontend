import React, { useEffect } from 'react';
import './index.css';
import Mongo from './mongo';
import MainLayout from './layout';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Postgres from './postgresql';
import Mssql from './mssql';
import Cassandra from './cassandra';
import HeatmapDisk from './heatmapdisk';
import { AuthProvider } from './authcontext';  // AuthProvider'ı import edin
import QueryAnalyzer from './queryAnalyzer';
import ChangeDataCenter from './changeDataCenter';
import PostgrePA from './postgrepa';
import MongoPA from './mongopa';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DbDeploys from './dbdeployrequests';
import Dashboard from './generalDashboard';
import AlarmDashboard from './alarmdashboard';
import ApplicationMapping from './applicationmapping';
import Login from './pages/Login';
import { Provider, useDispatch } from 'react-redux';
import { store } from './store';
import { setAuth } from './store/authSlice';




export interface GeneralProps {
}


const queryClient = new QueryClient()
const App: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Sayfa yenilendiğinde auth state'i kontrol et
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (token && user) {
      dispatch(setAuth({
        isLoggedIn: true,
        user: user
      }));
    }
  }, [dispatch]);

  return (
    <Provider store={store}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Mongo/>} />
                <Route path="/postgresql" element={<Postgres />} />
                <Route path="/cassandra" element={<Cassandra />} />
                <Route path="/mssql" element={<Mssql />} />
                <Route path="/heatmapdisk" element={<HeatmapDisk />} />
                <Route path="/queryanalyzer" element={<QueryAnalyzer />} /> {/* URL düzenlemesi */}
                <Route path="/changedc" element={<ChangeDataCenter />} />
                <Route path="/postgrepa" element={<PostgrePA />} /> {/* URL düzenlemesi */}
                <Route path="/mongopa" element={<MongoPA />} /> {/* URL düzenlemesi */}
                <Route path="/dbdeploys" element={<DbDeploys />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/alarmdashboard" element={<AlarmDashboard />} />
                <Route path="/applicationmapping" element={<ApplicationMapping />} />
                <Route path="/login" element={<Login />} />


                {/* Diğer route'lar... */}
              </Routes>
            </MainLayout>
          </Router>
        </QueryClientProvider>
      </AuthProvider>
    </Provider>
  );
};

export default App;
