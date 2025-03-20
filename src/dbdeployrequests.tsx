import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Modal, message, Select } from 'antd';
import axios from 'axios';
import './index.css';
import IconPostgres from './icons/postgresql';
import IconMongo from './icons/mongo';
import { DatabaseOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';


interface Server {
    id: number;
    ip: string;
    hostname: string;
    dbversion: string;
    dbtype: string;
    cluster_type: string;
    team: string;
    status: string;
    logfile: string;
    hostnames?: string[];
    req_id: string;
}

interface GroupedServer {
    team: string;
    dbtype: string;
    cluster_type: string;
    dbversion: string;
    status: string;
    id: number;
    logfile: string;
    hostname: string;
    req_id: string;
}

const DbDeploys: React.FC = () => {
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const POLLING_INTERVAL = 10000; // 10 seconds
    const [modalVisible, setModalVisible] = useState(false);
    const [logContent, setLogContent] = useState("");
    const [currentLogFile, setCurrentLogFile] = useState<string | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [selectedSteps, setSelectedSteps] = useState<{ [key: number]: string }>({});
    const [steps, setSteps] = useState<{ [key: number]: string[] }>({});


    const fetchServers = async () => {
        setLoading(true);
        try {
            const response = await axios.get<Server[]>(`${import.meta.env.VITE_REACT_APP_API_URL}/get_dbdeploy_requests`);
            setServers(response.data);
        } catch (error) {
            console.error('Failed to load servers:', error);
            message.error('Failed to load servers');
        } finally {
            setLoading(false);
        }
    };

    const fetchSteps = async (id: number, dbtype: string) => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/get_playbook_steps`, { params: { dbtype } });
            setSteps(prevSteps => ({ ...prevSteps, [id]: ['from beginning', ...response.data.steps] }));
        } catch (error) {
            console.error('Failed to load playbook steps:', error);
            message.error('Failed to load playbook steps');
        }
    };

    useEffect(() => {
        fetchServers(); // initial fetch

        const intervalId = setInterval(fetchServers, POLLING_INTERVAL); // subsequent fetches

        return () => clearInterval(intervalId); // cleanup on unmount
    }, []);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logContent]);

    const handleApprove = async (id: number, req_id: string, dbtype: string, dbversion: string) => {

        const hostnames = servers.filter(server => server.req_id === req_id).map(server => server.hostname);

        if (!hostnames.length) {
            console.error('Hostnames are null or undefined');
            message.error('Hostnames are null or undefined');
            return;
        }

        let step = selectedSteps[id] || "from beginning";
        if (step !== "from beginning") {
            step = step.replace('- name: ', '');
        }

        const payload = {
            id, req_id, dbtype, dbversion, hostnames, step, clusterType: groupedData[req_id][dbtype][0].cluster_type // Bu satırı ekledim, clusterType alanını payload'a ekliyoruz
        };
        console.log('Payload:', payload);

        try {
            const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/approve`, payload);
            const logFileName = response.data.logFileName;

            if (!logFileName) {
                throw new Error("Log file name is undefined");
            }

            setCurrentLogFile(logFileName); // Set current log file for abort

            message.success('Server approval initiated, check logs for progress');

            fetchServers();

        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 409) {
                message.error("Server is already being processed");
            } else {
                console.error(error);
                message.error("Failed to approve server");
            }
            fetchServers();
        }
    };

    const handleReject = async (req_id: string, dbtype: string) => {
        const hostnames = servers.filter(server => server.req_id === req_id && server.dbtype === dbtype).map(server => server.hostname);

        if (!hostnames.length) {
            console.error('Hostnames are null or undefined');
            message.error('Hostnames are null or undefined');
            return;
        }

        try {
            const payload = { hostnames };
            await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/reject`, payload);
            message.success('Server rejected');
            fetchServers(); // Refetch data after rejecting
        } catch (error) {
            console.error('Failed to reject server:', error);
            message.error('Failed to reject server');
        }
    };

    const colorizeLog = (log: string): React.ReactNode => {
        const lines = log.split('\n');
        return lines.map((line, index) => {
            let color = 'white';
            if (line.includes('TASK')) color = 'cyan';
            else if (line.includes('ok:')) color = 'lightgreen';
            else if (line.includes('changed:')) color = 'orange';
            else if (line.includes('fatal:') || line.includes('ERROR')) color = 'red';
            else if (line.includes('PLAY RECAP')) color = 'blue';

            return (
                <div key={index} style={{ color }}>
                    {line}
                </div>
            );
        });
    };

    const handleAbort = async () => {
        if (!currentLogFile) {
            message.error('No log file to abort');
            return;
        }

        try {
            await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/abort`, { logFileName: currentLogFile });
            message.success('Process aborted');
            fetchServers();
        } catch (error) {
            console.error('Failed to abort process:', error);
            message.error('Failed to abort process');
        }
    };



    const handleLogClick = async (logfile: string, status: string) => {
        try {
            setLogContent(''); // Mevcut log içeriğini temizle
            setCurrentLogFile(logfile); // Güncel log dosyasını ayarla

            if (status === "done" || status === "failed!") {
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/get_log_content`, {
                    params: { logfile: logfile, status }
                });
                setLogContent(response.data.content); // Log içeriğini ayarla
                setModalVisible(true);
            } else {
                // Yeni EventSource oluşturma ve logları dinleme
                const eventSource = new EventSource(`${import.meta.env.VITE_REACT_APP_API_URL}/stream?logfile=${logfile}`);
                eventSource.onmessage = (event) => {
                    const data = event.data;
                    setLogContent(prevContent => prevContent + data + '\n');

                    if (logContainerRef.current) {
                        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                    }
                };
                eventSource.onerror = (event) => {
                    console.error('EventSource failed:', event);
                    eventSource.close();
                };

                eventSource.addEventListener('open', () => {
                    console.log('EventSource connection opened');
                });

                eventSource.addEventListener('error', (error) => {
                    console.error('EventSource error:', error);
                });

                setModalVisible(true); // Modal'ı aç
            }
        } catch (error) {
            console.error('Failed to load log content:', error);
            message.error('Failed to load log content');
        }
    };

    const groupByReqId = (data: Server[]) => {
        const groupedData: { [key: string]: { [key: string]: Server[] } } = {};
        data.forEach(server => {
            if (!groupedData[server.req_id]) {
                groupedData[server.req_id] = {};
            }
            if (!groupedData[server.req_id][server.dbtype]) {
                groupedData[server.req_id][server.dbtype] = [];
            }
            groupedData[server.req_id][server.dbtype].push(server);
        });
        return groupedData;
    };

    const groupedData = groupByReqId(servers);

    const columns = [
        { title: 'Team', dataIndex: 'team', key: 'team' },
        {
            title: 'DB Type',
            dataIndex: 'dbtype',
            key: 'dbtype',
            render: (text: string, _: any, index: number) => (
                <>
                    {text === 'PostgreSQL' && <IconPostgres key={`icon1${index}`} size="30" color="#4267B2" />}
                    {text === 'MongoDB' && <IconMongo key={`icon2${index}`} size="30" color="#47A248" />}
                    {text !== 'PostgreSQL' && text !== 'MongoDB' && <DatabaseOutlined key={`icon3${index}`} style={{ fontSize: '25px', color: '#1890ff' }} />}
                </>
            ),
        },
        { title: 'Cluster Type', dataIndex: 'cluster_type', key: 'cluster_type' },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            filters: [
                { text: 'Installing', value: 'installing...' },
                { text: 'Pending', value: 'pending' },
                { text: 'Approved', value: 'approved' },
                { text: 'Rejected', value: 'rejected' },
                { text: 'Failed', value: 'failed!' },
                { text: 'Done', value: 'done' },
            ],
            onFilter: (value: boolean | React.Key, record: GroupedServer) => record.status === value,
            render: (text: string, record: GroupedServer): React.ReactNode => (
                <>
                    {record.status === 'installing...' ? (
                        <span>
                            <LoadingOutlined
                                style={{ marginRight: 8, color: '#faad14' }}
                                onClick={() => {
                                    handleLogClick(record.logfile, record.status);
                                }}
                            />
                            installing...
                        </span>
                    ) : record.status === 'failed!' ? (
                        <span>
                            <ExclamationCircleOutlined
                                style={{ marginRight: 8, color: '#ff4d4f' }}
                                onClick={() => {
                                    handleLogClick(record.logfile, record.status);
                                }}
                            />
                            failed!
                        </span>
                    ) : record.status === 'done' ? (
                        <span>
                            <CheckCircleOutlined
                                style={{ marginRight: 8, color: '#52c41a' }}
                                onClick={() => {
                                    handleLogClick(record.logfile, record.status);
                                }}
                            />
                            done
                        </span>
                    ) : record.status === 'pending' ? (
                        <span>
                            <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
                            pending
                        </span>
                    ) : record.status === 'approved' ? (
                        <span>
                            <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                            approved
                        </span>
                    ) : record.status === 'rejected' ? (
                        <span>
                            <CloseCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                            rejected
                        </span>
                    ) : (
                        <span>{text}</span>
                    )}
                </>
            ),
        },
        
        {
            title: 'Actions',
            key: 'actions',
            render: (record: GroupedServer): React.ReactNode => (
                <>
                    <Select
                        placeholder="Select step"
                        value={selectedSteps[record.id] || 'from beginning'}
                        onChange={(value) => setSelectedSteps(prev => ({ ...prev, [record.id]: value }))}
                        style={{ marginRight: 8, width: '200px' }}
                        onClick={() => fetchSteps(record.id, record.dbtype)} // Fetch steps when the dropdown is clicked
                    >
                        {steps[record.id]?.map((step, index) => (
                            <Select.Option value={step} key={`${step}_${index}`}>
                                {step}
                            </Select.Option>
                        ))}
                    </Select>

                    {record.status === 'failed!' ? (
                        <Button
                            type="primary"
                            onClick={() => handleApprove(record.id, record.req_id, record.dbtype, record.dbversion)}
                            style={{ marginRight: 8 }}
                        >
                            Retry
                        </Button>
                    ) : record.status === 'done' ? (
                        <Button
                            type="primary"
                            onClick={() => {
                                Modal.confirm({
                                    title: 'Yeniden kurmak istediğinize emin misiniz?',
                                    onOk() {
                                        handleApprove(record.id, record.req_id, record.dbtype, record.dbversion);
                                    },
                                    onCancel() { },
                                });
                            }}
                            style={{ marginRight: 8 }}
                        >
                            Reinstall
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            onClick={() => handleApprove(record.id, record.req_id, record.dbtype, record.dbversion)}
                            style={{ marginRight: 8, backgroundColor: '#4faa40', borderColor: '#4faa40' }} // Approve button rengini yeşil yap
                        >
                            Approve
                        </Button>
                    )}
                    <Button
                        type="default"
                        danger
                        onClick={() => handleReject(record.req_id, record.dbtype)}
                    >
                        Reject
                    </Button>
                </>
            ),
        }
    ];

    const expandedRowRender = (record: GroupedServer) => {
        const details = groupedData[record.req_id][record.dbtype];

        const columns = [
            { title: 'Hostname', dataIndex: 'hostname', key: 'hostname' },
            { title: 'IP', dataIndex: 'ip', key: 'ip' },
            { title: 'DB Version', dataIndex: 'dbversion', key: 'dbversion' },
        ];

        return <Table columns={columns} dataSource={details} pagination={false} className="expanded-row" rowKey="id" />;
    };

    const groupedServers: GroupedServer[] = Object.keys(groupedData).flatMap((req_id, reqIndex) =>
        Object.keys(groupedData[req_id]).map((dbtype, dbtypeIndex) => {
            const server = groupedData[req_id][dbtype][0]; // İlk server verisini kullanarak eksik alanları al
            return {
                id: reqIndex * 100 + dbtypeIndex, // Benzersiz bir sayı değeri kullanarak id oluşturun
                req_id,
                dbtype,
                dbversion: server.dbversion,
                status: server.status,
                team: server.team,
                cluster_type: server.cluster_type,
                logfile: server.logfile,
                hostname: server.hostname
            };
        })
    );

    // Durumlara göre sıralama fonksiyonu
    const statusOrder: { [key: string]: number } = {
        "installing...": 1,
        "pending": 2,
        "approved": 3,
        "rejected": 4,
        "failed!": 5,
        "done": 6,
    };
    const sortedServers = groupedServers.sort((a, b) => {
        return statusOrder[a.status.toLowerCase()] - statusOrder[b.status.toLowerCase()];
    });

    return (
        <>
            <Table
                dataSource={sortedServers}
                columns={columns}
                rowKey="id"
                loading={loading}
                expandedRowRender={expandedRowRender}
                pagination={{ pageSize: 10 }}
            />
            <Modal
                title="Log Output"
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={1200}
                style={{ top: 20 }}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', backgroundColor: 'black' }}
            >
                <div
                    ref={logContainerRef}
                    style={{ maxHeight: '70vh', overflowY: 'auto' }}
                >
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                        {colorizeLog(logContent)}
                    </pre>
                </div>
                <Button type="primary" danger onClick={handleAbort} style={{ marginTop: 10 }}>
                    Abort
                </Button>
            </Modal>
        </>
    );
};

export default DbDeploys;
