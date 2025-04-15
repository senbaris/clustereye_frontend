import React, { useState, ReactNode } from 'react';
import { Card, Tooltip, Modal, Input, Checkbox, List, Button, message, Spin, Radio, Row, Col, Progress, Space, Statistic } from 'antd';
import { DeleteOutlined, BarChartOutlined, PlusOutlined, CrownOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import IconMongo from './icons/mongo';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from './store';

// Node tipini genişletiyoruz
type NodeType = {
    nodename: string;
    status: string;
    dc?: string;
    ip?: string;
    version?: string;
    totalDisksize?: string;
    freediskdata?: string;
    freediskpercent?: string;
    // Yeni API alanları
    Hostname?: string;
    NodeStatus?: string;
    Location?: string;
    IP?: string;
    MongoVersion?: string;
    FreeDisk?: string;
    FDPercent?: number;
    ReplicaSetName?: string;
    MongoStatus?: string;
    ClusterName?: string;
    ReplicationLagSec?: number;
    TotalDisk?: string;
};

type CustomCardProps = {
    clusterName: string;
    iconColor?: string; // panelColorClass.iconColor direkt olarak geçirilebilir
    onClick: () => void;
    children?: ReactNode;
    nodes: Array<NodeType>;
};

// Hostname'i kısaltmak için yardımcı fonksiyon
const truncateHostname = (hostname: string, length: number = 20): string => {
    return hostname.length > length ? hostname.substring(0, length) + '...' : hostname;
};

const CustomCard: React.FC<CustomCardProps> = ({ clusterName, iconColor, nodes, onClick}) => {
    // Debug: Nodes array'ini ve MongoStatus değerlerini kontrol et
    console.log(`CustomCardMongo for ${clusterName} received nodes:`, nodes);
    nodes.forEach(node => {
        console.log(`Node ${node.nodename || node.Hostname} in CustomCardMongo - MongoStatus:`, node.MongoStatus);
    });

    const [newNodeName, setNewNodeName] = useState('');
    const [newNodePort, setNewNodePort] = useState('27127');
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedSecondaryNode, setSelectedSecondaryNode] = useState<string | null>(null);
    const [isSetPrimaryModalVisible, setIsSetPrimaryModalVisible] = useState(false);
	const { isLoggedIn } = useSelector((state: RootState) => state.auth);

    // Cluster metrikleri hesapla
    const calculateClusterMetrics = () => {
        // Toplam düğüm sayısı
        const totalNodes = nodes.length;
        
        console.log(`Calculating metrics for ${clusterName} with ${totalNodes} nodes`);
        
        // Primary düğümü bul
        const primaryNode = nodes.find(node => 
            node.status === 'PRIMARY' || node.NodeStatus === 'PRIMARY'
        );
        const primaryNodeName = primaryNode?.nodename || primaryNode?.Hostname || 'Unknown';
        
        // Healthy/aktif düğüm sayısı (PRIMARY veya SECONDARY olanlar)
        const activeNodes = nodes.filter(node => 
            node.status === 'PRIMARY' || node.status === 'SECONDARY' || 
            node.NodeStatus === 'PRIMARY' || node.NodeStatus === 'SECONDARY'
        ).length;
        
        // MongoDB servis durumu sayacı - RUNNING olanlar
        const mongoRunningNodes = nodes.filter(node => 
            node.MongoStatus === 'RUNNING'
        ).length;
        
        console.log(`Cluster ${clusterName} - Mongo running nodes: ${mongoRunningNodes}/${totalNodes}`);
        nodes.forEach(node => {
            console.log(`  - Node ${node.nodename || node.Hostname} MongoStatus: ${node.MongoStatus}`);
        });
        
        // Ortalama disk kullanımı (100 - freediskpercent)
        const avgDiskUsage = nodes.reduce((sum, node) => {
            // String veya number olabileceği için önce float'a çeviriyoruz
            const freePercent = typeof node.freediskpercent === 'string' 
                ? parseFloat(node.freediskpercent)
                : (node.freediskpercent || 0);
            
            // FDPercent de kullanılabilir
            const fdPercent = node.FDPercent || 0;
            
            // Hangisi varsa onu kullan
            const diskFreePercent = freePercent || fdPercent;
            
            // Disk kullanımı = 100 - boş alan yüzdesi
            return sum + (100 - diskFreePercent);
        }, 0) / (totalNodes || 1); // Sıfıra bölmeyi önle
        
        // Maksimum replikasyon gecikmesi
        const maxReplicationLag = Math.max(
            ...nodes.map(node => node.ReplicationLagSec || 0)
        );
        
        return {
            totalNodes,
            activeNodes,
            primaryNodeName,
            mongoRunningNodes,
            avgDiskUsage: Math.round(avgDiskUsage),
            replicationLag: maxReplicationLag
        };
    };
    
    const metrics = calculateClusterMetrics();

    const handleDeleteClick = async () => {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                message.error('Authorization token not found. Please log in again.');
                return;
            }
            
            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mongo/delete`, 
                { clusterName: clusterName },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            console.log('API Response:', response.data);
            message.success('Cluster removed successfully');
        } catch (error) {
            console.error('API Error:', error);
            message.error('Failed to remove cluster');
        }
    };

    const showDeleteConfirm = () => {
        Modal.confirm({
            title: (
                <span>
                    Are you sure you want to delete <span style={{ color: 'red', fontWeight: 'bold' }}>{clusterName}</span>?
                </span>
            ), content: 'If Dbstatus agents are still running, this cluster will be added to this dashboard again.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk() {
                handleDeleteClick();
            },
            onCancel() {
                console.log('Delete cancelled');
            },
        });
    };

    // Düğümün tam adını belirlemek için yardımcı işlev
    const getFullNodeName = (nodeName: string): string => {
        if (nodeName.includes(".osp-") && !nodeName.includes(".hepsi.io")) {
            return `${nodeName}.hepsi.io`;
        } else if ((nodeName.includes("dpay") || nodeName.includes("altpay")) && !nodeName.includes(".dpay.int")) {
            return `${nodeName}.dpay.int`;
        }
        return `${nodeName}.hepsiburada.dmz`;
    };

    const handleAddNode = async (): Promise<void> => {
        const token = localStorage.getItem('token');
        
        if (!token) {
            message.error('Authorization token not found. Please log in again.');
            return;
        }
        
        const primaryNode = nodes.find(node => node.status === 'PRIMARY' || node.NodeStatus === 'PRIMARY');
        if (!primaryNode) {
            message.error('No primary node found.');
            return;
        }

        const nodeName = primaryNode.nodename || primaryNode.Hostname;
        if (!nodeName) {
            message.error('Invalid node information');
            return;
        }

        const fullPrimaryNodeName = getFullNodeName(nodeName);
        const mongoAddNodeAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mongo/addnode`;
        
        setLoading(true);

        try {
            const response = await fetch(mongoAddNodeAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    hostname: fullPrimaryNodeName,
                    newNode: `${newNodeName}:${newNodePort}`,
                    clusterName: clusterName
                })
            });

            if (response.ok) {
                const data = await response.json();
                message.success(data.message || 'Node added successfully!');
                setIsModalVisible(false);
            } else {
                const errorData = await response.json();
                message.error(errorData.error || 'Failed to add node');
            }
        } catch (error) {
            console.error("Error adding node:", error);
            message.error('An error occurred while adding the node');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveNodes = async () => {
        const token = localStorage.getItem('token');
        
        if (!token) {
            message.error('Authorization token not found. Please log in again.');
            return;
        }
        
        const primaryNode = nodes.find(node => node.status === 'PRIMARY' || node.NodeStatus === 'PRIMARY');
        if (!primaryNode) {
            message.error('No primary node found.');
            return;
        }

        const nodeName = primaryNode.nodename || primaryNode.Hostname;
        if (!nodeName) {
            message.error('Invalid node information');
            return;
        }

        const fullPrimaryNodeName = getFullNodeName(nodeName);
        console.log("Selected Nodes:", selectedNodes);  // Debug log

        const mongoRemoveNodesAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mongo/removenodes`;

        setLoading(true);
        try {
            const cleanedNodes = selectedNodes.map(node => {
                const nodeParts = node.split(' ');
                const cleanedNode = nodeParts[0]; // Remove (SECONDARY) or (PRIMARY) parts
                let fullNodeName = getFullNodeName(cleanedNode) + ':27127';
                console.log("Cleaned Node:", fullNodeName);  // Debug log
                return fullNodeName;
            });

            console.log("Cleaned Nodes Array:", cleanedNodes);  // Debug log

            const response = await fetch(mongoRemoveNodesAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    hostname: fullPrimaryNodeName,
                    removeNodes: cleanedNodes,
                    clusterName: clusterName
                })
            });

            if (response.ok) {
                const data = await response.json();
                message.success(data.message || 'Nodes removed successfully!');
                setIsModalVisible(false);
            } else {
                const errorData = await response.json();
                message.error(errorData.error || 'Failed to remove nodes!');
            }
        } catch (error) {
            console.error("Error removing nodes:", error);
            message.error('An error occurred while removing nodes');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPrimary = async () => {
        const token = localStorage.getItem('token');
        
        if (!token) {
            message.error('Authorization token not found. Please log in again.');
            return;
        }
        
        const primaryNode = nodes.find(node => node.status === 'PRIMARY' || node.NodeStatus === 'PRIMARY');
        if (!primaryNode) {
            message.error('No primary node found.');
            return;
        }

        const nodeName = primaryNode.nodename || primaryNode.Hostname;
        if (!nodeName) {
            message.error('Invalid node information');
            return;
        }

        const fullPrimaryNodeName = getFullNodeName(nodeName);

        // Diğer secondary düğümleri bul
        const secondaryNodes = nodes
            .filter(node => (node.status === 'SECONDARY' || node.NodeStatus === 'SECONDARY') && 
                        (node.nodename !== selectedSecondaryNode && node.Hostname !== selectedSecondaryNode))
            .map(node => {
                const nodeName = node.nodename || node.Hostname;
                return nodeName ? getFullNodeName(nodeName) : '';
            })
            .filter(name => name !== '');

        const mongoSetPrimaryAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mongo/setprimary`;

        setLoading(true);
        try {
            const response = await fetch(mongoSetPrimaryAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    hostname: fullPrimaryNodeName,
                    newPrimaryNode: selectedSecondaryNode,
                    freezeNodes: secondaryNodes,
                    clusterName: clusterName
                })
            });

            if (response.ok) {
                const data = await response.json();
                message.success(data.message || 'Primary node set successfully!');
                setIsSetPrimaryModalVisible(false);
            } else {
                const errorData = await response.json();
                message.error(errorData.error || 'Failed to set primary node!');
            }
        } catch (error) {
            console.error("Error setting primary node:", error);
            message.error('An error occurred while setting primary node');
        } finally {
            setLoading(false);
        }
    };

    const showSetPrimaryModal = () => {
        setIsSetPrimaryModalVisible(true);
    };

    const showAddRemoveNodeModal = () => {
        setIsModalVisible(true);
    };

    const handleModalCancel = () => {
        setIsModalVisible(false);
        setIsSetPrimaryModalVisible(false);
    };

    const handleCheckboxChange = (node: string, checked: boolean) => {
        setSelectedNodes(prev => checked ? [...prev, node] : prev.filter(n => n !== node));
    };

    const handleRadioChange = (e: any) => {
        setSelectedSecondaryNode(e.target.value);
    };

    // Düğüm bilgilerini ekranda görüntülemek için yardımcı fonksiyon
    // API yanıtı yeni veya eski formatta gelebilir, her iki durumu da destekler
    const getNodeDisplayText = (node: NodeType): string => {
        const name = node.nodename || node.Hostname || '';
        const status = node.status || node.NodeStatus || 'UNKNOWN';
        return `${name} (${status})`;
    };


    return (
        <div>
            <Card
                bodyStyle={{ padding: 10, width: 250 }}
                onClick={onClick}
                actions={[
                    isLoggedIn && (
                        <Tooltip title="Remove replset from dbstatus">
                            <DeleteOutlined 
                                key="delete" 
                                onClick={(e) => { e.stopPropagation(); showDeleteConfirm(); }} 
                                style={{ color: '#ff4d4f', fontSize: '16px' }}
                            />
                        </Tooltip>
                    ),
                    <Tooltip title="Performance Analyze">
                        <Link to={`/mongopa?clusterName=${clusterName}`}>
                            <BarChartOutlined 
                                key="edit" 
                                style={{ color: '#1890ff', fontSize: '16px' }} 
                            />
                        </Link>
                    </Tooltip>,
                    isLoggedIn && (
                        <Tooltip title="Add or Remove Node">
                            <PlusOutlined 
                                key="add-remove" 
                                onClick={(e) => { e.stopPropagation(); showAddRemoveNodeModal(); }} 
                                style={{ color: '#52c41a', fontSize: '16px' }}
                            />
                        </Tooltip>
                    ),
                    isLoggedIn && (
                        <Tooltip title="Set Primary Node">
                            <CrownOutlined 
                                key="set-primary" 
                                onClick={(e) => { e.stopPropagation(); showSetPrimaryModal(); }} 
                                style={{ color: '#faad14', fontSize: '16px' }}
                            />
                        </Tooltip>
                    ),
                ].filter(Boolean)}
            >
                {/* Header - Title with MongoDB Icon */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <IconMongo size="20" color={iconColor} />
                    <span
                        style={{
                            marginLeft: 8,
                            fontWeight: 'bold',
                            fontSize: '14px',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {clusterName}
                    </span>
                </div>
                
                {/* Cluster Metrics */}
                <Space direction="vertical" style={{ width: '100%' }}>
                    {/* Node Status */}
                    <Row gutter={8}>
                        <Col span={24}>
                            <Tooltip title={
                                <div>
                                    <div>MongoDB Service Status</div>
                                    <div style={{ marginTop: 4 }}>
                                        {nodes.map((node, idx) => {
                                            const nodeName = node.nodename || node.Hostname || '';
                                            
                                            // MongoStatus değerini farklı şekillerde kontrol et
                                            let mongoStatus = 'UNKNOWN';
                                            if (node.MongoStatus !== undefined) {
                                                mongoStatus = String(node.MongoStatus);
                                            } else if (typeof node === 'object' && node !== null && 'mongoStatus' in node) {
                                                mongoStatus = String((node as any).mongoStatus);
                                            }
                                            
                                            // Debug log - tüm node içeriğini konsola yazdır
                                            console.log(`Node ${nodeName} full data:`, node);
                                            
                                            return (
                                                <div key={idx} style={{ 
                                                    color: mongoStatus === 'RUNNING' ? 
                                                            '#52c41a' : '#ff4d4f',
                                                    fontSize: '12px',
                                                    marginTop: 2
                                                }}>
                                                    {truncateHostname(nodeName, 20)}: {mongoStatus}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            }>
                                <Progress 
                                    percent={Math.round((metrics.mongoRunningNodes / metrics.totalNodes) * 100)}
                                    size="small"
                                    format={() => `${metrics.mongoRunningNodes}/${metrics.totalNodes}`}
                                    status={metrics.mongoRunningNodes === metrics.totalNodes ? "success" : "exception"}
                                />
                            </Tooltip>
                        </Col>
                    </Row>

                    {/* Primary Node & Disk Usage */}
                    <Row gutter={8}>
                        <Col span={12}>
                            <Tooltip title={metrics.primaryNodeName}>
                                <Statistic 
                                    title="Primary Node"
                                    value={truncateHostname(metrics.primaryNodeName, 12)}
                                    valueStyle={{ 
                                        fontSize: '12px',
                                        maxWidth: '120px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'block',
                                        lineHeight: '1.2'
                                    }}
                                />
                            </Tooltip>
                        </Col>
                        <Col span={12}>
                            <Tooltip title={`Cluster Disk Usage: ${metrics.avgDiskUsage}%`}>
                                <Progress 
                                    type="circle"
                                    percent={metrics.avgDiskUsage}
                                    width={40}
                                    strokeColor={
                                        metrics.avgDiskUsage > 90 ? '#ff4d4f' :
                                        metrics.avgDiskUsage > 80 ? '#faad14' :
                                        '#52c41a'
                                    }
                                    status={
                                        metrics.avgDiskUsage > 80 ? "exception" : "success"
                                    }
                                />
                            </Tooltip>
                        </Col>
                    </Row>

                    {/* Replication Lag */}
                    {metrics.replicationLag > 0 && (
                        <Row>
                            <Col span={24}>
                                <Space align="center">
                                    {metrics.replicationLag > 100 ? (
                                        <WarningOutlined style={{ color: '#faad14' }} />
                                    ) : (
                                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                    )}
                                    <span>Replication Lag: {metrics.replicationLag}s</span>
                                </Space>
                            </Col>
                        </Row>
                    )}
                </Space>
            </Card>
            <Modal
                title="Add or Remove Node"
                visible={isModalVisible}
                onCancel={handleModalCancel}
                maskClosable={false}
                zIndex={1000}
                style={{ zIndex: 1001 }}
                maskStyle={{ zIndex: 1000 }}
                footer={[
                    <Button key="cancel" onClick={handleModalCancel}>
                        Cancel
                    </Button>,
                    <Button key="add" type="primary" onClick={() => handleAddNode()}>
                        Add Node
                    </Button>,
                    <Button key="remove" danger onClick={handleRemoveNodes}>
                        Remove Node(s)
                    </Button>
                ]}
            >
                <Spin spinning={loading}>
                    <div style={{ marginBottom: 16 }}>
                        <h3>Add Node</h3>
                        <Input
                            placeholder="Node Name"
                            value={newNodeName}
                            onChange={(e) => setNewNodeName(e.target.value)}
                            style={{ marginBottom: 8 }}
                        />
                        <Input
                            placeholder="Port"
                            value={newNodePort}
                            onChange={(e) => setNewNodePort(e.target.value)}
                        />
                    </div>
                    <div>
                        <h3>Remove Node(s)</h3>
                        <List
                            dataSource={nodes.map(node => getNodeDisplayText(node))}
                            renderItem={(node: string) => (
                                <List.Item>
                                    <Checkbox onChange={(e) => handleCheckboxChange(node, e.target.checked)}>
                                        {node}
                                    </Checkbox>
                                </List.Item>
                            )}
                        />
                    </div>
                </Spin>
            </Modal>
            <Modal
                title="Set Primary Node"
                visible={isSetPrimaryModalVisible}
                onCancel={handleModalCancel}
                maskClosable={false}
                zIndex={1000}
                style={{ zIndex: 1001 }}
                maskStyle={{ zIndex: 1000 }}
                footer={[
                    <Button key="cancel" onClick={handleModalCancel}>
                        Cancel
                    </Button>,
                    <Button key="set-primary" type="primary" onClick={handleSetPrimary}>
                        Set Primary
                    </Button>
                ]}
            >
                <Spin spinning={loading}>
                    <h3>Select a Secondary Node to Set as Primary</h3>
                    <Radio.Group onChange={handleRadioChange} value={selectedSecondaryNode}>
                        {nodes
                            .filter(node => node.status === 'SECONDARY' || node.NodeStatus === 'SECONDARY')
                            .map(node => {
                                const nodeName = node.nodename || node.Hostname || '';
                                return (
                                    <Radio key={nodeName} value={nodeName}>
                                        {nodeName}
                                    </Radio>
                                );
                            })
                        }
                    </Radio.Group>
                </Spin>
            </Modal>
        </div>
    );
};

export default CustomCard;
