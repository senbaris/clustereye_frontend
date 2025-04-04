import React, { useState, useEffect, useContext, useRef } from 'react';
import './index.css';
import { Space, Badge, Tooltip, Button } from 'antd';
import IconPostgres from './icons/postgresql'
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { setHeadStats } from '../redux/redux';
import SearchContext from './searchContext';
import {  PlusOutlined } from '@ant-design/icons';
import CustomCard from './customCard';
import runningGif from './assets/Running.gif';
import moment, {  } from 'moment';
import { RootState } from './store';
import AddClusterModal from './components/AddClusterModal';
import ClusterTopology from './components/ClusterTopology';




type ClusterData = { [clusterName: string]: PostgresNode[] };

interface PostgresNode {
    DC: string;
    IP: string;
    FreeDisk: string;
    Hostname: string;
    FDPercent: string;
    PGVersion: string;
    NodeStatus: string;
    ClusterName: string;
    PGBouncerStatus: string;
    PGServiceStatus: string;
    dbAgentStatus: string;
    ReplicationLagSec: string;
}

interface PgNodes {
    ClusterName: string,
    key: string,
    Hostname: string,
    NodeStatus: string,
    IP: string,
    DC: string,
    FreeDisk: string,
    FDPercent: string,
    PGVersion: string,
    PGBouncerStatus: string,
    PGServiceStatus: string,
    dbAgentStatus: string,
    ReplicationLagSec: string,
}

interface NodeStatus {
    nodename: string;
    isUpdated: boolean;
    hasAgent: boolean;
    agentStatus?: string;
}

interface PostgresConnInfo {
    nodename: string;
    send_diskalert: boolean;
    silence_until: {
        Time: string;
        Valid: boolean;
    } | null;
}

interface ClusterMetrics {
    totalNodes: number;
    activeNodes: number;
    masterNode: string;
    avgDiskUsage: number;
    replicationLag: number;
    pgBouncerStatus: {
        running: number;
        total: number;
    };
    pgServiceStatus: {
        running: number;
        total: number;
    };
    pgBouncerDetails: {
        nodeName: string;
        status: string;
    }[];
    pgServiceDetails: {
        nodeName: string;
        status: string;
    }[];
}

interface AgentStatus {
    connection: string;
    hostname: string;
    id: string;
    ip: string;
    last_seen: string;
    status: string;
}

const Postgres: React.FC = () => {
    //const [data, setData] = useState<ClusterData>([]);
    const dispatch = useDispatch();
    const [nonRunningPGBouncerCount, setNonRunningPGBouncerCount] = useState(0);
    const [nonRunningPGServiceCount, setNonRunningPGServiceCount] = useState(0);
    const [masterEsenyurtCount, setMasterEsenyurtCount] = useState<number>(0);
    const [masterGebzeCount, setMasterGebzeCount] = useState<number>(0);
    const [data, setData] = useState<Array<ClusterData>>([]);
    const [activeCluster, setActiveCluster] = useState<PgNodes[]>([]);
    const [loading, setLoading] = useState(true);
    const POLLING_INTERVAL = 5000; // 5 saniye
    const ALARM_POLLING_INTERVAL = 15000; // 15 saniye
    const panelCount = Object.keys(data).length; // Tüm panellerin sayısı
    const { searchTerm } = useContext(SearchContext);
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const [nodeStatuses, setNodeStatuses] = useState<NodeStatus[]>([]);
    const [PostgresconnInfos, setPostgresConnInfos] = useState<{ [key: string]: PostgresConnInfo }>({});
    const { isLoggedIn } = useSelector((state: RootState) => state.auth);
    const tableRef = useRef<HTMLDivElement>(null);
    const allMembersCount = Array.isArray(data) ? data.reduce((total, cluster) => {
        const nodes = Object.values(cluster)[0];
        if (Array.isArray(nodes)) {
            return total + nodes.length;
        }
        return total;
    }, 0) : 0;
    const [modalVisible, setModalVisible] = useState(false);

    // activeCluster ve selectedCard için referans tutalım
    const activeClusterRef = useRef<PgNodes[]>([]);
    const selectedCardRef = useRef<string | null>(null);

    useEffect(() => {
        if (tableRef.current) {
            tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [activeCluster]); // activeCluster değiştiğinde tabloya kaydırır

    // Postgres status ve agent status için birleştirilmiş fetch
    useEffect(() => {
        const fetchPostgresAndAgentStatus = async () => {
            try {
                // Postgres status fetch
                const postgresResponse = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/postgres`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    withCredentials: true
                });

                if (postgresResponse.data && postgresResponse.data.data && Array.isArray(postgresResponse.data.data)) {
                    const dataArray = postgresResponse.data.data;
                    if (dataArray.length > 0) {
                        setData(dataArray);
                    }
                }

                // Agent status fetch
                const agentResponse = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/agents`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    withCredentials: true
                });

                const agents: AgentStatus[] = agentResponse.data.data.agents;
                const allNodes = new Set<string>();
                if (postgresResponse.data && postgresResponse.data.data && Array.isArray(postgresResponse.data.data)) {
                    const dataArray = postgresResponse.data.data;
                    dataArray.forEach((cluster: ClusterData) => {
                        const nodes = Object.values(cluster)[0];
                        nodes.forEach((node: PostgresNode) => {
                            allNodes.add(node.Hostname);
                        });
                    });
                }

                const newStatuses = Array.from(allNodes).map(nodename => {
                    const agent = agents.find(a => a.hostname === nodename);
                    const hasAgent = !!agent;
                    const isUpdated = agent ? moment(agent.last_seen).isAfter(moment().subtract(2, 'minutes')) : false;

                    return {
                        nodename,
                        isUpdated,
                        hasAgent,
                        agentStatus: agent?.status
                    };
                });

                setNodeStatuses(newStatuses);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchPostgresAndAgentStatus();
        const intervalId = setInterval(fetchPostgresAndAgentStatus, POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, []);

    // Alarm ve connection info için birleştirilmiş fetch
    useEffect(() => {
        const fetchAlarmsAndConnInfo = async () => {
            try {
                // Check alarms
                const alarmResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/checkalarmspostgres`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                });

                if (alarmResponse.ok) {
                    // Fetch connection info
                    const connResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/postgresconninfo`, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        credentials: 'include'
                    });
                    const connData = await connResponse.json();
                    
                    if (Array.isArray(connData)) {
                        const infoMap = connData.reduce((acc, curr) => {
                            acc[curr.nodename] = curr;
                            return acc;
                        }, {} as { [key: string]: PostgresConnInfo });
                        setPostgresConnInfos(infoMap);
                    }
                }
            } catch (error) {
                console.error('Error fetching alarms and connection info:', error);
            }
        };

        fetchAlarmsAndConnInfo();
        const intervalId = setInterval(fetchAlarmsAndConnInfo, ALARM_POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        // PGBouncer servisi çalışmayan node'ların sayısını hesapla
        let pgbouncerCount = 0;
        let pgServiceCount = 0;
        let esenyurtMasterCount = 0;
        let gebzeMasterCount = 0;

        data.forEach(cluster => {
            const nodes = Object.values(cluster)[0];
            nodes.forEach(node => {
                if (node.PGBouncerStatus !== 'RUNNING') {
                    pgbouncerCount++;
                }
                if (node.PGServiceStatus !== 'RUNNING') {
                    pgServiceCount++;
                }
                if (node.DC === 'Esenyurt' && node.NodeStatus === 'MASTER') {
                    esenyurtMasterCount++;
                }
                if (node.DC === 'Gebze' && node.NodeStatus === 'MASTER') {
                    gebzeMasterCount++;
                }
            });
        });
        setNonRunningPGBouncerCount(pgbouncerCount);
        setNonRunningPGServiceCount(pgServiceCount);
        setMasterEsenyurtCount(esenyurtMasterCount);
        setMasterGebzeCount(gebzeMasterCount);
    }, [data]);

    useEffect(() => {
        dispatch(setHeadStats({
            panelName: 'postgresql',
            panelCount: panelCount,
            allMembersCount: allMembersCount,
            nonRunningPGBouncerCount: nonRunningPGBouncerCount,
            nonRunningPGServiceCount: nonRunningPGServiceCount,
            masterEsenyurtCount: masterEsenyurtCount,
            masterGebzeCount: masterGebzeCount,
        }));// eslint-disable-next-line
    }, [panelCount, nonRunningPGBouncerCount, masterEsenyurtCount, nonRunningPGBouncerCount, nonRunningPGServiceCount])

    function convertToGB(value: string) {
        const [number, unit] = value.split(" ");
        switch (unit) {
            case "TB":
                return parseFloat(number) * 1000; // 1 TB = 1000 GB
            case "GB":
                return parseFloat(number);
            case "MB":
                return parseFloat(number) / 1000; // 1 GB = 1000 MB
            // ... diğer birimler için de dönüşüm katsayıları tanımlanabilir
            default:
                return parseFloat(number);
        }
    }


    const getPanelHeaderColorClass = (nodes: PostgresNode[]) => {
        // PGServiceStatus veya PGBouncerStatus kontrolü
        const hasNonRunningPGService = nodes.some((node) => node.PGServiceStatus !== 'RUNNING');
        const hasNonRunningPGBouncer = nodes.some((node) => node.PGBouncerStatus !== 'RUNNING');
        const hasNonStableNodeStatus = nodes.some((node) => node.NodeStatus === 'FAIL');

        // Eğer PGServiceStatus veya PGBouncerStatus 'RUNNING' değilse veya NodeStatus 'FAIL' ise
        if (hasNonRunningPGService || hasNonRunningPGBouncer || hasNonStableNodeStatus) {
            return {
                containerClass: 'card-container redalert',
                iconColor: 'red',
                
            };
        }

        // Free Disk yüzdesi kontrolü
        const hasLowFreeDiskPercentage = nodes.some((node) => parseFloat(node.FDPercent) < 25);

        // Free Disk değeri GB olarak kontrolü
        const hasLowFreeDiskSpace = nodes.some((node) => {
            const dataValue = convertToGB(node.FreeDisk); // convertToGB fonksiyonunu kullanarak FreeDisk'i GB'ye çeviriyoruz
            return dataValue < 250; // 250GB'tan düşükse true döner
        });

        // Eğer hem disk yüzdesi düşükse hem de toplam disk alanı düşükse
        if (hasLowFreeDiskPercentage && hasLowFreeDiskSpace) {
            return {
                containerClass: 'card-container partially',
                iconColor: 'orange',
                tooltip: 'Cluster Disk Usage: Low free disk space'
            };
        }

        // Tüm servisler 'RUNNING' durumda ise
        return {
            containerClass: 'card-container bn5',
            iconColor: '#336791',
            tooltip: null, // Tooltip gösterme
        };
    };


    const handleCardClick = (clusterNameClicked: string) => {
        handle(clusterNameClicked);
    }

    const handle = (ClusterName: string) => {
        if (selectedCardRef.current === ClusterName) {
            setActiveCluster([]);
            setSelectedCard(null);
            activeClusterRef.current = [];
            selectedCardRef.current = null;
        } else {
            const filteredArray = data.filter(item => ClusterName in item);
            if (filteredArray.length > 0) {
                const dataSource = filteredArray[0][ClusterName].map((node) => {
                    const nodeStatus = nodeStatuses.find(status => status.nodename === node.Hostname);
                    return {
                        ClusterName: ClusterName,
                        key: node.Hostname,
                        Hostname: node.Hostname,
                        NodeStatus: node.NodeStatus,
                        IP: node.IP,
                        DC: node.DC,
                        FreeDisk: node.FreeDisk,
                        FDPercent: node.FDPercent,
                        PGVersion: node.PGVersion,
                        PGBouncerStatus: node.PGBouncerStatus,
                        PGServiceStatus: node.PGServiceStatus,
                        dbAgentStatus: nodeStatus?.hasAgent ? 'RUNNING' : 'NOT_RUNNING',
                        ReplicationLagSec: node.ReplicationLagSec || '0',
                        isUpdated: nodeStatus?.isUpdated || false,
                    };
                });
                setActiveCluster(dataSource);
                setSelectedCard(ClusterName);
                activeClusterRef.current = dataSource;
                selectedCardRef.current = ClusterName;
            }
        }
    };

    const filteredDataSearch = React.useMemo(() => {
        let results = data;

        // Search term için filtreleme
        if (searchTerm) {
            results = results.filter(panelData => {
                return Object.keys(panelData).some(key => key.toLowerCase().includes(searchTerm.toLowerCase()));
            });
        }

        return results;
    }, [data, searchTerm]);

    const getClusterMetrics = (nodes: PostgresNode[]): ClusterMetrics => {
        return {
            totalNodes: nodes.length,
            activeNodes: nodes.filter(node => node.NodeStatus !== 'FAIL').length,
            masterNode: nodes.find(node => node.NodeStatus === 'MASTER')?.Hostname || '',
            avgDiskUsage: Math.round(100 - (nodes.reduce((acc, node) => acc + parseFloat(node.FDPercent), 0) / nodes.length)),
            replicationLag: Math.max(...nodes.map(node => parseFloat(node.ReplicationLagSec || '0'))),
            pgBouncerStatus: {
                running: nodes.filter(node => node.PGBouncerStatus === 'RUNNING').length,
                total: nodes.length
            },
            pgServiceStatus: {
                running: nodes.filter(node => node.PGServiceStatus === 'RUNNING').length,
                total: nodes.length
            },
            pgBouncerDetails: nodes.map(node => ({
                nodeName: node.Hostname,
                status: node.PGBouncerStatus
            })),
            pgServiceDetails: nodes.map(node => ({
                nodeName: node.Hostname,
                status: node.PGServiceStatus
            }))
        };
    };

    return (
        <>
            <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                        <img src={runningGif} alt="Loading" style={{ width: '50px', height: '50px' }} />
                    </div>
                ) : (
                    <>
                        {data.length === 0 ? (
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                height: '300px',
                                background: '#f0f2f5',
                                borderRadius: '8px',
                                padding: '20px',
                                textAlign: 'center'
                            }}>
                                <IconPostgres size="60" color="#336791" />
                                <h2 style={{ marginTop: '20px' }}>No PostgreSQL Clusters Found</h2>
                                <p>You haven't added any PostgreSQL clusters yet.</p>
                                {isLoggedIn && (
                                    <Button 
                                        type="primary" 
                                        icon={<PlusOutlined />} 
                                        style={{ marginTop: '15px' }}
                                        onClick={() => setModalVisible(true)}
                                    >
                                        Add Cluster
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="stats-container">
                                <div className="panels-wrapper">
                                    {filteredDataSearch
                                        .sort((a, b) => {
                                            const aKey = Object.keys(a)[0];
                                            const bKey = Object.keys(b)[0];
                                            return aKey.substring(3).localeCompare(bKey.substring(3));
                                        })
                                        .map((cluster, index) => {
                                            const clusterName = Object.keys(cluster)[0];
                                            const nodes: PostgresNode[] = cluster[clusterName];
                                            const panelColorClass = getPanelHeaderColorClass(nodes);
                                            const metrics = getClusterMetrics(nodes);

                                            // Node'ların agent durumunu kontrol et
                                            const isNodeUpdated = nodes.every(node => {
                                                const nodeStatus = nodeStatuses.find(status => status.nodename === node.Hostname);
                                                return nodeStatus?.isUpdated ?? false;
                                            });

                                            const hasAllAgents = nodes.every(node => {
                                                const nodeStatus = nodeStatuses.find(status => status.nodename === node.Hostname);
                                                return nodeStatus?.hasAgent ?? false;
                                            });

                                            return (
                                                <Tooltip
                                                    title={panelColorClass.tooltip}
                                                    placement="top"
                                                    color="red"
                                                    key={`tooltip${index}`}
                                                >
                                                    <div
                                                        key={`div1${index}`}
                                                        className={`${panelColorClass.containerClass} ${selectedCard === clusterName ? 'bn6' : ''}`}
                                                        style={{ margin: 4, cursor: 'pointer' }}
                                                    >
                                                        <Badge
                                                            key={`badge${index}`}
                                                            status={isNodeUpdated && hasAllAgents ? 'processing' : 'error'}
                                                            color={isNodeUpdated && hasAllAgents ? 'green' : 'red'}
                                                            dot
                                                            offset={[-2, 2]}
                                                        >
                                                            <CustomCard
                                                                iconColor={panelColorClass.iconColor}
                                                                clusterName={clusterName}
                                                                metrics={metrics}
                                                                key={`card1${index}`}
                                                                onClick={() => handleCardClick(clusterName)}
                                                            />
                                                        </Badge>
                                                    </div>
                                                </Tooltip>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Space>

            {activeCluster.length > 0 && (
                <div ref={tableRef}>
                    <div style={{ marginTop: 16 }}>
                        <ClusterTopology 
                            nodes={activeCluster}
                            key={`topology-${selectedCard}-${activeCluster.length}`} 
                        />
                    </div>
                </div>
            )}

            <AddClusterModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)} 
                initialTab="postgresql"
            />
        </>
    );
};

export default Postgres;
