import React, { ReactNode } from 'react';
import { Card, Tooltip, Modal, Row, Col, Badge, Statistic, Space, Progress } from 'antd';
import { DeleteOutlined, BarChartOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import IconPostgres from './icons/postgresql';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from './store';

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

type CustomCardProps = {
    clusterName: string;
    iconColor: string;
    metrics: ClusterMetrics;
    onClick: () => void;
    children?: ReactNode;
};

const truncateHostname = (hostname: string, length: number = 20): string => {
    if (hostname.length <= length) return hostname;
    return hostname.slice(0, length) + '...';
};

const CustomCard: React.FC<CustomCardProps> = ({ clusterName, iconColor, metrics, onClick }) => {
    
    // Keycloak yerine Redux auth state'ini kullan
    const { isLoggedIn } = useSelector((state: RootState) => state.auth);

    const handleDeleteClick = async () => {
        try {
            const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/delete_postgresql_cls`, {
                clusterName: clusterName,
            });
            console.log('API Response:', response.data);
        } catch (error) {
            console.error('API Error:', error);
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

    return (
        <Card
            style={{ 
                width: 300,
                height: 200
            }}
            bodyStyle={{ 
                padding: 12,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
            onClick={onClick}
        >
            {/* Cluster Header */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 12,
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 8
            }}>
                <IconPostgres size="24" color={iconColor} />
                <Tooltip title={clusterName}>
                    <span style={{
                        marginLeft: 8,
                        fontSize: '14px',
                        fontWeight: 'bold',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {truncateHostname(clusterName, 20)}
                    </span>
                </Tooltip>
                <Badge 
                    status={metrics.activeNodes === metrics.totalNodes ? "success" : "warning"} 
                    text={`${metrics.activeNodes}/${metrics.totalNodes} nodes`}
                />
            </div>

            {/* Cluster Metrics */}
            <Space direction="vertical" style={{ width: '100%', flex: 1 }} size="small">
                {/* Node Status Row */}
                <Row gutter={8}>
                    <Col span={12}>
                        <Tooltip title={
                            <div>
                                <div>PGBouncer Status</div>
                                <div style={{ marginTop: 4 }}>
                                    {metrics.pgBouncerDetails.map((node, idx) => (
                                        <div key={idx} style={{ 
                                            color: node.status === 'RUNNING' ? '#52c41a' : '#ff4d4f',
                                            fontSize: '12px',
                                            marginTop: 2
                                        }}>
                                            {truncateHostname(node.nodeName, 20)}: {node.status}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        }>
                            <Progress 
                                percent={Math.round((metrics.pgBouncerStatus.running / metrics.pgBouncerStatus.total) * 100)}
                                size="small"
                                format={() => `${metrics.pgBouncerStatus.running}/${metrics.pgBouncerStatus.total}`}
                                status={metrics.pgBouncerStatus.running === metrics.pgBouncerStatus.total ? "success" : "exception"}
                            />
                        </Tooltip>
                    </Col>
                    <Col span={12}>
                        <Tooltip title={
                            <div>
                                <div>PG Service Status</div>
                                <div style={{ marginTop: 4 }}>
                                    {metrics.pgServiceDetails.map((node, idx) => (
                                        <div key={idx} style={{ 
                                            color: node.status === 'RUNNING' ? '#52c41a' : '#ff4d4f',
                                            fontSize: '12px',
                                            marginTop: 2
                                        }}>
                                            {truncateHostname(node.nodeName, 20)}: {node.status}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        }>
                            <Progress 
                                percent={Math.round((metrics.pgServiceStatus.running / metrics.pgServiceStatus.total) * 100)}
                                size="small"
                                format={() => `${metrics.pgServiceStatus.running}/${metrics.pgServiceStatus.total}`}
                                status={metrics.pgServiceStatus.running === metrics.pgServiceStatus.total ? "success" : "exception"}
                            />
                        </Tooltip>
                    </Col>
                </Row>

                {/* Master Node & Disk Usage */}
                <Row gutter={8}>
                    <Col span={12}>
                        <Tooltip title={metrics.masterNode}>
                            <Statistic 
                                title="Master Node"
                                value={truncateHostname(metrics.masterNode, 15)}
                                valueStyle={{ 
                                    fontSize: '12px',
                                    maxWidth: '120px',  // Sabit maksimum genişlik
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    lineHeight: '1.2'  // Satır yüksekliğini azaltalım
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
                <Row>
                    <Col span={24}>
                        <Space align="center">
                            {metrics.replicationLag > 300 ? (
                                <WarningOutlined style={{ color: '#faad14' }} />
                            ) : (
                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            )}
                            <span>Replication Lag: {metrics.replicationLag}s</span>
                        </Space>
                    </Col>
                </Row>
            </Space>

            {/* Yeni Action Footer */}
            <div style={{
                borderTop: '1px solid #f0f0f0',
                marginTop: 8,
                paddingTop: 8,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8
            }}>
                {isLoggedIn && (
                    <Tooltip title="Remove cluster from dbstatus">
                        <DeleteOutlined 
                            style={{ color: '#ff4d4f', cursor: 'pointer' }}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                showDeleteConfirm(); 
                            }} 
                        />
                    </Tooltip>
                )}
                <Tooltip title="Performance Analyze">
                    <Link 
                        to={`/postgrepa?clusterName=${clusterName}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <BarChartOutlined style={{ color: '#1890ff' }} />
                    </Link>
                </Tooltip>
            </div>
        </Card>
    );
};

export default CustomCard;
