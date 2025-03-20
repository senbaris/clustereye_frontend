import React, { useState, useEffect } from 'react';
import { Table, Spin, Badge, Space, Tooltip, Button } from 'antd';
import axios from 'axios';
import CustomCardMssql from './customCardMssql';
import IconMssql from './icons/sql_server';
import { PlusOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { RootState } from './store';


// Drive veri tipi
interface DriveData {
    drive_letter: string;
    drive_name: string;   // Yeni alan: Drive Name
    free_space_gb: number;
    total_space_gb: number; // Total Space için yeni alan
    free_percentage: number; // Free Space yüzdesi
}

// Node veri tipi
interface NodeData {
    listener_name: string;
    node_name: string;
    node_status: string;
    ag_status: string;                // AG durumu
    synchronization_health: string;   // Senkronizasyon durumu
    version: string;                  // SQL Server versiyonu
    updated_at: string;
    drives: DriveData[];
}

// Listener bazında node'ları gruplamak için kullanılan veri tipi
interface GroupedData {
    [listener_name: string]: NodeData[];
}

const AlwaysOnDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<GroupedData>({});
    const [selectedListener, setSelectedListener] = useState<string | null>(null);
    const [activeNodes, setActiveNodes] = useState<NodeData[]>([]);
    const { isLoggedIn } = useSelector((state: RootState) => state.auth);

    // Veriyi backend'den çekiyoruz ve drive'ları grupluyoruz
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/getNodesMssql`); // Backend API'yi çağırıyoruz
                const rawData: any[] = response.data;

                // Drive'ları node'lara göre gruplama
                const nodeMap: { [key: string]: NodeData } = {};
                rawData.forEach((item) => {
                    const { listener_name, node_name, node_status, ag_status, synchronization_health, version, drive_letter, drive_name, free_space_gb, total_space_gb, free_percentage, updated_at } = item;

                    if (!nodeMap[node_name]) {
                        nodeMap[node_name] = {
                            listener_name,
                            node_name,
                            node_status,
                            ag_status,                // AG durumu
                            synchronization_health,   // Senkronizasyon durumu
                            version,                  // SQL Server versiyonu
                            updated_at,
                            drives: [],
                        };
                    }

                    // Disk bilgilerini 'drives' alanına ekleyelim
                    nodeMap[node_name].drives.push({ drive_letter, drive_name, free_space_gb, total_space_gb, free_percentage });
                });

                // listener_name'e göre node'ları gruplama
                const grouped: GroupedData = {};
                Object.values(nodeMap).forEach((node) => {
                    const { listener_name } = node;
                    if (!grouped[listener_name]) {
                        grouped[listener_name] = [];
                    }
                    grouped[listener_name].push(node);
                });

                setGroupedData(grouped);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData(); // İlk veri çekimi

        const interval = setInterval(() => {
            fetchData(); // Düzenli veri çekimi
        }, 5000); // Her 5 saniyede bir veri güncelle

        return () => clearInterval(interval); // Temizleme işlemi
    }, []);

    const getPanelHeaderColorClass = (nodes: NodeData[]) => {
        //const hasPrimaryNode = nodes.some((node) => node.node_status === 'PRIMARY');
        const hasDisconnectedAGStatus = nodes.some((node) => node.ag_status !== 'CONNECTED');
        const hasUnhealthySync = nodes.some((node) => node.synchronization_health !== 'HEALTHY');
        const hasLowFreeDiskSpace = nodes.some((node) =>
            node.drives.some((drive) => drive.free_percentage < 25)
        );

        // Kırmızı için koşullar ve açıklama
        if (hasDisconnectedAGStatus || hasUnhealthySync) {
            return {
                containerClass: 'card-container redalert',
                iconColor: 'red',
                infoMessage: 'AG durumu bağlantılı değil veya senkronizasyon sağlığı yeterli değil.',
            };
        }

        // Turuncu için koşul ve açıklama
        if (hasLowFreeDiskSpace) {
            return {
                containerClass: 'card-container partially',
                iconColor: 'orange',
                infoMessage: 'Disklerde %25\'den az boş alan kaldı.',
            };
        }

        // Mavi için
        return {
            containerClass: 'card-container bn5',
            iconColor: '#336791',
            infoMessage: '',
        };
    };


    // ListenerName'e göre node'ları filtrele ve tabloya aktar
    const handleCardClick = (listener_name: string) => {
        if (selectedListener === listener_name) {
            setSelectedListener(null);
            setActiveNodes([]);
        } else {
            setSelectedListener(listener_name);
            const filteredNodes = groupedData[listener_name] || [];
            setActiveNodes(filteredNodes);
        }
    };

    // Ant Design Tablosu için sütunlar
    const columns = [
        {
            title: 'Node Name',
            dataIndex: 'node_name',
            key: 'node_name',
        },
        {
            title: 'Node Status',
            dataIndex: 'node_status',
            key: 'node_status',
            sorter: (a: NodeData, b: NodeData) => a.node_status.localeCompare(b.node_status), // Sıralama fonksiyonu
            defaultSortOrder: 'ascend' as const, // Varsayılan olarak ascending sıralama
            render: (status: string) => (
                <Badge status={status === 'PRIMARY' ? 'success' : 'warning'} text={status} />
            ),
        },
        {
            title: 'AG Status',
            dataIndex: 'ag_status',
            key: 'ag_status',
            render: (status: string) => (
                <Badge status={status === 'CONNECTED' ? 'success' : 'error'} text={status} />
            ),
        },
        {
            title: 'Synchronization Health',
            dataIndex: 'synchronization_health',
            key: 'synchronization_health',
            render: (health: string) => (
                <Badge status={health === 'HEALTHY' ? 'success' : 'warning'} text={health} />
            ),
        },
        {
            title: 'SQL Version',
            dataIndex: 'version',
            key: 'version',
        },
    ];

    // Disk verilerini göstermek için expandable satırlar
    const expandable = {
        expandedRowRender: (record: NodeData) => (
            <Table
                columns={[
                    { title: 'Drive Letter', dataIndex: 'drive_letter', key: 'drive_letter' },
                    { title: 'Drive Name', dataIndex: 'drive_name', key: 'drive_name' }, // Yeni kolon: Drive Name
                    { title: 'Total Space (GB)', dataIndex: 'total_space_gb', key: 'total_space_gb' },
                    { title: 'Free Space (GB)', dataIndex: 'free_space_gb', key: 'free_space_gb' },
                    {
                        title: 'Free Space (%)',
                        dataIndex: 'free_percentage',
                        key: 'free_percentage',
                        render: (percentage: number | undefined) =>
                            percentage !== undefined ? `${percentage.toFixed(2)}%` : 'N/A',
                    }
                ]}
                dataSource={record.drives}
                pagination={false}
                rowKey="drive_letter"
                rowClassName={(drive: DriveData) => {
                    const percentage = drive.free_percentage;
                    if (percentage === undefined) return '';

                    if (percentage > 50) {
                        return 'green-disk-space';  // %50'den büyükse yeşil
                    } else if (percentage > 25 && percentage <= 50) {
                        return 'yellow-disk-space';  // %50 ile %25 arasında ise sarı
                    } else if (percentage <= 25) {
                        return 'red-disk-space';  // %25'ten küçükse kırmızı/portakal
                    }

                    return '';
                }}
            />
        ),
        rowExpandable: (record: NodeData) => record.drives.length > 0,
    };

    // listener_name'leri bir dizi olarak alıyoruz
    const listenerNames = Object.keys(groupedData).sort();

    return (
        <>
            <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <>
                        {Object.keys(groupedData).length === 0 ? (
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
                                <IconMssql size="60" color="#CC2927" />
                                <h2 style={{ marginTop: '20px' }}>No SQL Server Clusters Found</h2>
                                <p>You haven't added any SQL Server clusters yet.</p>
                                {isLoggedIn && (
                                    <Button 
                                        type="primary" 
                                        icon={<PlusOutlined />} 
                                        style={{ marginTop: '15px' }}
                                        onClick={() => {/* Cluster ekleme fonksiyonu */}}
                                    >
                                        Add SQL Server Cluster
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="stats-container">
                                <div className="panels-wrapper">
                                    <Space wrap>
                                        {listenerNames.map((listener_name, index) => {
                                            const panelColorClass = getPanelHeaderColorClass(
                                                groupedData[listener_name]
                                            );

                                            return (
                                                <Tooltip title={panelColorClass.infoMessage} placement="top">
                                                    <div
                                                        key={`div1${index}`}
                                                        className={`${panelColorClass.containerClass} ${selectedListener === listener_name ? 'bn6' : ''}`}
                                                        style={{ margin: 4, cursor: 'pointer' }}
                                                        onClick={() => handleCardClick(listener_name)}
                                                    >
                                                        <CustomCardMssql
                                                            key={`card1${index}`}
                                                            iconColor={panelColorClass.iconColor}
                                                            clusterName={listener_name}
                                                            onClick={() => handleCardClick(listener_name)}
                                                        >
                                                            <div
                                                                key={`div2${index}`}
                                                                style={{ display: 'flex', alignItems: 'center' }}
                                                            >
                                                                <IconMssql
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
                                                                    {listener_name}
                                                                </span>
                                                            </div>
                                                        </CustomCardMssql>
                                                    </div>
                                                </Tooltip>
                                            );
                                        })}
                                    </Space>
                                </div>

                                {selectedListener && (
                                    <div style={{ marginTop: 20 }}>
                                        <Badge.Ribbon color='#336790' text={<span style={{ fontWeight: 'bold' }}>{selectedListener} Node Details</span>} placement="end" style={{ zIndex: 1000, top: '-15px' }}>
                                        </Badge.Ribbon>
                                        <Table
                                            columns={columns}
                                            dataSource={activeNodes}
                                            expandable={expandable}
                                            rowKey="node_name"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </Space>
        </>
    );
};

export default AlwaysOnDashboard;
