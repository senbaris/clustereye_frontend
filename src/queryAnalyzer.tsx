import React, { useState, useEffect } from 'react';
import { Select, Table, message, Modal, Spin, Steps, Tooltip } from 'antd';
import axios from 'axios';
import { CopyOutlined } from '@ant-design/icons';
import { Key } from 'antd/es/table/interface';


const { Option } = Select;
const { Step } = Steps;


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

interface ReplicaSetData {
    [replicasetname: string]: NodeInfo[];
}


interface LogEntry {
    t: LogTimestamp;
    s: string;
    c: string;
    id: number;
    ctx: string;
    msg: string;
    planSummary: string;
    attr: LogAttributes;
    db: string;
}

interface LogTimestamp {
    $date: string;
}

interface LogAttributes {
    Type: string;
    Namespace: string;
    Command: unknown; // Detaylı bir yapıya sahip olduğundan dolayı `any` kullanabiliriz.
    durationMillis: number;
    planSummary: string;
    db: string;
    // Diğer gerekli alanlar...
}

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


const showCommandModal = (command: unknown) => {
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




const QueryAnalyzer: React.FC = () => {
    const [dbFilters, setDbFilters] = useState<{ text: string; value: string }[]>([]);
    const [replSets, setReplSets] = useState<string[]>([]);
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [selectedReplicaSet, setSelectedReplicaSet] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [logFiles, setLogFiles] = useState<string[]>([]);
    const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState(0);

    // Adımları sıfırlama fonksiyonu
    const resetSteps = () => {
        setSelectedReplicaSet(null);
        setSelectedNode(null);
        setLogFiles([]);
        setSelectedLogFile(null);
        setLogs([]);
        setCurrentStep(0);
        setLoading(false);
    };

    // Adımları sıfırlama fonksiyonu
    const resetLogFileStep = () => {
        setSelectedLogFile(null);
        setCurrentStep(2);
        setLoading(false);
    };

    const resetNodeStep = () => {
        setSelectedLogFile(null);
        setSelectedNode(null);
        setLogs([]);
        setCurrentStep(1);
        setLoading(false);
    };

    const truncateString = (str: string, num: number) => {
        if (str.length <= num) {
            return str;
        }
        return str.slice(0, num) + '...';
    };

    const columns = [
        {
            title: 'Timestamp',
            dataIndex: ['t', '$date'], // LogTimestamp içindeki $date alanına erişim
            key: 'timestamp',
            sorter: (a: LogEntry, b: LogEntry) => new Date(a.t.$date).getTime() - new Date(b.t.$date).getTime(),
            render: (date: string) => {
                const options: Intl.DateTimeFormatOptions = {
                    hour12: false, // 24 saat formatını kullan
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                };
                const readableDate = new Date(date).toLocaleString('en-US', options);
                return <span>{readableDate}</span>;
            }
        },
        {
            title: 'Severity',
            dataIndex: 's',
            key: 'severity',
            filters: [
                { text: 'Info', value: 'I' },
                { text: 'Warning', value: 'W' },
                { text: 'Error', value: 'E' },
                // Diğer seviyeler eklenebilir
            ],
            onFilter: (value: unknown, record: LogEntry) => record.s === value,
            render: (text: string) => {
                switch (text) {
                    case 'I':
                        return 'Info';
                    case 'W':
                        return 'Warning';
                    case 'E':
                        return 'Error';
                    default:
                        return text;
                }
            },
        },
        {
            title: 'Component',
            dataIndex: 'c',
            key: 'component',
        },
        {
            title: 'Context',
            dataIndex: 'ctx',
            key: 'context',
        },
        {
            title: 'Message',
            dataIndex: 'msg',
            key: 'message',
            sorter: (a: LogEntry, b: LogEntry) => a.msg.localeCompare(b.msg),
        },
        {
            title: 'Query Plan',
            dataIndex: ['attr', 'planSummary'],
            key: 'planSummary',
            filters: [
                { text: 'IXSCAN', value: 'IXSCAN' },
                { text: 'COLLSCAN', value: 'COLLSCAN' },
                // Daha fazla filtre eklenebilir
            ],
            onFilter: (value: boolean | React.Key, record: LogEntry) => {
                if (typeof value === 'string') {
                    return record.attr.planSummary.includes(value);
                }
                return false;
            },
        },
        {
            title: 'Database',
            dataIndex: ['attr', 'db'],
            key: 'db',
            filters: dbFilters, // Dinamik filtreler burada kullanılıyor
            onFilter: (value: Key | boolean, record: LogEntry) => record.attr.db === value,
        },
        {
            title: 'Duration (ms)',
            dataIndex: ['attr', 'durationMillis'], // LogAttributes içindeki durationMillis alanına erişim
            key: 'duration',
            sorter: (a: LogEntry, b: LogEntry) => {
                return a.attr.durationMillis - b.attr.durationMillis;
            }
        },
        {
            title: 'Query',
            dataIndex: ['attr', 'command'], // LogAttributes içindeki command alanına erişim
            key: 'query',
            render: (command: unknown) => (
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            ),
            // JSON objesini düzgün biçimlendirilmiş string olarak gösterir
        },
    ];

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
        const fetchParsedLogs = async () => {
            if (selectedNode && selectedLogFile) {
                setLoading(true);
                try {
                    const parseResponse = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/parse_mongo_log`, {
                        log_file_path: selectedLogFile,
                        hostname: selectedNode,
                    });

                    if (parseResponse.status === 200) {
                        // Parse edilmiş logları doğrudan setLogs ile tabloya aktar
                        if (parseResponse.data && parseResponse.data.length > 0) {
                            const enhancedLogs = parseResponse.data.map((log: LogEntry, index: number) => ({ ...log, uniqueId: index }));
                            setLogs(enhancedLogs);
                            // Benzersiz db adlarını çıkarma
                            const uniqueDbs = Array.from(new Set(enhancedLogs.map((log: LogEntry) => log.attr.db)));
                            const filters = uniqueDbs.map(db => ({ text: db as string, value: db as string }));
                            setDbFilters(filters);
                        } else {
                            // Eğer işlenmiş log yoksa, kullanıcıya uygun bir mesaj göster
                            message.info(parseResponse.data.message || 'Could not find slow query or collscan.');
                            setLogs([]);
                        }
                    } else {
                        message.error('Log parsing failed.');
                    }
                } catch (error) {
                    console.error('Error fetching logs:', error);
                    message.error('An error occurred during log processing.');
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchParsedLogs();
    }, [selectedNode, selectedLogFile]);


    const handleReplSetChange = (value: string) => {
        setSelectedReplicaSet(value);
        setLoading(true);
        fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/status`)
            .then(response => response.json())
            .then((data: { [key: string]: NodeInfo[] }[]) => {
                const nodesData = data.find((item) => Object.prototype.hasOwnProperty.call(item, value));
                if (nodesData && nodesData[value]) {
                    setNodes(nodesData[value]);
                    // İlk node'u otomatik olarak seç
                    if (nodesData[value].length > 0) {
                        setCurrentStep(1);
                    } else {
                        // Eğer node listesi boşsa, seçimi ve logları sıfırla
                        setSelectedNode('');
                        setLogFiles([]);
                    }
                } else {
                    setNodes([]);
                    setSelectedNode('');
                    setLogFiles([]);
                }
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching nodes data: ', error);
                setLoading(false);
                setNodes([]);
                setSelectedNode('');
                setLogFiles([]);
            });

        setSelectedLogFile(null);
        setLogs([]);
    };

    const handleLogFileChange = async (logFile: string) => {
        setSelectedLogFile(logFile);
        setCurrentStep(3);
        if (selectedNode && selectedLogFile) {
            setLoading(true);
            try {
                const parseResponse = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/parse_mongo_log`, {
                    log_file_path: logFile,
                    hostname: selectedNode,
                });

                if (parseResponse.status === 200) {
                    // Parse edilmiş logları doğrudan setLogs ile tabloya aktar
                    const enhancedLogs = parseResponse.data.map((log: LogEntry, index: number) => ({ ...log, uniqueId: index }));
                    setLogs(enhancedLogs);
                } else {
                    message.error('Log parsing failed.');
                }
            } catch (error) {
                console.error('Error fetching logs:', error);
                message.error('An error occurred during log processing.');
            } finally {
                setLoading(false);
            }
        }
    };



    const handleNodeChange = async (nodename: string) => {
        setSelectedNode(nodename);
        setCurrentStep(2);
        setLoading(true);

        try {
            // Axios ile POST isteği yaparak JSON body içinde nodename gönder
            const response = await axios.post(`https://dbstatus-api.hepsi.io/get_mongo_logs`, {
                nodename: nodename // Burada JSON body içinde nodename kullan
            });

            if (response.data && response.data.recentFiles) {
                setLogFiles(response.data.recentFiles);
            } else {
                // Yanıt beklenen yapıda değilse, hata mesajı göster
                message.error('No log files found for the selected node');
            }
        } catch (error) {
            console.error('Error fetching log files:', error);
            message.error('Failed to fetch log files');
        } finally {
            setLoading(false);
        }
    };


    return (

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Steps current={currentStep}>
                <Step title="Select Replica Set" description={selectedReplicaSet ? ` ${selectedReplicaSet}` : ''} />
                <Step title="Select Node" description={selectedNode ? ` ${selectedNode}` : ''} />
                <Step
                    title="Select Log File"
                    description={
                        selectedLogFile ? (
                            <Tooltip title={selectedLogFile}>
                                {`${truncateString(selectedLogFile, 15)}`}
                            </Tooltip>
                        ) : ''
                    }
                />
            </Steps>

            {currentStep === 0 && (
                <Select
                    style={{ width: '25%', marginTop: 20 }}
                    showSearch
                    placeholder="Select a replica set"
                    optionFilterProp="children"
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
            )}

            {currentStep === 1 && selectedReplicaSet && (
                <Select
                    popupMatchSelectWidth={false}
                    style={{ width: '25%', marginTop: 20 }}
                    showSearch
                    placeholder="Select a node"
                    onChange={handleNodeChange}
                    optionFilterProp="children"
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
            )}

            {currentStep === 2 && selectedNode && (
                <Select
                    showSearch
                    placeholder="Select a log file"
                    style={{ width: '30%', marginTop: 20 }}
                    onChange={handleLogFileChange}
                    filterOption={(input, option) =>
                        option?.children
                            ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                            : false
                    }
                    loading={loading}
                >
                    {logFiles.map((logFile, index) => (
                        <Option key={index} value={logFile}>{logFile}</Option>
                    ))}
                </Select>
            )}

            <div style={{ margin: '20px 0' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    Array.isArray(logs) && logs.length > 0 && (
                        <Table
                            columns={columns}
                            dataSource={logs}
                            rowKey="uniqueId"
                            pagination={{ pageSize: 50 }}
                            scroll={{ y: 650 }}
                        />
                    )
                )}
            </div>
            {currentStep === 3 && (
                <div style={{ marginTop: 5 }}>
                    <button onClick={resetSteps} style={{ marginRight: 10 }}>
                        Start Over
                    </button>
                    <button onClick={resetLogFileStep}>
                        Select New Log File
                    </button>
                    <button onClick={resetNodeStep} style={{ marginLeft: 10 }}>
                        Select New Node
                    </button>
                </div>
            )}

        </div>
    );
};

export default QueryAnalyzer;
