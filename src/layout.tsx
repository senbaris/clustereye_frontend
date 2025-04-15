import React, { ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import './index.css';
import { Badge, Layout, Menu, Space, Input, Tooltip } from 'antd';
import { useSelector, useDispatch } from "react-redux";
import SearchContext from './searchContext';
import ErrorModal from './errorModal';
import { LogoutOutlined, LoginOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons';
import { MdOutlineStorage, MdOutlineTableChart, MdOutlineInventory, MdRocketLaunch, MdDashboard, MdOutlineSwapHoriz } from 'react-icons/md';
import { AiOutlineAreaChart, AiFillCloud, AiOutlineFire, AiOutlineFileSearch } from 'react-icons/ai';
import { logout } from './store/authSlice';
import { RootState } from './store';
import AddClusterModal from './components/AddClusterModal';

interface MainLayoutProps {
  children: ReactNode;
}

const { Header, Content, Footer, Sider } = Layout;
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const headStats = useSelector((state: any) => state.headStats);
  const [searchTerm, setSearchTerm] = useState('');
  const dispatch = useDispatch();
  const { isLoggedIn, user } = useSelector((state: RootState) => state.auth);
  const [modalVisible, setModalVisible] = useState(false);

  const username = user?.given_name;

  const siderMenuItems = [
    {
      key: "9",
      label: (
        <Link to="/alarmdashboard">
          <AlertOutlined style={{ marginRight: '8px', color: '#FF5733' }} />
          Alarm Dashboard
        </Link>
      ),
    },
    {
      key: "1",
      label: "MongoDB",
      icon: <MdOutlineStorage style={{ color: '#47A248' }} />,
      children: [
        {
          key: "1-1",
          label: (
            <Link to="/">
              <MdDashboard style={{ marginRight: '8px', color: '#47A248' }} />
              Overview
            </Link>
          ),
        },
        {
          key: "1-2",
          label: (
            <Link to="/queryanalyzer">
              <AiOutlineFileSearch style={{ marginRight: '8px', color: '#47A248' }} />
              Log Analyzer
            </Link>
          ),
        },
        isLoggedIn
          ? {
            key: "1-3",
            label: (
              <Link to="/changedc">
                <MdOutlineSwapHoriz style={{ marginRight: '8px', color: '#47A248' }} />
                Change DC
              </Link>
            ),
          }
          : undefined,
      ].filter(Boolean), // undefined değerleri kaldırır
    },
    {
      key: "2",
      label: "PostgreSQL",
      icon: <AiOutlineAreaChart style={{ color: '#336791' }} />,
      children: [
        {
          key: "2-1",
          label: (
            <Link to="/postgresql">
              <MdDashboard style={{ marginRight: '8px', color: '#336791' }} />
              Overview
            </Link>
          ),
        },
      ],
    },
    {
      key: "3",
      label: (
        <Link to="/cassandra">
          <AiFillCloud style={{ marginRight: '8px', color: '#1287B1' }} />
          Cassandra
        </Link>
      ),
    },
    {
      key: "7",
      label: (
        <Link to="/mssql">
          <MdOutlineTableChart style={{ marginRight: '8px', color: '#A4373A' }} />
          SQL Server
        </Link>
      ),
    },
    {
      key: "4",
      label: (
        <Link to="/heatmapdisk">
          <AiOutlineFire style={{ marginRight: '8px', color: '#FF5733' }} />
          Disk Heatmap
        </Link>
      ),
    },
    {
      key: "8",
      label: (
        <Link to="/dashboard">
          <AiOutlineFire style={{ marginRight: '8px', color: '#FF5733' }} />
          Cluster Heatmap
        </Link>
      ),
    },

    {
      key: "10",
      label: (
        <Link to="/applicationmapping">
          <AiOutlineAreaChart style={{ marginRight: '8px', color: '#FF5733' }} />
          Application Mapping
        </Link>
      ),
    },
    {
      key: "5",
      label: (
        <Link to="/inventory">
          <MdOutlineInventory style={{ marginRight: '8px', color: '#FF5733' }} />
          Inventory
        </Link>
      ),
    },
    ...(isLoggedIn
      ? [
        {
          key: "6",
          label: (
            <Link to="/dbdeploys">
              <MdRocketLaunch style={{ marginRight: '8px', color: '#FF5733' }} />
              DB Deploys
            </Link>
          ),
        },
      ]
      : []),
  ];
  
  return (
    <SearchContext.Provider value={{ searchTerm, setSearchTerm }}>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><img src="/clustereye_logo.png" width={75} height={75} alt="ClusterEye" style={{ marginRight: 20, marginTop: 15 }} /></div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>

            <Input.Search style={{ marginLeft: 70, width: 280 }}
              placeholder="Search for clusters.."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={(value) => setSearchTerm(value)}
            />
          </div>
          <div style={{ marginLeft: 'auto', color: 'white', border: 'none' }}>
            <Space>
              {(() => {
                switch (headStats.panelName) {
                  case 'mongo':
                    return (
                      <>
                        <Tooltip title="Total Clusters">
                          <div style={{ cursor: 'pointer' }}><Badge count={headStats.panelCount} showZero color='green' overflowCount={999} /></div>
                        </Tooltip>
                        <Tooltip title="Total Nodes" >
                          <div style={{ cursor: 'pointer' }}><Badge count={headStats.totalMemberCount} showZero color="green" overflowCount={999} /></div>
                        </Tooltip>
                        <Tooltip title="Unhealthy Nodes"> <div style={{ cursor: 'pointer' }}><Badge count={headStats.nonStandardStatusCount} showZero title='' text='' overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Partially Healthy Clusters"><div style={{ cursor: 'pointer' }}><Badge count={headStats.panelsWithOneDifferentStatusCount} showZero text='' color='#fc621fff' overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Total Primaries in Esenyurt"><div /* onClick={() => setShowOnlyEsenyurtPrimary(!showOnlyGebzePrimary)} */ style={{ cursor: 'pointer' }}><Badge count={headStats.primaryMembersInEsenyurtCount} showZero title='' color='blue' overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Total Primaries in Gebze"><div /* onClick={() => setShowOnlyGebzePrimary(!showOnlyGebzePrimary)} */ style={{ cursor: 'pointer' }}><Badge count={headStats.primaryMembersInGebzeCount} showZero title='' color='gray' overflowCount={999} /></div></Tooltip>
                        <Badge
                        />
                      </>
                    );

                  case 'postgresql':
                    return (
                      <>
                        <Tooltip title="Total Clusters">
                          <div style={{ cursor: 'pointer' }}><Badge count={headStats.panelCount} showZero color='green' overflowCount={999} /></div>
                        </Tooltip>
                        <Tooltip title="Total Nodes">
                          <div style={{ cursor: 'pointer' }}><Badge count={(typeof headStats.allMembersCount === 'number' ? headStats.allMembersCount : 0)} showZero color="green" overflowCount={999} /></div>
                        </Tooltip>
                        <Tooltip title="Not Running PGBouncers"><div style={{ cursor: 'pointer' }}><Badge count={headStats.nonRunningPGBouncerCount} showZero title="" text='' color="red" overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Not Running PGServices"><div style={{ cursor: 'pointer' }}><Badge count={headStats.nonRunningPGServiceCount} showZero title="" text='' color="red" overflowCount={999} /></div></Tooltip>
                        <Tooltip title="MASTER Nodes in Esenyurt DC"><div style={{ cursor: 'pointer' }}><Badge count={headStats.masterEsenyurtCount} showZero title="" text='' color="blue" overflowCount={999} /></div></Tooltip>
                        <Tooltip title="MASTER Nodes in Gebze DC"><div style={{ cursor: 'pointer' }}><Badge count={headStats.masterGebzeCount} showZero title="" text='' color="gray" overflowCount={999} /></div></Tooltip>
                        <Badge
                        />
                      </>
                    );

                  case 'cassandra':
                    return (
                      <>
                        <Tooltip title="Total Clusters"><div style={{ cursor: 'pointer' }}><Badge count={headStats.panelCount} showZero color='green' title='' text='' overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Total Nodes"><div style={{ cursor: 'pointer' }}><Badge count={headStats.totalCount} showZero color='green' title='' text='' overflowCount={999} /></div></Tooltip>
                        <Badge
                        />
                      </>
                    );
                  case 'clusterheatmap':
                    return (
                      <>
                        <Tooltip title="Total Mongodb Nodes"><div style={{ cursor: 'pointer' }}><Badge count={headStats.totalMongoNodes} showZero color='green' title='' text='' overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Total Postgresql Nodes"><div style={{ cursor: 'pointer' }}>
                          <Badge count={headStats.totalPostgresNodes} showZero color='blue' title='' text='' overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Total Critical Nodes"><div style={{ cursor: 'pointer' }}>
                          <Badge count={headStats.criticalNodes} showZero color='red' title='' text='' overflowCount={999} /></div></Tooltip>
                        <Tooltip title="Total Warning Nodes"><div style={{ cursor: 'pointer' }}>
                          <Badge count={headStats.warningNodes} showZero color='#FFC107' title='' text='' overflowCount={999} /></div></Tooltip>

                        <Badge
                        />
                      </>
                    );

                  case 'alarmdashboard':
                    return (
                      <Space key={headStats.panelName || 'default'}>

                      </Space>
                    );


                  default:

                    <Space key={headStats.panelName || 'default'}>
                      <Tooltip title="No data available">
                        <div style={{ cursor: 'pointer' }}>
                          <Badge count={0} showZero color="gray" overflowCount={999} />
                        </div>
                      </Tooltip>
                    </Space>

                }
              })()}
            </Space>
          </div>
          <div style={{ marginLeft: '10px', cursor: 'pointer' }} onClick={() => navigate('/settings')}>
            <Tooltip title="Settings">
              <SettingOutlined style={{ fontSize: '18px', color: 'white' }} />
            </Tooltip>
          </div>
          <ErrorModal />

          <div
            style={{
              cursor: 'pointer',
              display: 'inline-flex', // İkon ve yazıyı yan yana hizalamak için
              alignItems: 'center', // Dikey olarak ortalamak için
            }}
          >
            {isLoggedIn ? (
              <div
                onClick={() => dispatch(logout())}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginLeft: 8,
                }}
              >
                <h5 style={{ color: 'white', marginRight: 8 }}>{username}</h5>
                <Tooltip title="Logout">
                  <LogoutOutlined
                    style={{
                      fontSize: '18px',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  />
                </Tooltip>
              </div>
            ) : (
              <div
                onClick={() => navigate('/login')}
                style={{
                  marginLeft: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <Tooltip title="Login">
                  <LoginOutlined
                    style={{
                      fontSize: '18px',
                      color: 'white',
                      cursor: 'pointer',
                      marginLeft: '8px',
                    }}
                  />
                </Tooltip>
                <h5 style={{ color: 'white', marginLeft: 8 }}>Login</h5>
              </div>
            )}
          </div>

        </Header>
        <Layout>
          <Sider width={200} className="site-layout-background">
            <Menu
              className="custom-menu"
              mode="inline"
              defaultSelectedKeys={['1']}
              defaultOpenKeys={['sub1']}
              style={{ height: '100%', borderRight: 0 }}
              items={siderMenuItems}
            />
          </Sider>
          <Layout style={{ padding: '0 5px', minHeight: '80vh' }}>
            <Content style={{ padding: 24, margin: 0, minHeight: 280, color: 'black' }}>
              {children}
            </Content>
            <Footer style={{ textAlign: 'center' }}>ClusterEye v2.1</Footer>
          </Layout>
        </Layout>
      </Layout>

      <AddClusterModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />
    </SearchContext.Provider>
  );

};

export default MainLayout;