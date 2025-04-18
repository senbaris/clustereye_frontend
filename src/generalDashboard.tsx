import { useEffect, useState } from "react";
import axios from "axios";
import { DashboardData } from "./type";
import { flattenMongoData, flattenPostgresData } from "./data-utils";
import './index.css';
import { useDispatch } from 'react-redux';
import { setHeadStats } from '../redux/redux';
import { STATUS_COLORS, getStatusColor } from "./hexagon";
import { message, Spin, Card, Row, Col } from 'antd';
import NodeStatusGrid from "./NodeStatusGrid";
import { useNavigate } from 'react-router-dom';

// Filter types
type FilterType = 'all' | 'critical' | 'warning' | 'mongodb' | 'postgresql' | 'issues';

const GeneralDashboard = () => {
    // Tip tanımlı useState
    const [data, setData] = useState<DashboardData>({ mongodb: [], postgresql: [] });
    const [loading, setLoading] = useState<boolean>(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>('issues');
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    // NodeStatusGrid'den gelen statü sayımları
    const [mongodbCritical, setMongodbCritical] = useState(0);
    const [mongodbWarning, setMongodbWarning] = useState(0);
    const [postgresqlCritical, setPostgresqlCritical] = useState(0);
    const [postgresqlWarning, setPostgresqlWarning] = useState(0);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Yeni /api/v1/status/nodeshealth endpointi ile tek bir istek yapıyoruz
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`, 
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );
            
            if (!response.ok) {
                throw new Error(`API response not ok: ${response.status} ${response.statusText}`);
            }
            
            // API yanıtını işle
            const responseData = await response.json();
            console.log("API response:", responseData);
            
            // API yanıtını kontrol et
            if (responseData && responseData.status === "success") {
                // Yeni API formatı: "status" ve "data" alanları içeren
                const { postgresql, mongodb } = responseData.data || {};
                
                if (postgresql && mongodb) {
                    console.log("MongoDB data:", mongodb);
                    console.log("PostgreSQL data:", postgresql);
                    
                    // PostgreSQL ve MongoDB verilerini düzleştir
                    const flattenedPostgres = flattenPostgresData(postgresql);
                    const flattenedMongo = flattenMongoData(mongodb);
                    
                    console.log("Flattened MongoDB data:", flattenedMongo);
                    console.log("Flattened PostgreSQL data:", flattenedPostgres);
                    
                    setData({
                        mongodb: flattenedMongo,
                        postgresql: flattenedPostgres,
                    });
                } else {
                    console.error("Data fields missing in API response:", responseData);
                    message.error("Veri alınırken hata oluştu. PostgreSQL veya MongoDB verileri eksik.");
                }
            } else if (responseData && responseData.postgresql && responseData.mongodb) {
                // Eski API formatı: doğrudan postgresql ve mongodb alanları içeren
                console.log("Using legacy API format");
                console.log("MongoDB data:", responseData.mongodb);
                console.log("PostgreSQL data:", responseData.postgresql);
                
                // PostgreSQL ve MongoDB verilerini düzleştir
                const flattenedPostgres = flattenPostgresData(responseData.postgresql);
                const flattenedMongo = flattenMongoData(responseData.mongodb);
                
                console.log("Flattened MongoDB data:", flattenedMongo);
                console.log("Flattened PostgreSQL data:", flattenedPostgres);

                setData({
                    mongodb: flattenedMongo,
                    postgresql: flattenedPostgres,
                });
            } else {
                console.error("Invalid API response format:", responseData);
                message.error("Veri alınırken hata oluştu. Geçersiz yanıt formatı.");
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            message.error("Veriler alınırken bir hata oluştu.");
        } finally {
                setLoading(false);
        }
    };

    // Toplam MongoDB ve PostgreSQL Node Sayıları
    const totalMongoNodes = data.mongodb.length;
    const totalPostgresNodes = data.postgresql.length;
    
    // Toplam kritik ve uyarı durumunda olan node sayıları
    const totalCriticalNodes = mongodbCritical + postgresqlCritical;
    const totalWarningNodes = mongodbWarning + postgresqlWarning;

    useEffect(() => {
        dispatch(setHeadStats({
            panelName: 'clusterheatmap',
            totalMongoNodes: totalMongoNodes,
            totalPostgresNodes: totalPostgresNodes,
            criticalNodes: totalCriticalNodes,
            warningNodes: totalWarningNodes
        }));// eslint-disable-next-line
    }, [totalMongoNodes, totalPostgresNodes, totalCriticalNodes, totalWarningNodes])

    useEffect(() => {
        fetchData();

        const intervalId = setInterval(() => {
            fetchData();
        }, 5000);

        return () => clearInterval(intervalId);
    }, []);

    // MongoDB statü bildirimleri
    const handleMongoStatusCount = (critical: number, warning: number) => {
        setMongodbCritical(critical);
        setMongodbWarning(warning);
    };
    
    // PostgreSQL statü bildirimleri
    const handlePostgresStatusCount = (critical: number, warning: number) => {
        setPostgresqlCritical(critical);
        setPostgresqlWarning(warning);
    };

    // Handle node click for PostgreSQL nodes
    const handlePostgresNodeClick = (node: any) => {
        const clusterName = node.ClusterName || 'postgres';
        const hostName = node.Hostname || '';
        
        // Navigate with both clusterName and hostName parameters
        navigate(`/postgrepa?clusterName=${clusterName}&hostName=${hostName}`);
    };

    // Genel özet istatistiklerini gösteren kartlar
    const StatisticCards = () => (
        <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
                <Card 
                    title="Total Nodes" 
                    bordered={false}
                    hoverable
                    style={{ 
                        cursor: 'pointer',
                        borderTop: activeFilter === 'all' ? '2px solid #1890ff' : undefined
                    }}
                    onClick={() => setActiveFilter('all')}
                >
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                        {totalMongoNodes + totalPostgresNodes}
                    </div>
                </Card>
            </Col>
            <Col span={4}>
                <Card 
                    title="Total Issues" 
                    bordered={false}
                    hoverable
                    style={{ 
                        cursor: 'pointer',
                        borderTop: activeFilter === 'issues' ? '2px solid #ff4d4f' : undefined,
                        background: (totalCriticalNodes + totalWarningNodes) > 0 ? '#fff2f0' : undefined
                    }}
                    headStyle={{ background: (totalCriticalNodes + totalWarningNodes) > 0 ? '#fff2f0' : undefined }}
                    bodyStyle={{ background: (totalCriticalNodes + totalWarningNodes) > 0 ? '#fff2f0' : undefined }}
                    onClick={() => setActiveFilter('issues')}
                >
                    <div style={{ 
                        fontSize: 24, 
                        fontWeight: 'bold', 
                        color: (totalCriticalNodes + totalWarningNodes) > 0 ? '#ff4d4f' : '#52c41a'
                    }}>
                        {totalCriticalNodes + totalWarningNodes}
                    </div>
                </Card>
            </Col>
            <Col span={4}>
                <Card 
                    title="MongoDB Nodes" 
                    bordered={false}
                    hoverable
                    style={{ 
                        cursor: 'pointer',
                        borderTop: activeFilter === 'mongodb' ? '2px solid #1890ff' : undefined
                    }}
                    onClick={() => setActiveFilter('mongodb')}
                >
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                        {totalMongoNodes}
                    </div>
                </Card>
            </Col>
            <Col span={4}>
                <Card 
                    title="PostgreSQL Nodes" 
                    bordered={false}
                    hoverable
                    style={{ 
                        cursor: 'pointer',
                        borderTop: activeFilter === 'postgresql' ? '2px solid #13c2c2' : undefined
                    }}
                    onClick={() => setActiveFilter('postgresql')}
                >
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#13c2c2' }}>
                        {totalPostgresNodes}
                    </div>
                </Card>
            </Col>
            <Col span={4}>
                <Card 
                    title="Criticals" 
                    bordered={false}
                    hoverable
                    style={{ 
                        cursor: 'pointer',
                        borderTop: activeFilter === 'critical' ? '2px solid #ff4d4f' : undefined,
                        background: totalCriticalNodes > 0 ? '#fff2f0' : undefined
                    }}
                    headStyle={{ background: totalCriticalNodes > 0 ? '#fff2f0' : undefined }}
                    bodyStyle={{ background: totalCriticalNodes > 0 ? '#fff2f0' : undefined }}
                    onClick={() => setActiveFilter('critical')}
                >
                    <div style={{ 
                        fontSize: 24, 
                        fontWeight: 'bold', 
                        color: totalCriticalNodes > 0 ? STATUS_COLORS.RED : '#52c41a'
                    }}>
                        {totalCriticalNodes}
                    </div>
                </Card>
            </Col>
            <Col span={4}>
                <Card 
                    title="Warnings" 
                    bordered={false}
                    hoverable
                    style={{ 
                        cursor: 'pointer',
                        borderTop: activeFilter === 'warning' ? '2px solid #faad14' : undefined,
                        background: totalWarningNodes > 0 ? '#fffbe6' : undefined
                    }}
                    headStyle={{ background: totalWarningNodes > 0 ? '#fffbe6' : undefined }}
                    bodyStyle={{ background: totalWarningNodes > 0 ? '#fffbe6' : undefined }}
                    onClick={() => setActiveFilter('warning')}
                >
                    <div style={{ 
                        fontSize: 24, 
                        fontWeight: 'bold', 
                        color: totalWarningNodes > 0 ? STATUS_COLORS.YELLOW : '#52c41a'
                    }}>
                        {totalWarningNodes}
                    </div>
                </Card>
            </Col>
        </Row>
    );

    if (loading && data.mongodb.length === 0 && data.postgresql.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Veriler yükleniyor..." />
            </div>
        );
    }

    return (
        <div style={{ padding: "20px" }}>
            <StatisticCards />
            
            {/* Hexagon grid yerine modern card UI kullanıyoruz */}
            <NodeStatusGrid 
                nodes={data.mongodb} 
                title="MongoDB Nodes" 
                type="mongodb"
                onStatusCount={handleMongoStatusCount}
                activeFilter={activeFilter}
            />
            
            <NodeStatusGrid 
                nodes={data.postgresql} 
                title="PostgreSQL Nodes" 
                type="postgresql"
                onStatusCount={handlePostgresStatusCount}
                activeFilter={activeFilter}
                onNodeClick={handlePostgresNodeClick}
            />
        </div>
    );
};


export default GeneralDashboard;
