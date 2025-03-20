import React, { useState, useEffect } from 'react';
import { Space, Card, Table, Tag, Spin, Button } from 'antd';
import './index.css';
import IconCassandra from './icons/cassandra';
import { useDispatch } from 'react-redux';
import { setHeadStats } from '../redux/redux';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { PlusOutlined } from '@ant-design/icons';

interface Node {
    Datacenter: string;
    Status: string;
    Address: string;
    Load: string;
    Tokens: string;
    Owns: string;
    HostID: string;
    Rack: string;
}

type DataMap = {
    [key: string]: Node[];
};
type ClusterData = {
    [key: string]: Node[];
}

const Cassandra: React.FC = () => {
    const dispatch = useDispatch();
    const [data, setData] = useState<DataMap | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedHost, setSelectedHost] = useState<string | null>(null);
    const [panelCount, setPanelCount] = useState<number>(0);
    const [totalNodeCount, setTotalNodeCount] = useState<number>(0);
    const POLLING_INTERVAL = 5000;
    const { isLoggedIn } = useSelector((state: RootState) => state.auth);

    const transformData = (originalData: ClusterData[]): DataMap => {
        const transformedData: DataMap = {};

        originalData.forEach(item => {
            const key = Object.keys(item)[0];
            transformedData[key] = item[key];
        });

        return transformedData;
    };


    useEffect(() => {
        const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/cassandra_stats`;

        const fetchData = async () => {
            try {
                const response = await axios.get(apiUrl);
                
                // Veri kontrolü ekleyelim
                if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                    const transformedData = transformData(response.data);
                    setData(transformedData);
                    
                    setPanelCount(Object.keys(transformedData).length);

                    let totalCount = 0;
                    for (const clusterNodes of Object.values(transformedData)) {
                        totalCount += clusterNodes.length;
                    }
                    setTotalNodeCount(totalCount);
                } else {
                    console.warn('API response is not valid:', response.data);
                    setData({}); // Boş obje ayarla
                }
            } catch (error) {
                console.error("Data fetch error:", error);
                setData({}); // Hata durumunda boş obje
            } finally {
                setLoading(false);
            }
        }

        fetchData(); // initial fetch
        const intervalId = setInterval(fetchData, POLLING_INTERVAL); // subsequent fetches

        return () => clearInterval(intervalId); // cleanup
    }, []);


    useEffect(() => {
        dispatch(setHeadStats({
            panelName: 'cassandra',
            panelCount: panelCount,
            totalCount: totalNodeCount
        }));// eslint-disable-next-line
    }, [panelCount])


    const handleCardClick = (clusterName: string) => {
        // Eğer zaten seçili host'a tekrar tıklanırsa, seçili host'u kaldırarak tabloyu gizle
        if (selectedHost === clusterName) {
            setSelectedHost(null);
        } else {
            setSelectedHost(clusterName);
        }
    };

    const columns = [
        {
            title: 'Datacenter',
            dataIndex: 'Datacenter',
            key: 'Datacenter',
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'Status',
            render: (text: string) => {
                let color;
                if (text === 'UN') { // Up and normal
                    color = 'green';
                } else {
                    color = 'volcano';
                }
                return <Tag color={color}>{text}</Tag>;
            },
        },
        {
            title: 'Address',
            dataIndex: 'Address',
            key: 'Address',
        },
        {
            title: 'Load',
            dataIndex: 'Load',
            key: 'Load',
            render: (Load: string) => {
                let color;
                
                // "GiB" kısmını kaldırıp sayıya dönüştürüyoruz
                const numericValue = parseFloat(Load.split(' ')[0]);
                
                let content = `${Load}`;
            
                if (numericValue > 200) {
                    color = 'red';
                    content += ' Warning!'; // Değerin yanına "Warning" kelimesini ekliyoruz
                } else {
                    color = 'green';
                }
            
                return (
                    <Tag color={color}>
                        {content}
                    </Tag>
                );
            },
        },
        {
            title: 'Tokens',
            dataIndex: 'Tokens',
            key: 'Tokens',
        },
        {
            title: 'Owns',
            dataIndex: 'Owns',
            key: 'Owns',
        },
        {
            title: 'Rack',
            dataIndex: 'Rack',
            key: 'Rack',
        },
        // Diğer kolonlarınızı da buraya ekleyebilirsiniz...
    ];

    const getPanelHeaderColorClass = (nodes: Node[]) => {
        const hasDownNode = nodes.some(node => node.Status.startsWith("D"));  // 'Down' durumunu kontrol ediyor

        // Eğer bir node 'Down' durumunda ise, kırmızı alarm rengi döndür
        if (hasDownNode) {
            return {
                containerClass: 'card-container redalert',
                iconColor: 'red'
            };
        }

        // Burada load değerini kontrol ediyoruz.
        const hasHighLoad = nodes.some(node => {
            const loadValue = parseFloat(node.Load.split(" ")[0]);
            return loadValue > 200; 
        });

        if (hasHighLoad) {
            return {
                containerClass: 'card-container partially',
                iconColor: 'orange'
            };
        }

        // Her şey yolunda ise, varsayılan renk döndür
        return {
            containerClass: 'card-container bn5',
            iconColor: '#336791'
        };
    };

    return (
        <>
            <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <>
                        {data && Object.keys(data).length === 0 ? (
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
                                <IconCassandra />
                                <h2 style={{ marginTop: '20px' }}>No Cassandra Clusters Found</h2>
                                <p>You haven't added any Cassandra clusters yet.</p>
                                {isLoggedIn && (
                                    <Button 
                                        type="primary" 
                                        icon={<PlusOutlined />} 
                                        style={{ marginTop: '15px' }}
                                        onClick={() => {/* Cluster ekleme fonksiyonu */}}
                                    >
                                        Add Cassandra Cluster
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="stats-container">
                                <div className="panels-wrapper">
                                    {data && Object.entries(data).map(([clusterName, nodes], index) => {
                                        const panelColorClass = getPanelHeaderColorClass(nodes);

                                        return (
                                            <div
                                                key={`div${index}`}
                                                className={panelColorClass.containerClass}
                                                style={{ margin: 4, cursor: 'pointer' }}
                                                onClick={() => handleCardClick(clusterName)}
                                            >
                                                <Card
                                                    key={`card${index}`}
                                                    bodyStyle={{ padding: 5, width: 210 }}
                                                >
                                                    <div
                                                        key={`content${index}`}
                                                        style={{ display: 'flex', alignItems: 'center' }}
                                                    >
                                                        {/* Bu kısımda simgeyi ekledik */}
                                                        <svg width="60" height="60" viewBox="0 0 24 24">
                                                            <path fill="#1B9CC4" d="...cassandra icon path..." />
                                                        </svg>
                                                        <span
                                                            key={`span${index}`}
                                                            style={{
                                                                marginLeft: 8,
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                fontSize: '12px',
                                                                textOverflow: 'ellipsis',
                                                                maxWidth: 'calc(100% - 25px - 8px)'
                                                            }}
                                                        >
                                                            {clusterName}
                                                        </span>
                                                    </div>
                                                </Card>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Space>

            {selectedHost &&
                <Table className='textclr'
                    style={{ marginTop: 10 }}
                    columns={columns}
                    dataSource={data![selectedHost]}
                    pagination={false}
                    rowKey="Address"
                />
            }
        </>
    );
}

export default Cassandra;
