import React, { useState, useEffect } from 'react';
import {
    Divider, Select, Spin, Table, Button, Tabs, message,
    Collapse, Tag, Card, Statistic, Row, Col, Input, Modal, Steps, Tooltip, Alert, Slider
} from 'antd';
import axios from 'axios';
import {
    ReloadOutlined, FileSearchOutlined, BarChartOutlined,
    AlertOutlined, ClockCircleOutlined, CopyOutlined, ArrowDownOutlined, ArrowUpOutlined
} from '@ant-design/icons';
import { Key } from 'antd/es/table/interface';

const { Option } = Select;
const { Step } = Steps;
const { Panel } = Collapse;
const { Search } = Input;
const { TabPane } = Tabs;

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
    Hostname?: string;
    NodeStatus?: string;
    Location?: string;
    IP?: string;
    MongoStatus?: string;
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
    query?: any;
    command?: any;
}

interface LogFile {
    fileName: string;
    fileSize: string;
    path: string;
    lastModified: Date;
    displayName: string;
}

function syntaxHighlight(json: unknown): string {
    if (json === undefined || json === null) {
        return '<span class="null">null</span>';
    }
    
    let jsonString: string;

    // Eğer json bir string değilse, onu string'e çevir
    if (typeof json !== 'string') {
        try {
            jsonString = JSON.stringify(json, undefined, 2);
        } catch (error) {
            console.error("JSON stringification error:", error);
            return `<span class="error">Error: Could not stringify object</span>`;
        }
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
    // Command null veya undefined ise, boş bir obje göster
    if (command === undefined || command === null) {
        command = { message: "No command data available" };
    }
    
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
                <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(command) }}></pre>
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

// EmptyLogResults bileşenini güncelleyelim
const EmptyLogResults = ({ 
    onRefresh, 
    fileName, 
    threshold,
    onThresholdChange 
}: { 
    onRefresh: () => void, 
    fileName?: string,
    threshold?: number,
    onThresholdChange?: (value: number) => void 
}) => (
  <div style={{ 
    textAlign: 'center', 
    padding: '30px',
    background: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #f0f0f0',
    margin: '20px 0'
  }}>
    <div style={{ marginBottom: '20px', fontSize: '16px' }}>
      <FileSearchOutlined style={{ fontSize: '36px', color: '#1890ff', display: 'block', margin: '0 auto 16px' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '18px' }}>
        {fileName ? `"${fileName.split('/').pop()}" dosyasını analiz etmeye hazır` : 'Log dosyası seçildi'}
      </div>
      <div style={{ color: '#666', fontSize: '14px', marginBottom: 24 }}>
        Bu log dosyasını analiz etmek için aşağıdaki yavaş sorgu eşiğini ayarlayın ve "Analiz Et" butonuna tıklayın.
      </div>
    </div>
    
    {/* Threshold slider */}
    {threshold !== undefined && onThresholdChange && (
      <div style={{ maxWidth: 500, margin: '0 auto', marginBottom: 30, background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #d9d9d9' }}>
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Slow Query Threshold: <span style={{ color: '#1890ff' }}>{threshold} ms</span></span>
        </div>
        <Slider
          min={10}
          max={1000}
          step={10}
          value={threshold}
          onChange={onThresholdChange}
          marks={{
            10: '10ms',
            100: '100ms',
            500: '500ms',
            1000: '1s'
          }}
          tooltipVisible
          tooltipPlacement="bottom"
        />
        <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '12px' }}>
          Yavaş sorgu sayılacak minimum süreyi belirleyin (10ms - 1000ms)
        </div>
      </div>
    )}
    
    <Button 
      type="primary" 
      icon={<ReloadOutlined />} 
      onClick={onRefresh}
      size="large"
      style={{ 
        fontSize: '16px', 
        height: '44px', 
        paddingLeft: '24px', 
        paddingRight: '24px',
        fontWeight: 'bold',
        boxShadow: '0 2px 10px rgba(24, 144, 255, 0.5)'
      }}
    >
      Analiz Et ve Sonuçları Göster
    </Button>
    <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
      Eşik değeri belirlendikten sonra analiz başlayacaktır.
    </div>
  </div>
);

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
    const [fetchingReplSets, setFetchingReplSets] = useState<boolean>(false);
    const [fetchingNodes, setFetchingNodes] = useState<boolean>(false);
    const [fetchingLogFiles, setFetchingLogFiles] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedDb, setSelectedDb] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
    const [stats, setStats] = useState({
        totalQueries: 0,
        avgExecutionTime: 0,
        slowestQuery: { query: '', time: 0 },
        collscanOps: 0,
        mostFrequentDb: '',
        topNamespaces: [] as { namespace: string; count: number }[],
        topOperationTypes: [] as { type: string; count: number }[]
    });
    const [logFileStats, setLogFileStats] = useState({
        errorCount: 0,
        infoCount: 0,
        warningCount: 0,
        totalCount: 0
    });
    const [logFileStatsList, setLogFileStatsList] = useState<LogFile[]>([]);
    const [slowQueryThreshold, setSlowQueryThreshold] = useState<number>(100); // Varsayılan 100ms

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
            render: (command: unknown) => {
                // Command null veya undefined ise, bir bilgi mesajı göster
                if (command === undefined || command === null) {
                    return <span style={{ color: '#999' }}>No query data</span>;
                }
                return (
                    <button onClick={() => showCommandModal(command)}>Show Query</button>
                );
            },
            // JSON objesini düzgün biçimlendirilmiş string olarak gösterir
        },
    ];

    // Replica set verilerini almak için API çağrısı
    const fetchReplicaSets = async () => {
        setFetchingReplSets(true);
        setLoading(true);
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/mongo`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            console.log('MongoDB API response:', response.data);

            if (response.data.status === "success" && Array.isArray(response.data.data)) {
                // Yeni API yanıt formatını işle
                const fetchedReplSets = response.data.data.map(
                    (replicaSetObject: any) => Object.keys(replicaSetObject)[0]
                );
                setReplSets(fetchedReplSets);
            } else if (Array.isArray(response.data)) {
                // Eski format hala destekli
                const fetchedReplSets = response.data.map(
                    (replicaSetObject: ReplicaSetData) => Object.keys(replicaSetObject)[0]
                );
                setReplSets(fetchedReplSets);
            } else {
                throw new Error("Unexpected API response format");
            }
        } catch (error) {
            console.error('Error fetching replica sets:', error);
            message.error('Failed to fetch replica sets. Please try again.');
            setReplSets([]);
        } finally {
            setFetchingReplSets(false);
            setLoading(false);
        }
    };

    // Component mount olduğunda Replica Set verilerini al
    useEffect(() => {
        fetchReplicaSets();
    }, []);

    // Replica Set değiştiğinde node'ları getir
    const handleReplSetChange = async (value: string) => {
        setSelectedReplicaSet(value);
        setFetchingNodes(true);
        setLoading(true);

        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/mongo`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            let foundNodes: NodeInfo[] = [];

            if (response.data.status === "success" && Array.isArray(response.data.data)) {
                // Yeni API formatı
                const cluster = response.data.data.find(
                    (cluster: any) => Object.keys(cluster)[0] === value
                );

                if (cluster) {
                    const clusterName = Object.keys(cluster)[0];
                    const nodeList = cluster[clusterName];

                    // Her node'u NodeInfo formatına dönüştür
                    foundNodes = nodeList.map((node: any) => ({
                        nodename: node.Hostname || "unknown",
                        dbAgentStatus: node.MongoStatus || "UNKNOWN",
                        dc: node.Location || "Unknown",
                        freediskdata: node.FreeDisk || "N/A",
                        freediskpercent: node.FDPercent?.toString() || "0",
                        ip: node.IP || "N/A",
                        status: node.NodeStatus || "UNKNOWN",
                        totalDiskSize: node.TotalDisk || "N/A",
                        version: node.MongoVersion || "N/A",
                        // Orijinal alanları da sakla
                        Hostname: node.Hostname,
                        NodeStatus: node.NodeStatus,
                        Location: node.Location,
                        IP: node.IP,
                        MongoStatus: node.MongoStatus
                    }));
                }
            } else if (Array.isArray(response.data)) {
                // Eski API formatı
                const nodesData = response.data.find((item) => Object.prototype.hasOwnProperty.call(item, value));
                if (nodesData && nodesData[value]) {
                    foundNodes = nodesData[value];
                }
            }

            setNodes(foundNodes);

            // İlk node'u otomatik olarak seç
            if (foundNodes.length > 0) {
                setCurrentStep(1);
            } else {
                // Eğer node listesi boşsa, seçimi ve logları sıfırla
                message.warning('No nodes found for the selected replica set');
                setSelectedNode(null);
                setLogFiles([]);
            }
        } catch (error) {
            console.error('Error fetching nodes data:', error);
            message.error('Failed to fetch nodes data');
            setNodes([]);
            setSelectedNode(null);
            setLogFiles([]);
        } finally {
            setFetchingNodes(false);
            setLoading(false);
        }

        // Seçilen log dosyasını ve logları sıfırla
        setSelectedLogFile(null);
        setLogs([]);
    };

    // Verileri yenile butonu için fonksiyon
    const handleRefreshData = async () => {
        if (currentStep === 0) {
            await fetchReplicaSets();
        } else if (currentStep === 1 && selectedReplicaSet) {
            await handleReplSetChange(selectedReplicaSet);
        } else if (currentStep === 2 && selectedNode) {
            await handleNodeChange(selectedNode);
        } else if (currentStep === 3 && selectedLogFile) {
            await handleLogFileChange(selectedLogFile);
        }
    };

    const handleNodeChange = async (nodename: string) => {
        console.log(`handleNodeChange called with node: ${nodename}, current step will be set to 2`);
        setSelectedNode(nodename);
        setCurrentStep(2);
        setFetchingLogFiles(true);
        setLoading(true);

        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');
            
            // Agent ID formatına dönüştür
            const agentId = `agent_${nodename}`;
            console.log(`Fetching logs for agent: ${agentId}`);
            
            // Endpoint'i kullan
            const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mongo/logs`;
            console.log(`API URL: ${apiUrl}`);
            
            const response = await axios.get(
                apiUrl, 
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            console.log('Log files API response:', response);
            console.log('Log files response data:', response.data);

            if (response.data && response.data.status === 'success' && Array.isArray(response.data.log_files)) {
                // API yanıtından log dosya bilgilerini doğrudan çıkar
                const logFilesData = response.data.log_files;
                console.log(`Found ${logFilesData.length} log files in API response`);
                
                const logFilesInfo: LogFile[] = [];
                
                // Her bir log dosyası için bilgileri kaydet - ARTIK FİLTRELEME YAPMA
                logFilesData.forEach((file: any) => {
                    console.log(`Processing file: ${file.path}`);
                    
                    // Tüm log dosyalarını kabul et, filtreleme yapma
                    logFilesInfo.push({
                        fileName: file.name,
                        fileSize: file.size_readable || `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                        path: file.path,
                        lastModified: new Date(file.last_modified * 1000),
                        displayName: `${file.name} (${file.size_readable || (file.size / (1024 * 1024)).toFixed(2) + ' MB'})`
                    });
                });
                
                console.log(`After processing, we have ${logFilesInfo.length} log files`);
                
                // Log dosyalarını son değiştirilme tarihine göre sırala (en yeni en üstte)
                logFilesInfo.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
                
                if (logFilesInfo.length > 0) {
                    // Sadece path'leri kaydet
                    const filePaths = logFilesInfo.map(info => info.path);
                    console.log('Setting log files paths:', filePaths);
                    setLogFiles(filePaths);
                    
                    // İstatistikleri kaydet
                    console.log('Setting log files stats list:', logFilesInfo);
                    setLogFileStatsList(logFilesInfo);
                    
                    // Otomatik seçim yapmıyoruz, kullanıcının seçmesini bekliyoruz
                    setSelectedLogFile(null);
                    
                    message.success(`Found ${logFilesInfo.length} log files. Please select one to analyze.`);
                } else {
                    message.info('No log files found for the selected node');
                    setLogFiles([]);
                    setLogFileStatsList([]);
                }
            } else {
                // Yanıt beklenen yapıda değilse, hata mesajı göster
                console.error('Invalid API response format:', response.data);
                message.error('Invalid response format when fetching log files');
                setLogFiles([]);
                setLogFileStatsList([]);
            }
        } catch (error) {
            console.error('Error fetching log files:', error);
            message.error('Failed to fetch log files');
            setLogFiles([]);
            setLogFileStatsList([]);
        } finally {
            setFetchingLogFiles(false);
            setLoading(false);
        }
    };

    // Log dosyası seçildiğinde çağrılacak handler
    const handleLogFileChange = async (logFile: string) => {
        setSelectedLogFile(logFile);
        setCurrentStep(3);

        console.log(`Selected log file: ${logFile}`);
        
        // Artık dosya seçildiğinde otomatik analiz başlatmıyoruz
        // Kullanıcının threshold'u ayarlayıp analiz butonuna tıklamasını bekliyoruz
        message.success('Log file selected. Set the slow query threshold and click "Analyze" to start analysis.');
        
        // EmptyLogResults bileşeni gösterilerek kullanıcının threshold ayarlaması sağlanacak
    };

    // Log dosyasını analiz etmek için API çağrısı
    const fetchParsedLogs = async (hostname: string, logFilePath: string) => {
        if (!hostname || !logFilePath) return;
        
        console.log(`Starting to analyze log file: "${logFilePath}" for node: "${hostname}" with threshold: ${slowQueryThreshold}ms`);
        console.log(`Log file name: ${logFilePath.split('/').pop()}`);
        
        setLoading(true);
        setLogs([]);
        
        try {
            const token = localStorage.getItem('token');
            const agentId = `agent_${hostname}`;
            
            // API endpoint'i hazırla - yeni endpoint: mongo/logs/analyze
            const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mongo/logs/analyze`;
            console.log(`Sending request to: ${apiUrl} with log_file_path: ${logFilePath} and threshold: ${slowQueryThreshold}ms`);
            
            const response = await axios.post(
                apiUrl,
                {
                    log_file_path: logFilePath,
                    slow_query_threshold_ms: slowQueryThreshold // Kullanıcının belirlediği eşik değeri
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    timeout: 60000 // 60 saniye timeout
                }
            );

            console.log('Analyze API response status:', response.status, response.statusText);
            console.log('Analyze API response data:', response.data);

            // Dosya istatistiklerini kaydet
            if (response.data && response.data.status === 'success') {
                setLogFileStats({
                    errorCount: response.data.error_count || 0,
                    infoCount: response.data.info_count || 0,
                    warningCount: response.data.warning_count || 0,
                    totalCount: response.data.log_entries ? response.data.log_entries.length : 0
                });
            }

            if (response.status === 200) {
                // API yanıtını kontrol et
                if (response.data && response.data.status === 'success' && Array.isArray(response.data.log_entries)) {
                    // API'den gelen log kayıtlarını işle
                    const logEntries = response.data.log_entries;
                    console.log(`Parsed ${logEntries.length} log entries`);
                    
                    if (logEntries.length > 0) {
                        // API yanıtını LogEntry formatına çevir
                        const enhancedLogs = logEntries.map((entry: any, index: number) => {
                            // Timestamp'i LogTimestamp formatına çevir
                            const timestamp = entry.timestamp_readable || new Date(entry.timestamp * 1000).toISOString();
                            
                            // Command alanı için güvenlik kontrolü yap
                            let command = entry.command;
                            if (command === undefined || command === null) {
                                command = {}; // Varsayılan boş obje
                            }
                            
                            return {
                                uniqueId: index,
                                t: { $date: timestamp },
                                s: entry.severity || 'I',
                                c: entry.component || '',
                                ctx: entry.context || '',
                                id: index,
                                msg: entry.message || '',
                                planSummary: entry.plan_summary || '',
                                attr: {
                                    Type: 'query',
                                    Namespace: entry.namespace || '',
                                    Command: command,
                                    durationMillis: entry.duration_millis || 0,
                                    planSummary: entry.plan_summary || '',
                                    db: entry.db_name || ''
                                },
                                db: entry.db_name || ''
                            };
                        });
                        
                        setLogs(enhancedLogs);
                        setFilteredLogs(enhancedLogs);
                        
                        // Benzersiz db adlarını çıkar
                        const uniqueDbs = Array.from(
                            new Set(
                                enhancedLogs
                                    .filter((log: LogEntry) => log.attr && log.attr.db)
                                    .map((log: LogEntry) => log.attr.db)
                            )
                        );
                        
                        const filters = uniqueDbs.map(db => ({ 
                            text: db as string, 
                            value: db as string 
                        }));
                        
                        setDbFilters(filters);
                        
                        message.success(`${enhancedLogs.length} log entries loaded and analyzed`);
                    } else {
                        message.info('No query logs found in the selected file');
                    }
                } else if (response.data && response.data.status === 'error') {
                    // API'nin döndüğü hata mesajını göster
                    const errorMessage = response.data.error || 'Error analyzing log file';
                    console.error('API returned error:', errorMessage);
                    message.error(`Failed to analyze log: ${errorMessage}`);
                } else {
                    // API yanıtı uygun formatta değil
                    console.warn('Unexpected response format:', response.data);
                    message.warning('The log file was processed but no analyzable entries were found');
                }
            } else {
                message.error(`Log analysis failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error analyzing logs:', error);
            if (axios.isAxiosError(error) && error.response) {
                message.error(`Error: ${error.response.status} - ${error.response.statusText}`);
                console.error('Error response data:', error.response.data);
            } else {
                message.error('An error occurred during log analysis');
            }
        } finally {
            setLoading(false);
        }
    };

    // selectedNode veya selectedLogFile değiştiğinde log parsing işlemini tekrar çalıştır
    useEffect(() => {
        if (selectedNode && selectedLogFile) {
            fetchParsedLogs(selectedNode, selectedLogFile);
        }
    }, [selectedNode, selectedLogFile]);

    // Log verilerini filtreleme fonksiyonu
    const filterLogs = () => {
        if (!logs || logs.length === 0) {
            setFilteredLogs([]);
            return;
        }

        let results = [...logs];

        // Database filtresi uygula
        if (selectedDb) {
            results = results.filter(log =>
                log.attr && log.attr.db === selectedDb
            );
        }

        // Metin araması uygula
        if (searchText) {
            const searchLower = searchText.toLowerCase();
            results = results.filter(log =>
                (log.msg && log.msg.toLowerCase().includes(searchLower)) ||
                (log.attr && log.attr.query && JSON.stringify(log.attr.query).toLowerCase().includes(searchLower)) ||
                (log.attr && log.attr.command && JSON.stringify(log.attr.command).toLowerCase().includes(searchLower)) ||
                (log.attr && log.attr.Namespace && log.attr.Namespace.toLowerCase().includes(searchLower))
            );
        }

        setFilteredLogs(results);
    };

    // Logs veya filtreler değiştiğinde filtreleri uygula
    useEffect(() => {
        filterLogs();
        calculateStats();
    }, [logs, selectedDb, searchText]);

    // İstatistikleri hesapla
    const calculateStats = () => {
        if (!logs || logs.length === 0) {
            setStats({
                totalQueries: 0,
                avgExecutionTime: 0,
                slowestQuery: { query: '', time: 0 },
                collscanOps: 0,
                mostFrequentDb: '',
                topNamespaces: [],
                topOperationTypes: []
            });
            return;
        }

        // Toplam sorgu sayısı
        const totalQueries = logs.length;

        // Ortalama yürütme süresi
        let totalExecutionTime = 0;
        let slowestQuery = { query: '', time: 0 };
        let collscanOps = 0;
        const dbCounts: Record<string, number> = {};
        const namespaces: Record<string, number> = {};
        const operationTypes: Record<string, number> = {};

        logs.forEach(log => {
            // Yürütme süresi 
            if (log.attr && log.attr.durationMillis) {
                totalExecutionTime += log.attr.durationMillis;

                // En yavaş sorguyu bul
                if (log.attr.durationMillis > slowestQuery.time) {
                    slowestQuery = {
                        query: log.attr.query ? JSON.stringify(log.attr.query) :
                            log.attr.command ? JSON.stringify(log.attr.command) :
                                log.msg || '',
                        time: log.attr.durationMillis
                    };
                }
            }

            // COLLSCAN sayısını bul
            if (log.attr && (
                (log.attr.planSummary && log.attr.planSummary.includes('COLLSCAN')) ||
                (log.msg && log.msg.includes('COLLSCAN'))
            )) {
                collscanOps++;
            }

            // Veritabanı istatistiği
            if (log.attr && log.attr.db) {
                dbCounts[log.attr.db] = (dbCounts[log.attr.db] || 0) + 1;
            }

            // Namespace istatistiği
            if (log.attr && log.attr.Namespace) {
                namespaces[log.attr.Namespace] = (namespaces[log.attr.Namespace] || 0) + 1;
            }

            // Operation type istatistiği
            if (log.attr && log.attr.Type) {
                operationTypes[log.attr.Type] = (operationTypes[log.attr.Type] || 0) + 1;
            }
        });

        // En sık kullanılan veritabanını bulma
        let mostFrequentDb = '';
        let maxCount = 0;

        Object.entries(dbCounts).forEach(([db, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentDb = db;
            }
        });

        // En sık kullanılan namespace'leri bulma (top 5)
        const topNamespaces = Object.entries(namespaces)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([ns, count]) => ({ namespace: ns, count }));

        // En sık kullanılan operasyon tiplerini bulma
        const topOperationTypes = Object.entries(operationTypes)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({ type, count }));

        // İstatistikleri güncelle
        setStats({
            totalQueries,
            avgExecutionTime: totalQueries > 0 ? totalExecutionTime / totalQueries : 0,
            slowestQuery,
            collscanOps,
            mostFrequentDb,
            topNamespaces,
            topOperationTypes
        });
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
                <Steps current={currentStep} style={{ flex: 1 }}>
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
                <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center' }}>
                    <Tooltip title="Refresh Data">
                        <button
                            onClick={handleRefreshData}
                            disabled={loading}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                padding: '8px'
                            }}
                        >
                            <ReloadOutlined
                                spin={loading}
                                style={{ fontSize: '20px', color: '#1890ff' }}
                            />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {currentStep === 0 && (
                <Select
                    style={{ width: '50%', marginTop: 20 }}
                    showSearch
                    placeholder={fetchingReplSets ? "Loading replica sets..." : "Select a replica set"}
                    optionFilterProp="children"
                    onChange={handleReplSetChange}
                    filterOption={(input, option) =>
                        option?.children
                            ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                            : false
                    }
                    loading={fetchingReplSets}
                    notFoundContent={fetchingReplSets ? <Spin size="small" /> : "No replica sets found"}
                    value={selectedReplicaSet}
                >
                    {replSets.map(replSet => (
                        <Option key={replSet} value={replSet}>{replSet}</Option>
                    ))}
                </Select>
            )}

            {currentStep === 1 && selectedReplicaSet && (
                <Select
                    popupMatchSelectWidth={false}
                    style={{ width: '50%', marginTop: 20 }}
                    showSearch
                    placeholder={fetchingNodes ? "Loading nodes..." : "Select a node"}
                    onChange={handleNodeChange}
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        option?.children
                            ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                            : false
                    }
                    value={selectedNode}
                    loading={fetchingNodes}
                    notFoundContent={fetchingNodes ? <Spin size="small" /> : "No nodes found"}
                >
                    {nodes.map(node => {
                        const nodeName = node.nodename || node.Hostname || '';
                        const nodeStatus = node.status || node.NodeStatus || '';
                        const mongoStatus = node.MongoStatus || '';

                        // Status rengini belirle
                        const statusColor = nodeStatus === 'PRIMARY' ? '#1890ff' :
                            nodeStatus === 'SECONDARY' ? '#52c41a' :
                                nodeStatus === 'ARBITER' ? '#722ed1' : '#f5222d';

                        // MongoDB servis durumu rengini belirle
                        const mongoStatusColor = mongoStatus === 'RUNNING' ? '#52c41a' : '#f5222d';

                        return (
                            <Option key={nodeName} value={nodeName}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{nodeName}</span>
                                    <span>
                                        <span style={{ color: statusColor, marginRight: '8px' }}>[{nodeStatus}]</span>
                                        <span style={{ color: mongoStatusColor }}>[{mongoStatus || 'UNKNOWN'}]</span>
                                    </span>
                                </div>
                            </Option>
                        );
                    })}
                </Select>
            )}

            {currentStep === 2 && selectedNode && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ marginBottom: 10 }}>
                        <strong>Available Log Files ({logFiles.length}):</strong>
                        {fetchingLogFiles && <Spin size="small" style={{ marginLeft: 10 }} />}
                        {!fetchingLogFiles && logFiles.length > 0 && !selectedLogFile && (
                            <span style={{ color: '#1890ff', marginLeft: 8, fontStyle: 'italic' }}>
                                <ArrowDownOutlined /> Please select a log file to analyze
                            </span>
                        )}
                    </div>
                    <Select
                        showSearch
                        placeholder={fetchingLogFiles ? "Loading log files..." : "Select a log file to analyze"}
                        style={{ 
                            width: '100%', 
                            ...(logFiles.length > 0 && !selectedLogFile ? { 
                                borderColor: '#1890ff', 
                                boxShadow: '0 0 0 2px rgba(24,144,255,0.2)' 
                            } : {}) 
                        }}
                        onChange={handleLogFileChange}
                        filterOption={(input, option) =>
                            option?.children
                                ? String(option.children).toLowerCase().includes(input.toLowerCase())
                                : false
                        }
                        loading={fetchingLogFiles}
                        notFoundContent={fetchingLogFiles ? <Spin size="small" /> : "No log files found"}
                        value={selectedLogFile}
                        listHeight={400}
                        size="large"
                    >
                        {logFiles.map((logFile, index) => {
                            // Dosya adı ve diğer bilgileri bul
                            const fileInfo = logFileStatsList.find(info => info.path === logFile);
                            const fileName = fileInfo ? fileInfo.fileName : logFile.split('/').pop() || logFile;
                            const fileSize = fileInfo ? fileInfo.fileSize : '';
                            const lastModified = fileInfo ? fileInfo.lastModified : null;
                            
                            // Son değiştirilme tarihini formatlı göster
                            const formattedDate = lastModified 
                                ? lastModified.toLocaleString() 
                                : '';
                            
                            return (
                                <Option key={index} value={logFile}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>
                                            <strong>{fileName}</strong>
                                            {fileSize && <span style={{ marginLeft: '8px', color: '#888' }}>({fileSize})</span>}
                                        </span>
                                        {formattedDate && (
                                            <span style={{ color: '#999', fontSize: '12px' }}>
                                                {formattedDate}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#999' }}>{logFile}</div>
                                </Option>
                            );
                        })}
                    </Select>
                    {!selectedLogFile && logFiles.length > 0 && (
                        <div style={{ marginTop: 5, color: '#1890ff', fontSize: 12, textAlign: 'center' }}>
                            <ArrowUpOutlined style={{ marginRight: 4 }} /> Click to open the dropdown and select a log file
                        </div>
                    )}
                    {logFiles.length === 0 && !fetchingLogFiles && (
                        <div style={{ marginTop: 10, color: '#ff4d4f', textAlign: 'center', padding: '10px' }}>
                            <AlertOutlined style={{ marginRight: 5 }} />
                            No log files found. Please check if logs exist for this node.
                        </div>
                    )}
                </div>
            )}

            <div style={{ margin: '20px 0', width: '100%' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: '20px', padding: '40px' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: '10px' }}>Processing log data...</div>
                    </div>
                ) : (
                    <div>
                        {/* Log Dosya Bilgileri */}
                        {selectedLogFile && (
                            <Card 
                                title={`Log File: ${selectedLogFile.split('/').pop()}`} 
                                style={{ marginBottom: '16px' }}
                                size="small"
                                extra={
                                    Array.isArray(logs) && logs.length > 0 ? (
                                        <Tooltip title="Re-analyze log with current threshold value">
                                            <Button 
                                                type="primary" 
                                                onClick={() => fetchParsedLogs(selectedNode as string, selectedLogFile)}
                                                icon={<ReloadOutlined />}
                                            >
                                                Re-analyze
                                            </Button>
                                        </Tooltip>
                                    ) : (
                                        <span style={{ color: '#1890ff' }}>
                                            <ArrowDownOutlined /> Adjust threshold below and analyze
                                        </span>
                                    )
                                }
                            >
                                <Row gutter={16}>
                                    <Col span={6}>
                                        <Statistic 
                                            title="Errors" 
                                            value={logFileStats.errorCount} 
                                            valueStyle={{ color: logFileStats.errorCount > 0 ? '#ff4d4f' : '#999' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic 
                                            title="Warnings" 
                                            value={logFileStats.warningCount}
                                            valueStyle={{ color: logFileStats.warningCount > 0 ? '#faad14' : '#999' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic 
                                            title="Info" 
                                            value={logFileStats.infoCount}
                                            valueStyle={{ color: '#1890ff' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic 
                                            title="Total Lines" 
                                            value={logFileStats.totalCount || (logFileStats.errorCount + logFileStats.warningCount + logFileStats.infoCount)}
                                        />
                                    </Col>
                                </Row>
                                
                                {/* Dosya bilgileri */}
                                <div style={{ marginTop: '16px', color: '#888', borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                                    {/* Dosya bilgilerini bul */}
                                    {(() => {
                                        const fileInfo = logFileStatsList.find(info => info.path === selectedLogFile);
                                        if (!fileInfo) return <p>Path: {selectedLogFile}</p>;
                                        
                                        return (
                                            <>
                                                <p>
                                                    <strong>File:</strong> {fileInfo.fileName} 
                                                    <span style={{ marginLeft: '8px' }}>({fileInfo.fileSize})</span>
                                                </p>
                                                <p>
                                                    <strong>Last Modified:</strong> {fileInfo.lastModified.toLocaleString()}
                                                </p>
                                                <p><strong>Path:</strong> {fileInfo.path}</p>
                                            </>
                                        );
                                    })()}
                                </div>
                            </Card>
                        )}

                        {Array.isArray(logs) && logs.length > 0 ? (
                            <div>
                                {/* İstatistikler ve Filtreler */}
                                <div style={{ marginBottom: '20px' }}>
                                    <Collapse defaultActiveKey={['1']}>
                                        <Panel header="MongoDB Query Analysis" key="1">
                                            <Row gutter={16}>
                                                <Col span={4}>
                                                    <Card>
                                                        <Statistic
                                                            title="Total Query Operations"
                                                            value={stats.totalQueries}
                                                            prefix={<FileSearchOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={4}>
                                                    <Card>
                                                        <Statistic
                                                            title="Avg Execution Time"
                                                            value={stats.avgExecutionTime.toFixed(2)}
                                                            suffix="ms"
                                                            precision={2}
                                                            prefix={<ClockCircleOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={4}>
                                                    <Card>
                                                        <Statistic
                                                            title="Collection Scans"
                                                            value={stats.collscanOps}
                                                            valueStyle={{ color: stats.collscanOps > 10 ? '#cf1322' : '#3f8600' }}
                                                            prefix={<AlertOutlined />}
                                                        />
                                                        <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                                                            {stats.collscanOps > 10 ? 'High COLLSCAN operations detected!' : 'COLLSCAN operations within normal limits'}
                                                        </div>
                                                    </Card>
                                                </Col>
                                                <Col span={4}>
                                                    <Card>
                                                        <Statistic
                                                            title="Most Used DB"
                                                            value={stats.mostFrequentDb || 'N/A'}
                                                            prefix={<BarChartOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={8}>
                                                    <Card title="Slowest Query">
                                                        <Statistic
                                                            value={stats.slowestQuery.time}
                                                            suffix="ms"
                                                            valueStyle={{ color: '#cf1322' }}
                                                        />
                                                        <div style={{
                                                            marginTop: '5px',
                                                            maxHeight: '40px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}>
                                                            <Tooltip title={stats.slowestQuery.query}>
                                                                <span style={{ fontSize: '12px' }}>
                                                                    {stats.slowestQuery.query.length > 60
                                                                        ? `${stats.slowestQuery.query.substring(0, 60)}...`
                                                                        : stats.slowestQuery.query}
                                                                </span>
                                                            </Tooltip>
                                                        </div>
                                                    </Card>
                                                </Col>
                                            </Row>

                                            {/* Top Namespaces ve Operation Types */}
                                            {stats.topNamespaces && stats.topNamespaces.length > 0 && (
                                                <Row gutter={16} style={{ marginTop: '16px' }}>
                                                    <Col span={12}>
                                                        <Card title="Top 5 Collections/Namespaces" size="small">
                                                            <ul style={{ paddingLeft: '20px' }}>
                                                                {stats.topNamespaces.map((item, index) => (
                                                                    <li key={index}>
                                                                        <span style={{ fontWeight: 'bold' }}>{item.namespace}</span>: {item.count} operations
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </Card>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Card title="Operation Types" size="small">
                                                            <ul style={{ paddingLeft: '20px' }}>
                                                                {stats.topOperationTypes && stats.topOperationTypes.map((item, index) => (
                                                                    <li key={index}>
                                                                        <span style={{ fontWeight: 'bold' }}>{item.type}</span>: {item.count} operations
                                                                    </li>
                                                                )).slice(0, 5)}
                                                            </ul>
                                                        </Card>
                                                    </Col>
                                                </Row>
                                            )}
                                        </Panel>
                                    </Collapse>
                                </div>

                                {/* Filtreleme araçları */}
                                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ marginRight: '15px', width: '250px' }}>
                                        <Select
                                            allowClear
                                            placeholder="Filter by Database"
                                            style={{ width: '100%' }}
                                            options={dbFilters}
                                            onChange={(value) => setSelectedDb(value)}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <Search
                                            placeholder="Search in queries and commands"
                                            allowClear
                                            enterButton
                                            onSearch={(value) => setSearchText(value)}
                                            onChange={(e) => {
                                                if (!e.target.value) {
                                                    setSearchText('');
                                                }
                                            }}
                                        />
                                    </div>
                                    <div style={{ marginLeft: '15px' }}>
                                        <span style={{ marginRight: '5px' }}>
                                            Showing {filteredLogs.length} of {logs.length} log entries
                                        </span>
                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={() => {
                                                setSelectedDb(null);
                                                setSearchText('');
                                            }}
                                        >
                                            Reset Filters
                                        </Button>
                                    </div>
                                </div>

                                <Table
                                    columns={columns}
                                    dataSource={filteredLogs}
                                    rowKey="uniqueId"
                                    pagination={{
                                        pageSize: 50,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['20', '50', '100', '200'],
                                        showTotal: (total) => `Total ${total} log entries`
                                    }}
                                    scroll={{ x: 1500, y: 650 }}
                                    size="small"
                                />
                            </div>
                        ) : (
                            selectedLogFile && (
                                <EmptyLogResults 
                                    onRefresh={() => fetchParsedLogs(selectedNode as string, selectedLogFile)} 
                                    fileName={selectedLogFile}
                                    threshold={slowQueryThreshold}
                                    onThresholdChange={setSlowQueryThreshold}
                                />
                            )
                        )}
                    </div>
                )}
            </div>

            {currentStep === 3 && (
                <div style={{ marginTop: 5 }}>
                    <button
                        onClick={resetSteps}
                        style={{
                            marginRight: 10,
                            padding: '4px 15px',
                            borderRadius: '2px',
                            border: '1px solid #d9d9d9',
                            background: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Start Over
                    </button>
                    <button
                        onClick={resetLogFileStep}
                        style={{
                            marginRight: 10,
                            padding: '4px 15px',
                            borderRadius: '2px',
                            border: '1px solid #d9d9d9',
                            background: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Select New Log File
                    </button>
                    <button
                        onClick={resetNodeStep}
                        style={{
                            padding: '4px 15px',
                            borderRadius: '2px',
                            border: '1px solid #d9d9d9',
                            background: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Select New Node
                    </button>
                </div>
            )}
        </div>
    );
};

export default QueryAnalyzer;
