import React, { useState, useEffect, useContext } from 'react';
import { Table, Select, Steps, Spin, Card, Row, Col, Tabs, Progress, Tag, Tooltip, Modal, Button, message, InputNumber } from 'antd';
import { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { DownloadOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import TabPane from 'antd/es/tabs/TabPane';
import './index.css';
import 'react-datetime/css/react-datetime.css';
import { AuthContext } from './authcontext';
import Cookies from 'js-cookie';


interface UserId {
    Data: string;
    Subtype: number;
}

interface Role {
    db: string;
    role: string;
}

interface User {
    _id: string;
    credentials: unknown;  // 'credentials' karmaşık bir yapıya sahip olduğu için burada any tipini kullanıyorum
    db: string;
    roles: Role[];
    user: string;
    userId: UserId;
}

interface ReplicaSetData {
    [replicasetname: string]: NodeInfo[];
}

interface NodeInfo {
    nodename: string;
    dbAgentStatus: string;
    dc: string;
    freediskdata: string;
    freediskpercent: string;
    ip: string;
    status: string;
    totalDiskSize: string;
    version: string;
}

interface SystemInfo {
    cpu_cores: number;
    cpu_type: string;
    os_distribution: string;
    os_version: string;
    uptime: number;
    ram_total: number;
}
interface CpuUsage {
    cpu_usage: number;
}

interface MemoryUsage {
    memory_usage: number;
}

interface User {
    user: string;
    db: string;
}

interface ClientMetadata {
    driver: {
        name: string;
        version: string;
    };
    os: {
        type: string;
        name: string;
        architecture: string;
        version: string;
    };
    application: {
        name: string;
    };
}

interface Op {
    key: number;
    type: string;
    host: string;
    desc: string;
    active: boolean;
    currentOpTime: string;
    effectiveUsers?: User[];
    opid?: number;
    op?: string;
    ns?: string;
    command: object;
    numYields: number;
    locks: object;
    waitingForLock: boolean;
    lockStats: object;
    waitingForFlowControl: boolean;
    flowControlStats: object;
    connectionId?: number;
    client?: string;
    clientMetadata?: ClientMetadata;
    threaded?: boolean;
    appName?: string;
    secs_running: number;

}

interface ConnectionData {
    _id: string; // Uygulama adı (appName veya 'noappname')
    total_connections: number; // Toplam bağlantı sayısı
}

interface InProg {
    inprog: Op[];
}


const { Option } = Select;
const { Step } = Steps;

const MongoPA: React.FC = () => {
    const [data, setData] = useState<User[]>([]);
    const [dataConnections, setDataConnections] = useState<ConnectionData[]>([]);
    const [activeopsdata, setActiveOpsData] = useState<Op[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [replSets, setReplSets] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedReplicaSet, setSelectedReplicaSet] = useState<string | null>(null);
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [selectedNode, setSelectedNode] = useState('');
    const [queryResultsCpuUsage, setQueryResultsCpuUsage] = useState<CpuUsage>({ cpu_usage: 0 });
    const [queryResultsMemoryUsage, setQueryResultsMemoryUsage] = useState<MemoryUsage>({ memory_usage: 0 });
    const [loadAverage, setLoadAverage] = useState({ cpuCount: 0, load1: 0, load5: 0, load15: 0 });
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const twoColors = { '0%': '#4faa40ff', '100%': '#c31717ff' };
    const [activeTab, setActiveTab] = useState('3');
    const [filterValue, setFilterValue] = useState<number>(0); // Filtre değeri state


    const auth = useContext(AuthContext);



    if (!auth) {
        throw new Error('Mongo must be used within an AuthProvider');
    }
    const checkAuthStatus = async () => {
        const token = Cookies.get('auth_token');
        if (token) {
            return true; // Eğer token geçerliyse true dönecek.
        }
        return false;
    };

    useEffect(() => {
        const verifyAuth = async () => {
            const isAuthenticated = await checkAuthStatus();
            auth?.setIsLoggedIn(isAuthenticated);
        };

        verifyAuth();
    }, [auth]);


    // Node'ları yüklemek için fonksiyon
    const loadNodes = (replicaSetName: string) => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/status`)
            .then(response => response.json())
            .then((data: { [key: string]: NodeInfo[] }[]) => {
                const nodesData = data.find((item) => Object.prototype.hasOwnProperty.call(item, replicaSetName));
                if (nodesData && nodesData[replicaSetName]) {
                    setNodes(nodesData[replicaSetName]);
                } else {
                    setNodes([]);
                }
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching nodes data: ', error);
                setLoading(false);
                setNodes([]);
            });
    };

    function syntaxHighlight(json: unknown): string {
        let jsonString: string;

        // Eğer json bir string değilse, onu string'e çevir
        if (typeof json !== 'string') {
            jsonString = JSON.stringify(json, undefined, 2);
        } else {
            jsonString = json;
        }

        // HTML'e uygun hale getir
        jsonString = jsonString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // JSON'un çeşitli kısımlarını renklendir
        return jsonString.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g, (match: string) => {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    const showModal = (command: unknown) => {
        const commandString = JSON.stringify(command, null, 2); // JSON string'e dönüştür

        // Kopyala işlevi
        const handleCopy = () => {
            navigator.clipboard.writeText(commandString).then(() => {
                message.success('Query copied to clipboard!');
            });
        };

        Modal.info({
            title: 'Full Query Command',
            content: (
                <div>
                    <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(commandString) }}></pre>
                </div>
            ),
            width: '80%',
            bodyStyle: {
                maxHeight: '70vh', // Maksimum yükseklik ekranın %70'i
                overflowY: 'auto' // İçerik çok uzunsa kaydırma çubuğu göster
            },
            style: { top: '50%', transform: 'translateY(-50%)' },

            footer: (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleCopy} style={{ marginRight: 8 }}>
                        <CopyOutlined /> Copy
                    </button>
                    <button onClick={() => Modal.destroyAll()}>OK</button>
                </div>
            ),
        });
    };


    const onSecsRunningFilter = (value: number, record: Op) => {
        return record.secs_running >= value;
    };

    const handleFilterChange = (value: number | null) => {
        setFilterValue(value !== null ? value : 0);
    };

    const fetchCPUUsage = async (nodeName: string) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_cpu_usage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName }),
            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json();
            setQueryResultsCpuUsage(data)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchMemoryUsage = async (nodeName: string) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_memory_usage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName }),
            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json();
            setQueryResultsMemoryUsage(data)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchLoadAverage = async (nodeName: string) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_load_average`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName }),
            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json();
            setLoadAverage(data)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchSystemInfo = async (nodeName: string) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_system_info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName }),
            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json();
            setSystemInfo(data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchActiveOps = async (hostname: string, secsRunning: number) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_mongodbactiveops`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ hostname, secsRunning }),
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const result: InProg = await response.json();

            if (result && result.inprog) {
                const inprogData = result.inprog
                    .filter(op => op.appName !== 'OplogFetcher' && op.op !== 'none') // OplogFetcher girdilerini filtrele
                    .map((op, index) => ({
                        ...op,
                        key: index,
                    }));
                setActiveOpsData(inprogData);
            } else {
                throw new Error('Invalid data format');
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatUptime = (uptimeSeconds: number) => {
        const secondsInMinute = 60;
        const secondsInHour = secondsInMinute * 60;
        const secondsInDay = secondsInHour * 24;

        const days = Math.floor(uptimeSeconds / secondsInDay);
        const hoursLeft = uptimeSeconds % secondsInDay;
        const hours = Math.floor(hoursLeft / secondsInHour);
        const minutesLeft = hoursLeft % secondsInHour;
        const minutes = Math.floor(minutesLeft / secondsInMinute);

        return `${days} days, ${hours} hours, ${minutes} minutes`;
    };


    const roundedCpuUsage = parseFloat(queryResultsCpuUsage.cpu_usage.toFixed(2));
    const roundedMemoryUsage = parseFloat(queryResultsMemoryUsage.memory_usage.toFixed(2));

    const formatMemory = (memoryInGB: number): string => {
        return `${memoryInGB.toFixed(2)} GB`;
    };
    const getColor = (value: number): string => {
        if (value < loadAverage.cpuCount) return 'green';
        if (value < loadAverage.cpuCount * 2) return 'orange';
        return 'red';
    };

    useEffect(() => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/status`)
            .then(response => response.json())
            .then((data: ReplicaSetData[]) => {
                const fetchedReplSets = data.map(
                    (replicaSetObject: ReplicaSetData) => Object.keys(replicaSetObject)[0]
                );
                setReplSets(fetchedReplSets);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching data: ', error);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        const query = new URLSearchParams(location.search);
        const clusterName = query.get('clusterName');
        if (clusterName) {
            setSelectedReplicaSet(clusterName);
            loadNodes(clusterName);
            setCurrentStep(2)
        }
    }, []);

    useEffect(() => {
        if (activeTab === '3') {
            fetchQueryUserAccessList(selectedNode)

        } else if (activeTab === '4') {
            fetchLoadAverage(selectedNode);
            fetchSystemInfo(selectedNode);
            fetchCPUUsage(selectedNode);
            fetchMemoryUsage(selectedNode)

        } else if (activeTab === '5') {
            fetchActiveOps(selectedNode, filterValue);
        }
        else if (activeTab === '6') {
            fetchMongoDBConnections(selectedNode);
        }

    }, [activeTab, filterValue, selectedNode]);


    const handleTabChange = (key: string) => {
        setActiveTab(key);
    };

    const handleReplSetChange = (value: string) => {
        setSelectedReplicaSet(value);
        setLoading(true);
        fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/status`)
            .then(response => response.json())
            .then((data: { [key: string]: NodeInfo[] }[]) => {
                const nodesData = data.find((item) => Object.prototype.hasOwnProperty.call(item, value));
                if (nodesData && nodesData[value]) {
                    setNodes(nodesData[value]);
                    loadNodes(value);
                    // İlk node'u otomatik olarak seç
                    if (nodesData[value].length > 0) {
                        setCurrentStep(1);
                    } else {
                        // Eğer node listesi boşsa, seçimi ve logları sıfırla
                        setSelectedNode('');
                    }
                } else {
                    setNodes([]);
                    setSelectedNode('');
                }
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching nodes data: ', error);
                setLoading(false);
                setNodes([]);
                setSelectedNode('');
            });
    };

    const handleNodeChange = async (nodename: string) => {
        setSelectedNode(nodename);
        if (activeTab === '4') {
            fetchLoadAverage(nodename);
            fetchSystemInfo(nodename);
            fetchCPUUsage(nodename);
            fetchMemoryUsage(nodename)
            setCurrentStep(2);

        } else if (activeTab === '3') {
            fetchQueryUserAccessList(nodename)
            setCurrentStep(2);

        } else if (activeTab === '5') {
            fetchActiveOps(nodename, filterValue)
            setCurrentStep(2);
        } else if (activeTab === '6') {
            fetchMongoDBConnections(nodename)
            setCurrentStep(2);
        }

    };
    const fetchQueryUserAccessList = async (nodename: string) => {
        try {
            setLoading(true);
            // Flask API'ye GET isteği atarak log dosyalarını al
            const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/get_mongodbusers`, {
                hostname: nodename // JSON gövdesinde doğrudan hostname'i gönder
            });

            if (response.data) {
                setData(response.data);
            } else {
                // Yanıt beklenen yapıda değilse, hata mesajı göster
                console.error('No log files found for the selected node');
            }
        } catch (error) {
            console.error('Error fetching log files:', error);

        } finally {
            setLoading(false);

        }
    }

    const fetchMongoDBConnections = async (nodename: string) => {
        try {
            setLoading(true);

            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/get_mongodbconnections`,
                { hostname: nodename }
            );

            if (response.data) {
                setDataConnections(response.data);
            } else {
                console.error('No connections found for the selected node');
            }
        } catch (error) {
            console.error('Error fetching MongoDB connections:', error);
        } finally {
            setLoading(false);
        }
    };


    const columns: ColumnsType<User> = [
        {
            title: 'User ID',
            dataIndex: '_id',
            key: '_id',
        },
        {
            title: 'Username',
            dataIndex: 'user',
            key: 'user',
        },
        {
            title: 'Database',
            dataIndex: 'db',
            key: 'db',
        },
        {
            title: 'Roles',
            key: 'roles',
            render: (_, record) => renderRoles(record.roles),
        },
        // Burada 'roles' ve diğer karmaşık yapılar için özel render fonksiyonları ekleyebilirsiniz
    ];
    const renderRoles = (roles: Role[]) => {
        return (
            <ul>
                {roles.map((role, index) => (
                    <li key={index}>{role.role} in {role.db}</li>
                ))}
            </ul>
        );
    };

    const connectionColumns: ColumnsType<ConnectionData> = [
        {
            title: "Application Name",
            dataIndex: "_id",
            key: "_id",
            render: (text: string) => text || "noappname", // Boş değerleri "noappname" göster
        },
        {
            title: "Total Connections",
            dataIndex: "total_connections",
            key: "total_connections",
            sorter: (a, b) => a.total_connections - b.total_connections, // Bağlantı sayısına göre sıralama
        },
    ];


    const columnsActiveOps: ColumnsType<Op> = [
        {
            title: 'Active',
            dataIndex: 'active',
            key: 'active',
            render: (active: boolean) => (
                <Tag color={active ? 'green' : 'red'}>{active ? 'Yes' : 'No'}</Tag>
            ),
        },
        {
            title: 'App Name',
            dataIndex: 'appName',
            key: 'appName',
            ellipsis: true,
        },
        {
            title: 'Client',
            dataIndex: 'client',
            key: 'client',
            ellipsis: true,
        },
        {
            title: 'Current Operation Time',
            dataIndex: 'currentOpTime',
            key: 'currentOpTime',
            ellipsis: true,
        },
        {
            title: 'Seconds Running',
            dataIndex: 'secs_running',
            key: 'secs_running',
        },
        {
            title: 'Client Metadata',
            dataIndex: 'clientMetadata',
            key: 'clientMetadata',
            render: (clientMetadata: ClientMetadata) => (
                <>
                    <Tooltip title={clientMetadata?.application?.name}>
                        <Tag color="blue" className="ellipsis-tag">{clientMetadata?.application?.name ?? 'N/A'}</Tag>
                    </Tooltip>
                    <Tooltip title={`${clientMetadata?.driver?.name} (${clientMetadata?.driver?.version})`}>
                        <Tag color="purple" className="ellipsis-tag">{`${clientMetadata?.driver?.name} (${clientMetadata?.driver?.version})`}</Tag>
                    </Tooltip>
                    <Tooltip title={`${clientMetadata?.os?.name} (${clientMetadata?.os?.version})`}>
                        <Tag color="orange" className="ellipsis-tag">{`${clientMetadata?.os?.name} (${clientMetadata?.os?.version})`}</Tag>
                    </Tooltip>
                </>
            ),
        },
        {
            title: 'Connection ID',
            dataIndex: 'connectionId',
            key: 'connectionId',
        },
        {
            title: 'Operation',
            dataIndex: 'op',
            key: 'op',
        },
        {
            title: 'Namespace',
            dataIndex: 'ns',
            key: 'ns',
        },
        {
            title: 'Command',
            dataIndex: 'command',
            key: 'command',
            render: (command: unknown) => (
                <Button type="primary" onClick={() => showModal(command)}>
                    Show Query
                </Button>
            ),
        },
    ];

    const filteredData = activeopsdata.filter((record) => onSecsRunningFilter(filterValue, record));



    const exportToCsv = (filename: string, rows: User[]) => {
        // CSV için sütun başlıkları
        const headers = [
            "User ID",
            "Username",
            "Database",
            "Roles",
            "User ID Data",
            "User ID Subtype",
            // Diğer başlıklarınız...
        ].join(",");

        // Veriyi CSV formatına dönüştürme
        const csvContent = rows.map(row => {
            // Role listesini bir dizi olarak ele alıp her rolü yeni bir satırda listelemek
            const roles = row.roles.map(role => `${role.role} in ${role.db}`).join("; "); // Rol listesini ayırma
            return [
                `"${row._id}"`,
                `"${row.user}"`,
                `"${row.db}"`,
                `"${roles}"`, // Roller okunaklı bir şekilde ";" ile ayrılmış
                `"${row.userId.Data}"`,
                `"${row.userId.Subtype}"`,
                // Diğer karmaşık alanlar...
            ].join(",");
        }).join("\n");

        // UTF-8 BOM ekleyerek ve sütun başlıklarını ekleyerek Blob oluşturma
        const blob = new Blob(["\uFEFF" + headers + "\n" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    return (
        <>
            <div style={{ marginBottom: '20px' }}>
                <Card >
                    <Steps current={currentStep}>
                        <Step title="Select Replica Set" description={selectedReplicaSet ? ` ${selectedReplicaSet}` : ''} />
                        <Step title="Select Node" description={selectedNode ? ` ${selectedNode}` : ''} />
                    </Steps>

                    <Row justify="center" align="middle" style={{ marginTop: 10 }}>
                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <Select
                                value={selectedReplicaSet}
                                style={{ width: '100%', marginTop: 10 }}
                                showSearch
                                placeholder="Select a replica set"
                                onChange={handleReplSetChange}
                                filterOption={(input, option) =>
                                    option?.children
                                        ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                        : false
                                }
                                loading={loading}
                            >
                                {replSets.map(replSet => (
                                    <Option key={replSet} value={replSet}>{replSet}</Option>
                                ))}
                            </Select>
                        </Col>

                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <Select
                                popupMatchSelectWidth={false}
                                style={{ width: '100%', marginTop: 10 }}
                                showSearch
                                placeholder="Select a node"
                                onChange={handleNodeChange}
                                filterOption={(input, option) =>
                                    option?.children
                                        ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                        : false
                                }
                                value={selectedNode}
                                loading={loading}
                            >
                                {nodes.map(node => (
                                    <Option key={node.nodename} value={node.nodename}>{`${node.nodename} [${node.status}]`}</Option>
                                ))}
                            </Select>
                        </Col>
                    </Row>
                </Card>

            </div>
            <div>
                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <Tabs defaultActiveKey="3" onChange={handleTabChange}>

                        <TabPane tab="User Access List" key="3">

                            <Table
                                columns={columns}
                                dataSource={data}
                                pagination={{ pageSize: 50 }}
                                scroll={{ y: 650 }}
                                footer={() => (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button onClick={() => exportToCsv("users.csv", data)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                            <DownloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                            <span style={{ marginLeft: '5px', color: 'black' }}>Export CSV</span>
                                        </button>

                                    </div>
                                )}
                                title={() => (
                                    <div style={{ display: 'flex', alignItems: 'left' }}>
                                    </div>
                                )} />
                        </TabPane>

                        <TabPane tab="Queries (Current Ops)" key="5">
                            <div style={{ marginBottom: 16 }}>
                                <span>Seconds Running Filter: </span>
                                <InputNumber min={0} defaultValue={0} onChange={handleFilterChange} />
                                <button onClick={() => fetchActiveOps(selectedNode, filterValue)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                    <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                    <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                </button>
                            </div>
                            <Table
                                columns={columnsActiveOps}
                                dataSource={filteredData}
                                pagination={{ pageSize: 50 }}
                                scroll={{ y: 650 }}
                                footer={() => (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button onClick={() => fetchActiveOps(selectedNode, filterValue)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                            <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                            <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                        </button>
                                    </div>
                                )}
                                title={() => (
                                    <div style={{ display: 'flex', alignItems: 'left' }}>
                                        {/* Diğer başlık içerikleri */}
                                    </div>
                                )}
                            />

                        </TabPane>

                        <TabPane tab="System Resources" key="4">
                            <Row gutter={10}>
                                <Col span={8}>
                                    <Card title="CPU Usage" style={{ marginTop: 10 }}>
                                        <Progress type="dashboard" percent={roundedCpuUsage} strokeColor={twoColors} format={percent =>
                                            <span style={{ color: percent === 100 ? 'red' : 'inherit' }}>
                                                {percent}%
                                            </span>}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card title="Memory Usage" style={{ marginTop: 10 }}>
                                        <Progress type="dashboard" percent={roundedMemoryUsage} strokeColor={twoColors} />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card title="Load Average" style={{ marginTop: 10 }}>
                                        <p style={{ color: getColor(loadAverage.load1) }}>Last 1 minute: {loadAverage.load1}</p>
                                        <p style={{ color: getColor(loadAverage.load5) }}>Last 5 minutes: {loadAverage.load5}</p>
                                        <p style={{ color: getColor(loadAverage.load15) }}>Last 15 minutes: {loadAverage.load15}</p>
                                    </Card>
                                </Col>
                                <Col span={24}>
                                    <Card title="System Information" style={{ marginTop: 10 }}>
                                        <Row gutter={5}>
                                            {systemInfo && (
                                                <>
                                                    <Col span={8}><p><strong>CPU Type:</strong> {systemInfo.cpu_type}</p></Col>
                                                    <Col span={8}><p><strong>CPU Cores:</strong> {systemInfo.cpu_cores}</p></Col>
                                                    <Col span={8}><p><strong>Memory:</strong> {formatMemory(systemInfo.ram_total)}</p></Col>
                                                    <Col span={8}><p><strong>OS Distribution:</strong> {systemInfo.os_distribution}</p></Col>
                                                    <Col span={8}><p><strong>OS Version:</strong> {systemInfo.os_version}</p></Col>
                                                    <Col span={8}><p><strong>Uptime:</strong> {formatUptime(systemInfo.uptime)}</p></Col>
                                                </>
                                            )}
                                        </Row>
                                    </Card>
                                </Col>
                            </Row>
                        </TabPane>
                        <TabPane tab="Connections" key="6">
                            <Table
                                columns={connectionColumns}
                                dataSource={dataConnections}
                                pagination={{ pageSize: 50 }}
                                scroll={{ y: 650 }}
                                footer={() => (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button onClick={() => fetchMongoDBConnections(selectedNode)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                            <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                            <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                        </button>
                                    </div>
                                )}
                                title={() => (
                                    <div style={{ display: 'flex', alignItems: 'left' }}>
                                        {/* Diğer başlık içerikleri */}
                                    </div>
                                )}
                            />

                        </TabPane>
                    </Tabs>

                )}


            </div >
        </>

    );
};

export default MongoPA;
