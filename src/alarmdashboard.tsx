import { useEffect, useState, Key } from "react";
import axios from "axios";
import { Card, Table, Modal, Button } from "antd"; // Ant Design bileşenleri
import { PieChart, Pie, Cell, Tooltip } from "recharts"; // Recharts bileşenleri
import { flattenMongoData, flattenPostgresData, parseDiskSize } from "./data-utils";
import { NodeType } from "./type";
import { useDispatch } from 'react-redux';
import { setHeadStats } from '../redux/redux';

const COLORS = ["#4CAF50", "#FFC107", "#F44336"]; // Yeşil (Healthy), Sarı (Warning), Kırmızı (Critical)

const AlarmDashboard = () => {
    const [clusters, setClusters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal için state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
    const [modalData, setModalData] = useState<NodeType[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<"Healthy" | "Warning" | "Critical" | null>(null);
    const dispatch = useDispatch();




    useEffect(() => {
        dispatch(setHeadStats({
            panelName: 'alarmdashboard',


        }));// eslint-disable-next-line
    }, [])


    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/generalhealth`);
                const rawData = response.data;

                const flattenedMongo = flattenMongoData(rawData.mongodb);
                const flattenedPostgres = flattenPostgresData(rawData.postgresql);

                const allNodes = [...flattenedMongo, ...flattenedPostgres];

                const clusterGroups: Record<string, NodeType[]> = {};
                allNodes.forEach((node) => {
                    const clusterName = node.ClusterName || node.replsetname || "Unknown";
                    if (!clusterGroups[clusterName]) {
                        clusterGroups[clusterName] = [];
                    }
                    clusterGroups[clusterName].push(node);
                });

                const clusterData = Object.keys(clusterGroups).map((clusterName, index) => {
                    const clusterNodes = clusterGroups[clusterName];

                    const warningCount = clusterNodes.filter((node) => {
                        if (node.dbType === "MongoDB") {
                            const freeDiskPercent = node.freediskpercent;
                            const freeDiskData = parseDiskSize(node.freediskdata);

                            // Hem yüzdesi %20'den küçük hem de boyutu 100GB'dan küçükse
                            return (freeDiskPercent || 100) < 20 && freeDiskData < 200;
                        } else if (node.dbType === "PostgreSQL") {
                            const freeDiskPercent = node.FDPercent;
                            const freeDiskData = parseDiskSize(node.FreeDisk);

                            // Hem yüzdesi %20'den küçük hem de boyutu 100GB'dan küçükse
                            return (freeDiskPercent || 100) < 20 && freeDiskData < 200;
                        }

                        return false;
                    }).length;


                    const criticalCount = clusterNodes.filter(
                        (node) =>
                            !(
                                node.status === "PRIMARY" ||
                                node.status === "MASTER" ||
                                node.status === "SECONDARY" ||
                                node.status === "SLAVE" ||
                                node.NodeStatus === "PRIMARY" ||
                                node.NodeStatus === "MASTER" ||
                                node.NodeStatus === "SECONDARY" ||
                                node.NodeStatus === "SLAVE"
                            )
                    ).length;

                    return {
                        key: index + 1,
                        id: index + 1,
                        name: clusterName,
                        warning: warningCount,
                        critical: criticalCount,
                        status: criticalCount === 0 ? "Operational" : "Critical",
                        nodes: clusterNodes, // Modal için tüm node bilgileri
                    };
                });

                setClusters(clusterData);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching health data:", error);
                setLoading(false);
            }
        };

        // İlk veri yükleme
        fetchData();

        // Interval ile yenileme
        const intervalId = setInterval(() => {
            fetchData();
        }, 5000);

        // Cleanup fonksiyonu
        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return <p>Loading...</p>;
    }

    const healthyClusterCount = clusters.filter((cluster) => cluster.status === "Operational")
        .length;
    const warningClusterCount = clusters.filter((cluster) => cluster.warning > 0).length;
    const criticalClusterCount = clusters.filter((cluster) => cluster.critical > 0).length;

    const pieChartData = [
        { name: "Healthy", value: healthyClusterCount },
        { name: "Warning", value: warningClusterCount },
        { name: "Critical", value: criticalClusterCount },
    ];

    const handleWarningClick = (record: any) => {
        // Uyarı durumundaki düğümleri filtrele
        const warningNodes = record.nodes.filter((node: NodeType) => {
            if (node.dbType === "MongoDB") {
                const freeDiskPercent = node.freediskpercent || 100;
                const freeDiskData = parseDiskSize(node.freediskdata);

                return freeDiskPercent < 20 && freeDiskData < 200; // %20'den küçük ve 100GB'dan küçükse
            } else if (node.dbType === "PostgreSQL") {
                const freeDiskPercent = node.FDPercent || 100;
                const freeDiskData = parseDiskSize(node.FreeDisk);

                return freeDiskPercent < 20 && freeDiskData < 200; // %20'den küçük ve 100GB'dan küçükse
            }

            return false;
        });

        setModalData(warningNodes); // Modal için filtrelenen düğümleri ayarla
        setSelectedCluster(record.name); // Seçili cluster'ı ayarla
        setModalVisible(true); // Modalı göster
    };


    const handleCriticalClick = (record: any) => {
        const criticalNodes = record.nodes.filter((node: NodeType) => {
            const isHealthyStatus =
                node.status === "PRIMARY" ||
                node.status === "MASTER" ||
                node.status === "SECONDARY" ||
                node.status === "SLAVE" ||
                node.NodeStatus === "PRIMARY" ||
                node.NodeStatus === "MASTER" ||
                node.NodeStatus === "SECONDARY" ||
                node.NodeStatus === "SLAVE";
            return !isHealthyStatus;
        });
        setModalData(criticalNodes);
        setSelectedCluster(record.name);
        setModalVisible(true);
    };

    const filteredClusters =
        selectedCategory === "Healthy"
            ? clusters.filter((cluster) => cluster.status === "Operational")
            : selectedCategory === "Warning"
                ? clusters.filter((cluster) => cluster.warning > 0)
                : selectedCategory === "Critical"
                    ? clusters.filter((cluster) => cluster.critical > 0)
                    : clusters;

    const columns = [
        {
            title: "Cluster Name",
            dataIndex: "name",
            key: "name",
        },
        {
            title: "Warning",
            dataIndex: "warning",
            key: "warning",
            render: (warning: number, record: any) => (
                <Button
                    type="link"
                    onClick={() => handleWarningClick(record)}
                    disabled={warning === 0}
                >
                    {warning}
                </Button>
            ),
        },
        {
            title: "Critical",
            dataIndex: "critical",
            key: "critical",
            render: (critical: number, record: any) => (
                <Button
                    type="link"
                    onClick={() => handleCriticalClick(record)}
                    disabled={critical === 0}
                >
                    {critical}
                </Button>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            filters: [
                { text: "Operational", value: "Operational" },
                { text: "Critical", value: "Critical" },
            ],
            onFilter: (value: boolean | Key, record: { status: string }) =>
                record.status === value,
            render: (status: string) => (
                <span style={{ color: status === "Operational" ? "green" : "red" }}>{status}</span>
            ),
        },
    ];

    return (
        <Card style={{ margin: "20px", padding: "20px", borderRadius: "8px" }}>
            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                <Card title="Status Overview" bordered={true} style={{ width: "320px" }}>
                    <PieChart width={300} height={300}>
                        <Pie
                            data={pieChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={70}
                            label={false}
                            labelLine={false}
                            isAnimationActive={true}
                            onMouseEnter={(_, index) => setSelectedCategory(pieChartData[index].name as any)} // Hover etkisi
                            activeIndex={-1}
                        >
                            {pieChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                    <div style={{ marginTop: "20px" }}>
                        <div style={{ color: "#4CAF50", marginBottom: "10px" }}>
                            <strong>{healthyClusterCount} Healthy</strong>
                        </div>
                        <div style={{ color: "#FFC107", marginBottom: "10px" }}>
                            <strong>{warningClusterCount} Warning</strong>
                        </div>
                        <div style={{ color: "#F44336" }}>
                            <strong>{criticalClusterCount} Critical</strong>
                        </div>
                    </div>
                </Card>
                <Card title="Recent Alarms" bordered={true} style={{ flex: 1 }}>
                    <Table
                        dataSource={filteredClusters}
                        columns={columns}
                        pagination={{ pageSize: 10 }}
                    />
                </Card>
            </div>
            <Modal
                title={`Alarm Details for Cluster: ${selectedCluster}`}
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={600}
            >
                {modalData.length > 0 ? (
                    <div>
                        {/* Disk Kapasitesi Uyarıları */}
                        {modalData.some((node) => (node.freediskpercent || node.FDPercent || 100) < 20) && (
                            <div style={{ marginBottom: "20px" }}>
                                <strong style={{ fontSize: "16px", color: "#FFC107" }}>Disk Warnings:</strong>
                                <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
                                    {modalData
                                        .filter((node) => (node.freediskpercent || node.FDPercent || 100) < 20)
                                        .map((node) => {
                                            const diskData =
                                                node.dbType === "MongoDB"
                                                    ? node.freediskdata
                                                    : node.FreeDisk;
                                            return (
                                                <li key={node.nodename || node.Hostname || "Unknown"}>
                                                    <strong>{node.nodename || node.Hostname || "N/A"}</strong>{" "}
                                                    ({diskData || "Unknown remaining"})
                                                </li>
                                            );
                                        })}
                                </ul>
                                <p style={{ color: "#FFC107", marginTop: "10px" }}>
                                    Nodes listed above have disk capacity below the threshold (20% and less than 200GB).
                                </p>
                            </div>
                        )}

                        {/* Node Durumu Uyarıları */}
                        {modalData.some(
                            (node) =>
                                !(
                                    node.status === "PRIMARY" ||
                                    node.status === "MASTER" ||
                                    node.status === "SECONDARY" ||
                                    node.status === "SLAVE" ||
                                    node.NodeStatus === "PRIMARY" ||
                                    node.NodeStatus === "MASTER" ||
                                    node.NodeStatus === "SECONDARY" ||
                                    node.NodeStatus === "SLAVE"
                                )
                        ) && (
                                <div>
                                    <strong style={{ fontSize: "16px", color: "#F44336" }}>Node Status Warnings:</strong>
                                    <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
                                        {modalData
                                            .filter(
                                                (node) =>
                                                    !(
                                                        node.status === "PRIMARY" ||
                                                        node.status === "MASTER" ||
                                                        node.status === "SECONDARY" ||
                                                        node.status === "SLAVE" ||
                                                        node.NodeStatus === "PRIMARY" ||
                                                        node.NodeStatus === "MASTER" ||
                                                        node.NodeStatus === "SECONDARY" ||
                                                        node.NodeStatus === "SLAVE"
                                                    )
                                            )
                                            .map((node) => (
                                                <li key={node.nodename || node.Hostname || "Unknown"}>
                                                    <strong>{node.nodename || node.Hostname || "N/A"}</strong>
                                                </li>
                                            ))}
                                    </ul>
                                    <p style={{ color: "#F44336", marginTop: "10px" }}>
                                        Nodes listed above are not in a healthy state.
                                    </p>
                                </div>
                            )}
                    </div>
                ) : (
                    <p>No alarms detected for this cluster.</p>
                )}
            </Modal>


        </Card>
    );
};

export default AlarmDashboard;
