import React, { useState, useEffect, useContext, useRef } from 'react';
import './index.css';
import { Space, Table, Tag, Badge, Tooltip, Button, DatePicker } from 'antd';
import IconPostgres from './icons/postgresql'
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { setHeadStats } from '../redux/redux';
import SearchContext from './searchContext';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, BellTwoTone, PlusOutlined } from '@ant-design/icons';
import CustomCard from './customCard';
import runningGif from './assets/Running.gif';
import moment, { Moment } from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { RootState } from './store';
import AddClusterModal from './components/AddClusterModal';




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
}

interface PostgresConnInfo {
    nodename: string;
    send_diskalert: boolean;
    silence_until: {
        Time: string;
        Valid: boolean;
    } | null;
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
    const POLLING_INTERVAL = 5000;
    const panelCount = Object.keys(data).length; // Tüm panellerin sayısı
    const { searchTerm } = useContext(SearchContext);
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const [nodeStatuses, setNodeStatuses] = useState<NodeStatus[]>([]);
    const [PostgresconnInfos, setPostgresConnInfos] = useState<{ [key: string]: PostgresConnInfo }>({});
    const [selectedTime, setSelectedTime] = useState<Moment | null>(null);
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

    // Keycloak kodu yerine Redux state'ini kullanıyoruz
    // const keys = useKeycloak()?.keycloak;
    // useEffect(() => {
    //     setIsLoggedIn(keys?.authenticated || false)
    // }, [keys?.authenticated]);

    useEffect(() => {
        if (tableRef.current) {
            tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [activeCluster]); // activeCluster değiştiğinde tabloya kaydırır

    useEffect(() => {
        const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/statuspostgres`;
        const fetchData = () => {
            try {
                axios({
                    method: 'get',
                    url: apiUrl,
                }).then(function (response) {
                    const responseData = response?.data;
                    if (Array.isArray(responseData)) {
                        setData(responseData);
                    } else {
                        setData([]);
                        console.warn('API response is not an array:', responseData);
                    }
                    setLoading(false);
                }).catch(error => {
                    console.error('Error fetching data:', error);
                    setData([]);
                    setLoading(false);
                });
            } catch (error) {
                console.error('Error in fetch operation:', error);
                setData([]);
                setLoading(false);
            }
        }

        fetchData(); // initial fetch
        const intervalId = setInterval(fetchData, POLLING_INTERVAL); // subsequent fetches

        return () => clearInterval(intervalId); // cleanup
    }, []);

    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/checkalarmspostgres`, {
                    method: 'POST',
                });
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                fetchConnInfos(); // Alarm durumu değiştiğinde tekrar fetch yaparak güncelleyebiliriz
            } catch (error) {
                console.error('Failed to check alarms:', error);
            }
        }, 5000); // Her 60 saniyede bir kontrol eder

        return () => clearInterval(intervalId); // Temizleme işlevi
    }, []);

    const fetchConnInfos = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/postgresconninfo`);
            const data = await response.json();
            
            // Veri kontrolü ekleyelim
            if (Array.isArray(data)) {
                const infoMap = data.reduce((acc, curr) => {
                    acc[curr.nodename] = curr;
                    return acc;
                }, {} as { [key: string]: PostgresConnInfo });
                setPostgresConnInfos(infoMap);
            } else {
                console.warn('Connection info response is not an array:', data);
                setPostgresConnInfos({});
            }
        } catch (error) {
            console.error('Failed to fetch connection info:', error);
            setPostgresConnInfos({}); // Hata durumunda boş obje
        }
    };

    useEffect(() => {
        fetchConnInfos();
    }, []);

    const getFullNodeName = (nodeName: string): string => {
        if (nodeName.includes(".osp-") && !nodeName.includes(".hepsi.io")) {
            return `${nodeName}.hepsi.io`;
        } else if ((nodeName.includes("dpay") || nodeName.includes("altpay")) && !nodeName.includes(".dpay.int")) {
            return `${nodeName}.dpay.int`;
        }
        return `${nodeName}`;
    };

    const handleSilentAlarm = async (nodeName: string): Promise<void> => {
        const fullNodeName = getFullNodeName(nodeName);
        const silentAlarmAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/silentalarmpostgres`;

        try {
            const response = await fetch(silentAlarmAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hostname: fullNodeName,
                    silent: !PostgresconnInfos[fullNodeName]?.send_diskalert,
                    silence_until: selectedTime ? selectedTime.toISOString() : null,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Başarılı:', data);


                setPostgresConnInfos((prev) => ({
                    ...prev,
                    [fullNodeName]: {
                        ...prev[fullNodeName],
                        send_diskalarm: !prev[fullNodeName].send_diskalert,
                        silence_until: selectedTime ? { Time: selectedTime.toISOString(), Valid: true } : null,
                    },
                }));
            } else {
                console.error('Hata:', response.statusText);
            }
        } catch (error) {
            console.error('Bir hata oluştu:', error);
        }
    };

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/agentstatus`);
                const nodeData = response.data; // {"mongo-dba-test-01":"00:08:37", "mongo-dba-test-02":"00:08:37", ...}

                const newStatuses = Object.keys(nodeData).map(nodename => {
                    const nodeTime = moment(nodeData[nodename], "YYYY-MM-DDTHH:mm:ss");
                    const isUpdatedRecently = nodeTime.isAfter(moment().subtract(2, 'minutes'));

                    return { nodename, isUpdated: isUpdatedRecently };
                });

                setNodeStatuses(newStatuses);
            } catch (error) {
                console.error('Error fetching data: ', error);
            }
        };

        fetchData();
        const intervalId = setInterval(fetchData, POLLING_INTERVAL);

        return () => clearInterval(intervalId);
    }, []);

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
                tooltip: 'Warning: PG Service, PGBouncer or Node Status is not running!',
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
                tooltip: 'Warning: Low disk space detected!',
            };
        }

        // Tüm servisler 'RUNNING' durumda ise
        return {
            containerClass: 'card-container bn5',
            iconColor: '#336791',
            tooltip: null, // Tooltip gösterme
        };
    };


    const columns: ColumnsType<PgNodes> = [{
        title: 'Hostname',
        dataIndex: 'Hostname',
        key: 'Hostname',
        fixed: 'left', // Sütunu sola sabitler
        ellipsis: true,
        render: (Hostname: string, record: any) => {
            const isNodeUpdated = record.isUpdated;

            return (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>{Hostname}</span>
                    <Tooltip title={isNodeUpdated ? "Agent is Running" : "Agent is Not Running"}>
                        {isNodeUpdated ? (
                            <img
                                src={runningGif}
                                alt="Running"
                                style={{ width: 16, height: 16, marginLeft: 8, cursor: 'pointer' }}
                            />
                        ) : (
                            <CloseCircleOutlined
                                style={{ color: 'red', marginLeft: 8, cursor: 'pointer' }}
                            />
                        )}
                    </Tooltip>
                </div>
            );
        },
    },
    {
        title: 'Node Status',
        dataIndex: 'NodeStatus',
        key: 'NodeStatus',
        render: (text: string) => {
            let color;
            if (text === 'MASTER' || text === 'SLAVE') {
                color = 'green';
            } else {
                color = 'volcano';
            }

            return (
                <Tag color={color}>
                    {text}
                </Tag>
            );
        },
    },

    {
        title: 'IP',
        dataIndex: 'IP',
        key: 'IP',
    },
    {
        title: 'Data Center',
        dataIndex: 'DC',
        key: 'DC',
        render: (text: string) => {
            let color;
            if (text === 'Esenyurt') {
                color = 'blue';
            } else if (text === 'Gebze') {
                color = 'yellow';
            } else {
                color = 'volcano';
            }

            return (
                <Tag color={color}>
                    {text}
                </Tag>
            );
        },
    },
    {
        title: 'Free Disk',
        dataIndex: 'FreeDisk',
        key: 'FreeDisk',
    },
    {
        title: 'Free Disk Percentage',
        dataIndex: 'FDPercent',
        key: 'FDPercent',
        render: (freediskpercent: number, record: PostgresNode) => {
            let color = 'green';
            let icon = <CheckCircleOutlined style={{ color: 'green', marginRight: 4 }} />;

            if (freediskpercent < 25) {
                color = 'volcano';
                icon = <WarningOutlined style={{ color: 'orange', marginRight: 4 }} />;
            }

            const fullNodeName = getFullNodeName(record.Hostname);

            // silence_until alanını moment nesnesine dönüştür
            const silenceUntilRaw = PostgresconnInfos[fullNodeName]?.silence_until;
            const initialDate = silenceUntilRaw && silenceUntilRaw.Valid
                ? moment.utc(silenceUntilRaw.Time) // UTC'den yerel zamana dönüştür
                : null;// moment ile dönüştürülmüş hali

            let tooltipMessage = "Alarm On"; // Varsayılan

            // Eğer alarm kapalıysa (send_diskalarm false)
            if (!PostgresconnInfos[fullNodeName]?.send_diskalert) {
                // Eğer tarih geçerliyse
                if (initialDate && initialDate.isValid()) {
                    tooltipMessage = `Alarm Off Until ${initialDate.format("DD.MM.YYYY HH:mm")}`;
                } else {
                    tooltipMessage = "Alarm Off";
                }
            }

            return (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Tag color={color} style={{ marginRight: 8 }}>
                        {icon}
                        {`${freediskpercent}%`}
                    </Tag>
                    {isLoggedIn && (
                        <>
                            <Tooltip title={tooltipMessage}>
                                <Button
                                    type="link"
                                    icon={
                                        PostgresconnInfos[fullNodeName]?.send_diskalert ? (
                                            <BellTwoTone twoToneColor="#52c41a" />
                                        ) : (
                                            <BellTwoTone twoToneColor="#ff0000" />
                                        )
                                    }
                                    onClick={() => {
                                        setSelectedTime(null); // Reset the selectedTime state
                                        handleSilentAlarm(record.Hostname);
                                    }}
                                />
                            </Tooltip>
                            <DatePicker
                                showTime
                                format="YYYY-MM-DD HH:mm:ss"
                                placeholder="Alarm Off Until.."
                                onChange={(value) => setSelectedTime(value ? moment(value.toISOString()) : null)}
                            />
                        </>
                    )}
                </div>
            );
        },
    },

    {
        title: 'PostgreSQL Version',
        dataIndex: 'PGVersion',
        key: 'PGVersion',
    },
    {
        title: 'PGBouncer Status',
        dataIndex: 'PGBouncerStatus',
        key: 'PGBouncerStatus',
        render: (text: string) => {
            let color;
            let backgroundColor;
            if (text === 'RUNNING') {
                color = 'green';
                backgroundColor = '#52c41a'; // Yeşil renk
            } else if (text === 'FAIL!') {
                color = 'volcano';
                backgroundColor = '#ff4d4f'; // Kırmızı renk
            }
            return (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: backgroundColor, marginRight: '8px' }}></div>
                    <Tag color={color}>{text}</Tag>
                </div>
            );
        },

    },
    {
        title: 'PG Service Status',
        dataIndex: 'PGServiceStatus',
        key: 'PGServiceStatus',
        render: (text: string) => {
            let color;
            let backgroundColor;
            if (text === 'RUNNING') {
                color = 'green';
                backgroundColor = '#52c41a'; // Yeşil renk
            } else if (text === 'FAIL!') {
                color = 'volcano';
                backgroundColor = '#ff4d4f'; // Kırmızı renk
            }
            return (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: backgroundColor, marginRight: '8px' }}></div>
                    <Tag color={color}>{text}</Tag>
                </div>
            );
        },
    },
    {
        title: 'Replication Lag (Seconds)',
        dataIndex: 'ReplicationLagSec',
        key: 'ReplicationLagSec',
    },
    ];

    const handleCardClick = (clusterNameClicked: string) => {
        if (selectedCard === clusterNameClicked) {
            setSelectedCard(''); // Eğer aynı karta tıklanırsa efekti kaldır
        } else {
            setSelectedCard(clusterNameClicked); // Farklı bir karta tıklanırsa o kartın ismini sakla
        }
        handle(clusterNameClicked);
    }

    const handle = (ClusterName: string) => {
        const filteredArray = data.filter(item => ClusterName in item);

        const aa = activeCluster?.[0] && activeCluster?.[0].ClusterName
        if (aa === ClusterName) {
            setActiveCluster([])
        }
        else {
            const dataSource = filteredArray[0][ClusterName].map((node) => {
                // `isUpdated` değerini almak için, `nodeStatuses` gibi bir yapıdan nodename eşlemesi yapıyoruz
                const isUpdated = nodeStatuses.find(status => status.nodename === node.Hostname)?.isUpdated || false;

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
                    dbAgentStatus: node.dbAgentStatus,
                    ReplicationLagSec: node.ReplicationLagSec,
                    isUpdated: isUpdated, // `isUpdated` alanını ekliyoruz
                };
            });
            setActiveCluster(dataSource)
        }
    }

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

                                            // Eğer nodes içindeki herhangi bir Hostname son 2 dakika içinde güncellenmemişse, isNodeUpdated false olacak
                                            const isNodeUpdated = nodes.every(node =>
                                                nodeStatuses.find(status => status.nodename === node.Hostname)?.isUpdated ?? false
                                            );

                                            return (
                                                <Tooltip
                                                    title={panelColorClass.tooltip} // Tooltip mesajını burada kullanıyoruz
                                                    placement="top"
                                                    color="red"
                                                    key={`tooltip${index}`}
                                                >
                                                    <div
                                                        key={`div1${index}`}
                                                        className={`${panelColorClass.containerClass} ${selectedCard === clusterName ? 'bn6' : ''
                                                            }`}
                                                        style={{ margin: 4, cursor: 'pointer' }}
                                                    >
                                                        <Badge
                                                            key={`badge${index}`}
                                                            status={isNodeUpdated ? 'processing' : 'error'}
                                                            color={isNodeUpdated ? 'green' : 'red'}
                                                            dot
                                                            offset={[-2, 2]}
                                                        >
                                                            <CustomCard
                                                                iconColor={panelColorClass.iconColor}
                                                                clusterName={clusterName}
                                                                key={`card1${index}`}
                                                                onClick={() => handleCardClick(clusterName)}
                                                            >
                                                                <div
                                                                    key={`div2${index}`}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                    }}
                                                                >
                                                                    <IconPostgres
                                                                        key={`icon1${index}`}
                                                                        size="25"
                                                                        color={panelColorClass.iconColor}
                                                                    />
                                                                    <span
                                                                        key={`span1${index}`}
                                                                        style={{
                                                                            marginLeft: 8,
                                                                            whiteSpace: 'nowrap',
                                                                            overflow: 'hidden',
                                                                            fontSize: '12px',
                                                                            textOverflow: 'ellipsis',
                                                                            maxWidth: 'calc(100% - 25px - 8px)',
                                                                        }}
                                                                    >
                                                                        {clusterName}
                                                                    </span>
                                                                </div>
                                                            </CustomCard>
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
                    <Badge.Ribbon
                        color="#336790ff"
                        text={<span style={{ fontWeight: 'bold' }}>{selectedCard}</span>}
                        placement="end"
                        style={{ zIndex: 1000 }}
                    />
                    <Table
                        className="textclr"
                        style={{ marginTop: 10 }}
                        columns={columns}
                        dataSource={activeCluster}
                        pagination={false}
                        scroll={{ x: 'max-content' }} // Yatay kaydırma
                        title={() => <div style={{ display: 'flex', alignItems: 'left' }} />}
                    />
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
