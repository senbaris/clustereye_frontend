import React, { useState, useEffect, useCallback } from 'react';
import { Select, Table, Badge, message, Modal, Steps, Row, Col, Card, Progress, Spin, Input, Pagination, Typography, TimePicker, Button, Statistic, Tooltip, Tag, Menu, Layout } from 'antd';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { CopyOutlined, ReloadOutlined, InfoCircleOutlined, DownloadOutlined, DatabaseOutlined, BarChartOutlined, SettingOutlined, FileTextOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import CountUp from 'react-countup';
import MonacoEditor from './monacoeditor';
import { Alert } from 'antd';


const { Option } = Select;
const { Step } = Steps;
const { Search } = Input;
const { Paragraph, Text } = Typography;
const { Sider, Content } = Layout;

interface Database {
    datname: string;
}

interface LogFile {
    name: string;
    path: string;
    fullPath: string;
    timeRange: string;
}

interface Node {
    Hostname: string;
    NodeStatus: string;
    PGVersion: string;
}
interface ClusterData {
    [key: string]: Node[];
}


interface QueryResultDbStats {
    datid: number;
    datname: string;
    numbackends: number;
    xact_commit: number;
    xact_rollback: number;
    blks_read: number;
    blks_hit: number;
    tup_returned: number;
    tup_fetched: number;
    tup_inserted: number;
    tup_updated: number;
    tup_deleted: number;
    conflicts: number;
    temp_files: number;
    temp_bytes: number;
    deadlocks: number;
    blk_read_time: number;
    blk_write_time: number;
    stats_reset: string;
    // Ekstra alanlar için:
    // active_time, session_time, vb.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface QueryResultUnusedIndexes {

    indextype: string;
    schemaname: string;
    tablename: string;
    indexname: string;
    idx_columns: string;
    id_scan_count: number;
    index_size: number;
}

interface QueryResultIndexBloat {
    db_name: string;
    schema_name: string;
    table_name: string;
    index_name: string;
    num_rows: number;
    total_pages: number;
    expected_pages: number;
    bloat_pages: number;
    bloat_ratio: number;
    fragmentation_level: number;
}


interface QueryResultCacheHitRatio {
    rolname: string;
    calls: number;
    shared_blks_hit: number;
    shared_blks_read: number;
    hit_cache_ratio: number;
    query: string;
}

interface QueryResultUserAccessList {
    username: string;
    isSuperuser: boolean;
}

interface QueryResultLongRunning {
    datName: string;
    pid: number;
    userName: string;
    applicationName: string;
    queryStart: string;
    state: string;
    waitEventType: string | null;
    waitEvent: string | null;
    query: string;
    duration: number;
}

interface QueryResultLock {
    waitingQuery: string;
    waitingPid: number;
    waitingQueryStart: string;
    waitingLockType: string;
    waitingLockMode: string;
    blockingQuery: string;
    blockingPid: number;
    blockingQueryStart: string;
    blockingLockType: string;
    blockingLockMode: string;
    blockingGranted: boolean;
    waitingClient: string | null;
    blockingClient: string | null;
}



interface QueryResult {
    total_connections?: number;
    non_idle_connections?: number;
    max_connections?: number;
    connections_utilization_pctg?: number;
    application_name?: string;
    state?: string;
    connection_count?: number;
    // Top CPU sorgusu için eklenen alanlar
    usename?: string;
    db_name?: string;
    total_time?: number;
    calls?: number;
    mean?: number;
    cpu_portion_pctg?: number;
    short_query?: string;
}


interface PgBouncerStat {
    cl_active: number;
    cl_active_cancel_req: number;
    cl_waiting: number;
    cl_waiting_cancel_req: number;
    database: string;
    maxwait: number;
    maxwait_us: number;
    pool_mode: string;
    sv_active: number;
    sv_active_cancel: number;
    sv_being_canceled: number;
    sv_idle: number;
    sv_login: number;
    sv_tested: number;
    sv_used: number;
    user: string;
}

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    let i = 0;
    let size = bytes;

    while (size >= k && i < sizes.length - 1) {
        size /= k;
        i++;
    }

    return parseFloat(size.toFixed(dm)) + ' ' + sizes[i];
}

const showCommandModal = (command: string) => {
    const commandString: string = command

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
               <MonacoEditor
                        value={command}
                        readOnly={true} // Salt okunur

                    />
            </div>
        ),
        width: '80%',
        bodyStyle: {
            maxHeight: '90vh', // Maksimum yükseklik ekranın %70'i
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

const roundDown = (value: number): string => {
    const factor = Math.pow(10, 2); // İki ondalık basamak için 10^2
    return (Math.floor(value * factor) / factor).toFixed(2);
};

const columns = [
    {
        title: 'Total Connections',
        dataIndex: 'total_connections',
        key: 'total_connections',
    },
    {
        title: 'Non-Idle Connections',
        dataIndex: 'non_idle_connections',
        key: 'non_idle_connections',
    },
    {
        title: 'Max Connections',
        dataIndex: 'max_connections',
        key: 'max_connections',
    },
    {
        title: 'Connections Utilization (%)',
        dataIndex: 'connections_utilization_pctg',
        key: 'connections_utilization_pctg',
    },
];

const columnsTopCpu = [
    {
        title: 'User Name',
        dataIndex: 'usename',
        key: 'usename',
    },
    {
        title: 'Database Name',
        dataIndex: 'db_name',
        key: 'db_name',
    },
    {
        title: 'Total Time',
        dataIndex: 'total_time',
        key: 'total_time',
    },
    {
        title: 'Calls',
        dataIndex: 'calls',
        key: 'calls',
    },
    {
        title: 'Mean (ms)',
        dataIndex: 'mean',
        key: 'mean',
    },
    {
        title: 'CPU Portion (%)',
        dataIndex: 'cpu_portion_pctg',
        key: 'cpu_portion_pctg',
    },
    {
        title: 'Query',
        dataIndex: 'short_query',
        key: 'short_query',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
];

const columnsCacheHitRatio = [
    {
        title: 'User Name',
        dataIndex: 'rolname',
        key: 'rolname',
    },
    {
        title: 'Calls',
        dataIndex: 'calls',
        key: 'calls',
    },
    {
        title: 'Read From Cache',
        dataIndex: 'shared_blks_hit',
        key: 'shared_blks_hit',
    },
    {
        title: 'Read From Disk',
        dataIndex: 'shared_blks_read',
        key: 'shared_blks_read',
    },
    {
        title: 'Cache Hit Ratio',
        dataIndex: 'hit_cache_ratio',
        key: 'hit_cache_ratio',
        render: (text: number | null | undefined) => {
            return text !== null && text !== undefined ? roundDown(text) : '';
        },
    },
    {
        title: 'Query',
        dataIndex: 'query',
        key: 'query',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
];

const columnsLongRunning = [
    {
        title: 'Duration',
        dataIndex: 'duration',
        key: 'duration',
    },
    {
        title: 'Database Name',
        dataIndex: 'datName',
        key: 'datName',
    },
    {
        title: 'PID',
        dataIndex: 'pid',
        key: 'pid',
    },
    {
        title: 'User Name',
        dataIndex: 'userName',
        key: 'userName',
    },
    {
        title: 'Application Name',
        dataIndex: 'applicationName',
        key: 'applicationName',
    },
    {
        title: 'Query Start',
        dataIndex: 'queryStart',
        key: 'queryStart',
    },
    {
        title: 'Wait Event Type',
        dataIndex: 'waitEventType',
        key: 'waitEventType',
    },
    {
        title: 'Wait Event',
        dataIndex: 'waitEvent',
        key: 'waitEvent',
    },
    {
        title: 'State',
        dataIndex: 'state',
        key: 'state',
    },
    {
        title: 'Query',
        dataIndex: 'query',
        key: 'query',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
];

const columnsLocks = [
    {
        title: 'Waiting Query',
        dataIndex: 'waitingQuery',
        key: 'waitingQuery',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
    {
        title: 'Waiting PID',
        dataIndex: 'waitingPid',
        key: 'waitingPid',
    },
    {
        title: 'Waiting Query Start',
        dataIndex: 'waitingQueryStart',
        key: 'waitingQueryStart',
    },
    {
        title: 'Waiting Lock Type',
        dataIndex: 'waitingLockType',
        key: 'waitingLockType',
    },
    {
        title: 'Waiting Lock Mode',
        dataIndex: 'waitingLockMode',
        key: 'waitingLockMode',
    },
    {
        title: 'Blocking Query',
        dataIndex: 'blockingQuery',
        key: 'blockingQuery',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
    {
        title: 'Blocking PID',
        dataIndex: 'blockingPid',
        key: 'blockingPid',
    },
    {
        title: 'Blocking Query Start',
        dataIndex: 'blockingQueryStart',
        key: 'blockingQueryStart',
    },
    {
        title: 'Blocking Lock Type',
        dataIndex: 'blockingLockType',
        key: 'blockingLockType',
    },
    {
        title: 'Blocking Lock Mode',
        dataIndex: 'blockingLockMode',
        key: 'blockingLockMode',
    },
    {
        title: 'Blocking Granted',
        dataIndex: 'blockingGranted',
        key: 'blockingGranted',
        render: (granted: boolean) => (granted ? 'Yes' : 'No'),
    },
    {
        title: 'Waiting Client',
        dataIndex: 'waitingClient',
        key: 'waitingClient',
    },
    {
        title: 'Blocking Client',
        dataIndex: 'blockingClient',
        key: 'blockingClient',
    },
];


const columnsUnusedIndexes = [
    {
        title: 'Index Type',
        dataIndex: 'indextype',
        key: 'indextype',
    },
    {
        title: 'Schema Name',
        dataIndex: 'schemaname',
        key: 'schemaname',
    },
    {
        title: 'Table Name',
        dataIndex: 'tablename',
        key: 'tablename',
    },
    {
        title: 'Index Name ',
        dataIndex: 'indexname',
        key: 'indexname',
    },
    {
        title: 'Index Columns',
        dataIndex: 'idx_columns',
        key: 'idx_columns',
    },

    {
        title: 'Index Scan Count',
        dataIndex: 'id_scan_count',
        key: 'id_scan_count',
        sorter: (a: QueryResultUnusedIndexes, b: QueryResultUnusedIndexes) => a.id_scan_count - b.id_scan_count,

    },
    {
        title: 'Index Size',
        dataIndex: 'index_size',
        key: 'index_size',
        render: (sizeInKB: number) => formatBytes(sizeInKB), // KB cinsinden boyutu alıp formatlıyoruz
        sorter: (a: QueryResultUnusedIndexes, b: QueryResultUnusedIndexes) => a.index_size - b.index_size,
    },
];

const columnsIndexBloat = [
    {
        title: 'Database Name',
        dataIndex: 'db_name',
        key: 'db_name',
    },
    {
        title: 'Schema Name',
        dataIndex: 'schema_name',
        key: 'schema_name',
    },
    {
        title: 'Table Name',
        dataIndex: 'table_name',
        key: 'table_name',
    },
    {
        title: 'Index Name',
        dataIndex: 'index_name',
        key: 'index_name',
    },
    {
        title: 'Number of Rows',
        dataIndex: 'num_rows',
        key: 'num_rows',
        sorter: (a: QueryResultIndexBloat, b: QueryResultIndexBloat) => a.num_rows - b.num_rows,
    },
    {
        title: 'Total Pages',
        dataIndex: 'total_pages',
        key: 'total_pages',
        sorter: (a: QueryResultIndexBloat, b: QueryResultIndexBloat) => a.total_pages - b.total_pages,
    },
    {
        title: 'Expected Pages',
        dataIndex: 'expected_pages',
        key: 'expected_pages',
        sorter: (a: QueryResultIndexBloat, b: QueryResultIndexBloat) => a.expected_pages - b.expected_pages,
    },
    {
        title: 'Bloat Pages',
        dataIndex: 'bloat_pages',
        key: 'bloat_pages',
        sorter: (a: QueryResultIndexBloat, b: QueryResultIndexBloat) => a.bloat_pages - b.bloat_pages,
    },
    {
        title: 'Bloat Ratio (%)',
        dataIndex: 'bloat_ratio',
        key: 'bloat_ratio',
        render: (bloatRatio: number) => bloatRatio.toFixed(2) + '%', // Yüzde olarak formatlıyoruz
        sorter: (a: QueryResultIndexBloat, b: QueryResultIndexBloat) => a.bloat_ratio - b.bloat_ratio,
    },
    {
        title: 'Fragmentation Level (%)',
        dataIndex: 'fragmentation_level',
        key: 'fragmentation_level',
        render: (fragmentationLevel: number) => fragmentationLevel ? fragmentationLevel.toFixed(2) + '%' : 'N/A',
        sorter: (a: QueryResultIndexBloat, b: QueryResultIndexBloat) => a.fragmentation_level - b.fragmentation_level,
    },
];


const columnsNonIdleConns = [
    {
        title: 'Application Name',
        dataIndex: 'application_name',
        key: 'application_name',
    },
    {
        title: 'State',
        dataIndex: 'state',
        key: 'state',
    },
    {
        title: 'Connection Count',
        dataIndex: 'connection_count',
        key: 'connection_count',
    },
];

const pgBouncerColumns = [
    {
        title: 'Database',
        dataIndex: 'database',
        key: 'database'
    },
    {
        title: 'User',
        dataIndex: 'user',
        key: 'user'
    },
    {
        title: 'ClActive',
        dataIndex: 'cl_active',
        key: 'cl_active'
    },
    {
        title: 'SvIdle',
        dataIndex: 'sv_idle',
        key: 'sv_idle'
    },
    {
        title: 'SvUsed',
        dataIndex: 'sv_used',
        key: 'sv_used'
    },
    {
        title: 'PoolMode',
        dataIndex: 'pool_mode',
        key: 'pool_mode'
    },
    {
        title: 'Cl_Waiting',
        dataIndex: 'cl_waiting',
        key: 'cl_waiting'
    },
    {
        title: 'MaxWait',
        dataIndex: 'maxwait',
        key: 'maxwait'
    },
    {
        title: 'MaxWait_Us',
        dataIndex: 'maxwait_us',
        key: 'maxwait_us'
    },
    {
        title: 'Sv_Active',
        dataIndex: 'sv_active',
        key: 'sv_active'
    },
];

const UserAccessListColumns = [
    {
        title: 'User Name',
        dataIndex: 'username',
        key: 'username'
    },
    {
        title: 'Super User',
        dataIndex: 'isSuperuser',
        key: 'isSuperuser',
        render: (isSuperuser: boolean) => {
            return isSuperuser ? <Tag color="blue">Yes</Tag> : <Tag color="green">No</Tag>;
        },
    },
];

interface SystemMetrics {
    cpu_usage: number;
    cpu_cores: number;
    memory_usage: number;
    total_memory: number;
    free_memory: number;
    load_average_1m: number;
    load_average_5m: number;
    load_average_15m: number;
    total_disk: number;
    free_disk: number;
    os_version: string;
    kernel_version: string;
    uptime: number;
}

const PostgrePA: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [loadingClusterName, setLoadingClusterName] = useState(false);
    const [loadingPgLogs, setLoadingPgLogs] = useState(false);
    const [clusterNames, setClusterNames] = useState<string[]>([]); // Tüm cluster isimleri
    const [nodeName, setNodeName] = useState(''); // Seçilen nodeName
    const [data, setData] = useState<Record<string, Node[]>>({}); // API'den gelen veri yapısına uygun tip
    const [nodeInfo, setNodeInfo] = useState<{ name: string; status: string; PGVersion: string }[]>([]);
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const clusterNameFromURL = queryParams.get('clusterName') || '';
    const [clusterName, setClusterName] = useState(clusterNameFromURL);
    const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
    const [queryResultsNonIdleConns, setQueryResultsNonIdleConns] = useState<QueryResult[]>([]);
    const [queryResultsCacheHitRatio, setQueryResultsCacheHitRatio] = useState<QueryResultCacheHitRatio[]>([]);
    const [queryResultsUserAccessList, setQueryResultsUserAccessList] = useState<QueryResultUserAccessList[]>([]);
    const [queryResultsLongRunning, setQueryResultsLongRunning] = useState<QueryResultLongRunning[]>([]);
    const [queryResultsLocks, setQueryResultsLocks] = useState<QueryResultLock[]>([]);
    const [queryResultsUnusedIndexes, setQueryResultsUnusedIndexes] = useState<QueryResultUnusedIndexes[]>([]);
    const [queryResultsIndexBloat, setQueryResultsIndexBloat] = useState<QueryResultIndexBloat[]>([]);
    const [queryResultsDbStats, setQueryResultsDbStats] = useState<QueryResultDbStats[]>([]);
    const [queryResultsTopCpu, setQueryResultsTopCpu] = useState<QueryResult[]>([]);
    const [pgBouncerStats, setPgBouncerStats] = useState<PgBouncerStat[]>([]);
    const [isLoadingPgBouncerStats, setIsLoadingPgBouncerStats] = useState(true);
    const [isLoadingQueryResults, setIsLoadingQueryResults] = useState(true);
    const [isLoadingLongRunningQueryResults, setIsLoadingLongRunningQueryResults] = useState(true);
    const [isLoadingLocsResults, setIsLoadingLocksResults] = useState(true);
    const [isLoadingNonIdleQueryResults, setIsLoadingNonIdleQueryResults] = useState(true);
    const [isLoadingCacheHitQueryResults, setIsLoadingCacheHitQueryResults] = useState(true);
    const [isLoadingTopCpuQueryResults, setIsLoadingTopCpuQueryResults] = useState(true);
    const [isLoadingUserAccessListResults, setIsLoadingUserAccessListResults] = useState(true);
    const [isLoadingUnusedIndexesResults, setIsLoadingUnusedIndexesResults] = useState(true);
    const [isLoadingIndexBloatResults, setIsLoadingIndexBloatResults] = useState(true);
    const [isLoadingDbStatsResults, setIsLoadingDbStatsResults] = useState(true);
    const [selectedFullPath, setSelectedFullPath] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [activeTab, setActiveTab] = useState('1');
    const [selectedDatabase, setSelectedDatabase] = useState('postgres');
    const [databaseNames, setDatabaseNames] = useState<string[]>([]);
    const [pgLogFiles, setPgLogFiles] = useState<LogFile[]>([]);
    const [startTime, setStartTime] = useState<Dayjs | null>(null);
    const [endTime, setEndTime] = useState<Dayjs | null>(null);
    const [filter, setFilter] = useState('ALL');
    const [logContent, setLogContent] = useState<string>('');
    const [refreshInterval, setRefreshInterval] = useState(0);
    const [countdown, setCountdown] = useState(refreshInterval);
    const [searchText, setSearchText] = useState('');
    const twoColors = { '0%': '#4faa40ff', '100%': '#c31717ff' };
    const [currentPage, setCurrentPage] = useState(1);
    const linesPerPage = 200;
    const [minDuration, setMinDuration] = useState('');

    // Yeni state değişkenleri
    const [selectedSubMenu, setSelectedSubMenu] = useState<string>('');
    const [collapsed, setCollapsed] = useState<boolean>(false);
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

    const formatLogContent = (content: string) => {
        return content.split('\n')
            .filter(line => {
                if (filter === 'ERROR' && !line.includes('ERROR')) return false;
                if (filter === 'WARN' && !line.includes('WARN')) return false;
                if (filter === 'FATAL' && !line.includes('FATAL')) return false;
                if (searchText && !line.toLowerCase().includes(searchText.toLowerCase())) return false;
                // Duration filtresi
                const durationMatch = line.match(/duration: ([\d.]+) ms/);
                if (durationMatch && minDuration) {
                    const duration = parseFloat(durationMatch[1]);
                    return duration > parseFloat(minDuration);
                }

                return true;
            })
            .map((line, index) => {
                const datePattern = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
                let formattedLine = line.replace(datePattern, match => `<span style="color: blue;">${match}</span>`);

                formattedLine = formattedLine
                    .replace(/ERROR/g, '<span style="color: red;">ERROR</span>')
                    .replace(/WARN/g, '<span style="color: orange;">WARN</span>')
                    .replace(/FATAL/g, '<span style="color: red;">FATAL</span>');
                return `<div>${index + 1}: ${formattedLine}</div>`;
            })
            .join('\n');
    };
    const formattedContent = formatLogContent(logContent);

    const paginatedContent = () => {
        const start = (currentPage - 1) * linesPerPage;
        const end = start + linesPerPage;
        return formattedContent.split('\n').slice(start, end).join('\n');
    };

    const totalLines = formattedContent.split('\n').length;

    const createMarkup = () => ({ __html: paginatedContent() });



    const fetchQueryResults = async (nodeName: string) => {
        try {
            setIsLoadingQueryResults(true)
            const agentId = `agent_${nodeName}`;
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_connstats',
                    command: `SELECT
                        A.total_connections,
                        A.non_idle_connections,
                        B.max_connections,
                        ROUND((100 * A.total_connections::NUMERIC / B.max_connections::NUMERIC), 2) AS connections_utilization_pctg
                    FROM
                        (SELECT COUNT(1) AS total_connections, SUM(CASE WHEN state != 'idle' THEN 1 ELSE 0 END) AS non_idle_connections FROM pg_stat_activity) A,
                        (SELECT setting AS max_connections FROM pg_settings WHERE name = 'max_connections') B;`
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed result:', parsedResult); // Debug için

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult = {
                            total_connections: parsedResult.total_connections || 0,
                            non_idle_connections: parsedResult.non_idle_connections || 0,
                            max_connections: parsedResult.max_connections || 0,
                            connections_utilization_pctg: parsedResult.connections_utilization_pctg || 0
                        };

                        // Array formatında state'e kaydet
                        setQueryResults([queryResult]);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                        console.log('Raw result:', result);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingQueryResults(false);
        }
    };

    const fetchQueryNonIdleConnsResults = async (nodeName: string) => {
        try {
            setIsLoadingNonIdleQueryResults(true)
            const agentId = `agent_${nodeName}`;
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_conns_appname',
                    command: `SELECT 
                        application_name, 
                        state, 
                        COUNT(*) AS connection_count
                    FROM pg_stat_activity
                    WHERE application_name IS NOT NULL
                    GROUP BY application_name, state
                    ORDER BY application_name, state;`
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed result:', parsedResult); // Debug için

                        // Yeni veri yapısını işle
                        const queryResult = [];
                        const rowCount = parsedResult.row_count || 0;

                        for (let i = 0; i < rowCount; i++) {
                            if (parsedResult[`application_name_${i}`] !== '') {
                                queryResult.push({
                                    application_name: parsedResult[`application_name_${i}`],
                                    state: parsedResult[`state_${i}`],
                                    connection_count: parseInt(parsedResult[`connection_count_${i}`]) || 0
                                });
                            }
                        }

                        setQueryResultsNonIdleConns(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                        console.log('Raw result:', result);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingNonIdleQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingNonIdleQueryResults(false);
        }
    };

    const fetchQueryCacheHitRatioResults = async (nodeName: string) => {
        try {
            setIsLoadingCacheHitQueryResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                WITH statements AS (
                    SELECT * FROM pg_stat_statements pss
                    JOIN pg_roles pr ON (userid=oid)
                )
                SELECT rolname, calls, 
                    shared_blks_hit,
                    shared_blks_read,
                    shared_blks_hit/(shared_blks_hit+shared_blks_read)::NUMERIC*100 hit_cache_ratio,
                    query
                FROM statements
                WHERE calls > 0
                AND shared_blks_hit > 0
                ORDER BY calls DESC, hit_cache_ratio ASC
                LIMIT 20;
            `;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_cachehitratio',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed result:', parsedResult); // Debug için

                        // Hata kontrolü
                        if (parsedResult.status === 'error' && parsedResult.message && parsedResult.message.includes('pg_stat_statements')) {
                            // pg_stat_statements extension'ı yüklü değil
                            message.error({
                                content: (
                                    <div>
                                        <p><strong>Error:</strong> pg_stat_statements extension is not installed.</p>
                                        <p>To install the extension, run the following SQL command as a superuser:</p>
                                        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                                            CREATE EXTENSION pg_stat_statements;
                                        </pre>
                                        <p>After installation, you may need to restart the PostgreSQL server.</p>
                                    </div>
                                ),
                                duration: 10
                            });
                            setQueryResultsCacheHitRatio([]);
                            setIsLoadingCacheHitQueryResults(false);
                            return;
                        }

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult: QueryResultCacheHitRatio[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`rolname_${i}`] !== '') {
                                    queryResult.push({
                                        rolname: parsedResult[`rolname_${i}`],
                                        calls: parseInt(parsedResult[`calls_${i}`]) || 0,
                                        shared_blks_hit: parseInt(parsedResult[`shared_blks_hit_${i}`]) || 0,
                                        shared_blks_read: parseInt(parsedResult[`shared_blks_read_${i}`]) || 0,
                                        hit_cache_ratio: parseFloat(parsedResult[`hit_cache_ratio_${i}`]) || 0,
                                        query: parsedResult[`query_${i}`]
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    rolname: row.rolname || '',
                                    calls: parseInt(row.calls) || 0,
                                    shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                    query: row.query || ''
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    rolname: row.rolname || '',
                                    calls: parseInt(row.calls) || 0,
                                    shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                    query: row.query || ''
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    rolname: row.rolname || '',
                                    calls: parseInt(row.calls) || 0,
                                    shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                    query: row.query || ''
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                rolname: row.rolname || '',
                                calls: parseInt(row.calls) || 0,
                                shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                query: row.query || ''
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı - console'da gördüğümüz format
                            // Bu durumda parsedResult'ın kendisi bir nesne olabilir
                            if (parsedResult.rolname) {
                                queryResult.push({
                                    rolname: parsedResult.rolname || '',
                                    calls: parseInt(parsedResult.calls) || 0,
                                    shared_blks_hit: parseInt(parsedResult.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(parsedResult.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(parsedResult.hit_cache_ratio) || 0,
                                    query: parsedResult.query || ''
                                });
                            }
                        }

                        setQueryResultsCacheHitRatio(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                        console.log('Raw result:', result);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingCacheHitQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingCacheHitQueryResults(false);
        }
    };

    const fetchQueryUserAccessList = async (nodeName: string) => {
        try {
            setIsLoadingUserAccessListResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                SELECT usename, usesuper FROM pg_user;
            `;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_user_access_list',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed user access list result:', parsedResult); // Debug için

                        const queryResult: QueryResultUserAccessList[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`usename_${i}`] !== '') {
                                    queryResult.push({
                                        username: parsedResult[`usename_${i}`],
                                        isSuperuser: parsedResult[`usesuper_${i}`] === true
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    username: row.usename || '',
                                    isSuperuser: row.usesuper === true
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    username: row.usename || '',
                                    isSuperuser: row.usesuper === true
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    username: row.usename || '',
                                    isSuperuser: row.usesuper === true
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                username: row.usename || '',
                                isSuperuser: row.usesuper === true
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı
                            if (parsedResult.usename) {
                                queryResult.push({
                                    username: parsedResult.usename || '',
                                    isSuperuser: parsedResult.usesuper === true
                                });
                            }
                        }

                        setQueryResultsUserAccessList(queryResult);
        } catch (error) {
                        console.error('Error parsing user access list result:', error);
                        console.log('Raw user access list result:', result);
                    }
                } else {
                    console.error('Unexpected user access list result type:', result.type_url);
                }
            } else {
                console.error('Invalid user access list response format:', data);
            }
            setIsLoadingUserAccessListResults(false);
        } catch (error) {
            console.error('Error fetching user access list data:', error);
            setIsLoadingUserAccessListResults(false);
        }
    };


    const fetchQueryLongRunningResults = async (nodeName: string) => {
        try {
            setIsLoadingLongRunningQueryResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                SELECT 
                    datname as datName,
                    pid,
                    usename as userName,
                    application_name as applicationName,
                    query_start as queryStart,
                    state,
                    wait_event_type as waitEventType,
                    wait_event as waitEvent,
                    query,
                    EXTRACT(EPOCH FROM (now() - query_start))::int as duration
                FROM pg_stat_activity 
                WHERE state != 'idle' 
                AND pid != pg_backend_pid() 
                AND EXTRACT(EPOCH FROM (now() - query_start)) > 1 
                AND usename != 'replica'
                ORDER BY duration DESC;
            `;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_longrunning',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed result:', parsedResult); // Debug için

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult: QueryResultLongRunning[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`datName_${i}`] !== '') {
                                    queryResult.push({
                                        datName: parsedResult[`datName_${i}`],
                                        pid: parseInt(parsedResult[`pid_${i}`]) || 0,
                                        userName: parsedResult[`userName_${i}`],
                                        applicationName: parsedResult[`applicationName_${i}`],
                                        queryStart: parsedResult[`queryStart_${i}`],
                                        state: parsedResult[`state_${i}`],
                                        waitEventType: parsedResult[`waitEventType_${i}`] || null,
                                        waitEvent: parsedResult[`waitEvent_${i}`] || null,
                                        query: parsedResult[`query_${i}`],
                                        duration: parseInt(parsedResult[`duration_${i}`]) || 0
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    datName: row.datname || '',
                                    pid: parseInt(row.pid) || 0,
                                    userName: row.username || '',
                                    applicationName: row.applicationname || '',
                                    queryStart: row.querystart || '',
                                    state: row.state || '',
                                    waitEventType: row.waiteventtype || null,
                                    waitEvent: row.waitevent || null,
                                    query: row.query || '',
                                    duration: parseInt(row.duration) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    datName: row.datname || '',
                                    pid: parseInt(row.pid) || 0,
                                    userName: row.username || '',
                                    applicationName: row.applicationname || '',
                                    queryStart: row.querystart || '',
                                    state: row.state || '',
                                    waitEventType: row.waiteventtype || null,
                                    waitEvent: row.waitevent || null,
                                    query: row.query || '',
                                    duration: parseInt(row.duration) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    datName: row.datname || '',
                                    pid: parseInt(row.pid) || 0,
                                    userName: row.username || '',
                                    applicationName: row.applicationname || '',
                                    queryStart: row.querystart || '',
                                    state: row.state || '',
                                    waitEventType: row.waiteventtype || null,
                                    waitEvent: row.waitevent || null,
                                    query: row.query || '',
                                    duration: parseInt(row.duration) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                datName: row.datname || '',
                                pid: parseInt(row.pid) || 0,
                                userName: row.username || '',
                                applicationName: row.applicationname || '',
                                queryStart: row.querystart || '',
                                state: row.state || '',
                                waitEventType: row.waiteventtype || null,
                                waitEvent: row.waitevent || null,
                                query: row.query || '',
                                duration: parseInt(row.duration) || 0
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı - console'da gördüğümüz format
                            // Bu durumda parsedResult'ın kendisi bir nesne olabilir
                            if (parsedResult.datname) {
                                queryResult.push({
                                    datName: parsedResult.datname || '',
                                    pid: parseInt(parsedResult.pid) || 0,
                                    userName: parsedResult.username || '',
                                    applicationName: parsedResult.applicationname || '',
                                    queryStart: parsedResult.querystart || '',
                                    state: parsedResult.state || '',
                                    waitEventType: parsedResult.waiteventtype || null,
                                    waitEvent: parsedResult.waitevent || null,
                                    query: parsedResult.query || '',
                                    duration: parseInt(parsedResult.duration) || 0
                                });
                            }
                        }

                        setQueryResultsLongRunning(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                        console.log('Raw result:', result);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingLongRunningQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingLongRunningQueryResults(false);
        }
    };

    const fetchQueryLocksResults = async (nodeName: string) => {
        try {
            setIsLoadingLocksResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `WITH lock_info AS (
                     SELECT 
                         pg_locks.locktype,
                         pg_locks.database,
                         pg_locks.relation,
                         pg_locks.page,
                         pg_locks.tuple,
                         pg_locks.virtualxid,
                         pg_locks.transactionid,
                         pg_locks.classid,
                         pg_locks.objid,
                         pg_locks.objsubid,
                         pg_locks.virtualtransaction,
                         pg_locks.pid,
                         pg_locks.mode,
                         pg_locks.granted,
                         pg_stat_activity.query AS query_text,
                         pg_stat_activity.state AS query_state,
                         pg_stat_activity.query_start,
                         pg_stat_activity.application_name,
                         pg_stat_activity.client_addr,
                         pg_stat_activity.client_port
                     FROM pg_locks
                     JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
                 )
                 SELECT 
                     waiting.query_text AS waiting_query,
                     waiting.pid AS waiting_pid,
                     waiting.query_start AS waiting_query_start,
                     waiting.locktype AS waiting_locktype,
                     waiting.mode AS waiting_lockmode,
                     blocking.query_text AS blocking_query,
                     blocking.pid AS blocking_pid,
                     blocking.query_start AS blocking_query_start,
                     blocking.locktype AS blocking_locktype,
                     blocking.mode AS blocking_lockmode,
                     blocking.granted AS blocking_granted,
                     waiting.client_addr AS waiting_client,
                     blocking.client_addr AS blocking_client
                 FROM 
                     lock_info waiting
                 JOIN 
                     lock_info blocking ON 
                         waiting.locktype = blocking.locktype
                         AND waiting.database IS NOT DISTINCT FROM blocking.database
                         AND waiting.relation IS NOT DISTINCT FROM blocking.relation
                         AND waiting.page IS NOT DISTINCT FROM blocking.page
                         AND waiting.tuple IS NOT DISTINCT FROM blocking.tuple
                         AND waiting.virtualxid IS NOT DISTINCT FROM blocking.virtualxid
                         AND waiting.transactionid IS NOT DISTINCT FROM blocking.transactionid
                         AND waiting.classid IS NOT DISTINCT FROM blocking.classid
                         AND waiting.objid IS NOT DISTINCT FROM blocking.objid
                         AND waiting.objsubid IS NOT DISTINCT FROM blocking.objsubid
                         AND waiting.pid != blocking.pid
                 WHERE 
                     waiting.granted = false
                     AND blocking.granted = true
                 ORDER BY 
                     waiting.query_start;`;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_locks',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed result:', parsedResult); // Debug için

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult = [];
                        const rowCount = parsedResult.row_count || 0;

                        for (let i = 0; i < rowCount; i++) {
                            if (parsedResult[`waiting_query_${i}`] !== '') {
                                queryResult.push({
                                    waitingQuery: parsedResult[`waiting_query_${i}`],
                                    waitingPid: parsedResult[`waiting_pid_${i}`],
                                    waitingQueryStart: parsedResult[`waiting_query_start_${i}`],
                                    waitingLockType: parsedResult[`waiting_locktype_${i}`],
                                    waitingLockMode: parsedResult[`waiting_lockmode_${i}`],
                                    blockingQuery: parsedResult[`blocking_query_${i}`],
                                    blockingPid: parsedResult[`blocking_pid_${i}`],
                                    blockingQueryStart: parsedResult[`blocking_query_start_${i}`],
                                    blockingLockType: parsedResult[`blocking_locktype_${i}`],
                                    blockingLockMode: parsedResult[`blocking_lockmode_${i}`],
                                    blockingGranted: parsedResult[`blocking_granted_${i}`] === 'true',
                                    waitingClient: parsedResult[`waiting_client_${i}`],
                                    blockingClient: parsedResult[`blocking_client_${i}`]
                                });
                            }
                        }

                        setQueryResultsLocks(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                        console.log('Raw result:', result);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingLocksResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingLocksResults(false);
        }
    };

    const fetchSystemMetrics = async (nodeNameParam: string) => {
        if (!nodeNameParam) {
            console.error('METRICS: fetchSystemMetrics called without nodeName');
            return;
        }

        console.log(`METRICS: Starting to fetch system metrics for node ${nodeNameParam}`);
        
        // Set loading state
        setIsLoadingMetrics(true);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            
            const agentId = `agent_${nodeNameParam}`;
            const url = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/metrics`;
            console.log(`METRICS: Fetching metrics from URL: ${url}`);
            
            const response = await fetch(url, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            
            console.log(`METRICS: Received response with status ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Error fetching metrics: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('METRICS: Raw response data:', JSON.stringify(data, null, 2));
            
            // Metrics data from response (expecting data.metrics structure)
            const metricsData = data.metrics || data;
            
            // Directly set the metrics state without delay or timeout
            setSystemMetrics({
                cpu_usage: metricsData?.cpu_usage || metricsData?.cpu_percentage || 0,
                cpu_cores: metricsData?.cpu_cores || 0,
                memory_usage: metricsData?.memory_usage || metricsData?.memory_percentage || 0,
                total_memory: metricsData?.total_memory || 0,
                free_memory: metricsData?.free_memory || 0,
                load_average_1m: metricsData?.load_average_1m || 0,
                load_average_5m: metricsData?.load_average_5m || 0,
                load_average_15m: metricsData?.load_average_15m || 0,
                total_disk: metricsData?.total_disk || 0,
                free_disk: metricsData?.free_disk || 0,
                os_version: metricsData?.os_version || 'Unknown',
                kernel_version: metricsData?.kernel_version || 'Unknown',
                uptime: metricsData?.uptime || 0
            });
            
            console.log('METRICS: Updated system metrics state');
        } catch (error) {
            console.error('METRICS: Error fetching system metrics:', error);
            
            // Show error message to user
            message.error(`Failed to load metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            // Set default metrics in case of error
            setSystemMetrics({
                cpu_usage: 0,
                cpu_cores: 0,
                memory_usage: 0,
                total_memory: 0,
                free_memory: 0,
                load_average_1m: 0,
                load_average_5m: 0,
                load_average_15m: 0,
                total_disk: 0,
                free_disk: 0,
                os_version: 'Error',
                kernel_version: 'Error',
                uptime: 0
            });
        } finally {
            // Always set loading state to false when done
            setIsLoadingMetrics(false);
            console.log('METRICS: Fetch operation completed');
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

    const fetchQueryTopCpuResults = useCallback(async (nodeName: string) => {
        if (!nodeName) return;
        try {
            setIsLoadingTopCpuQueryResults(true);
            const agentId = `agent_${nodeName}`;

            // PostgreSQL versiyonunu kontrol et
            const selectedNodeInfo = nodeInfo.find(node => node.name === nodeName);
            const PGVersion = selectedNodeInfo ? selectedNodeInfo.PGVersion : 'unknown';

            // Versiyon numarasını çıkar (örn: "14.7" -> 14)
            const pgVersionMajor = parseInt(PGVersion.split('.')[0]);

            // Versiyona göre sorgu seç
            let query;
            if (pgVersionMajor < 13) {
                query = `SELECT  pu.usename, pd.datname as db_name, round(pss.total_time::numeric, 2) as total_time, pss.calls, round(pss.mean_time::numeric, 2) as mean, round((100 * pss.total_time / sum(pss.total_time::numeric) OVER ())::numeric, 2) as cpu_portion_pctg, pss.query as short_query FROM pg_stat_statements pss JOIN pg_database pd ON pd.oid = pss.dbid JOIN pg_user pu ON pu.usesysid = pss.userid where pd.datname not in ('pmm_user','postgres') ORDER BY pss.total_time DESC LIMIT 10;`;
            } else {
                query = `SELECT  pu.usename, pd.datname as db_name, round((pss.total_exec_time + pss.total_plan_time)::numeric, 2) as total_time, pss.calls, round((pss.mean_exec_time + pss.mean_plan_time)::numeric, 2) as mean, round((100 * (pss.total_exec_time + pss.total_plan_time) / sum((pss.total_exec_time + pss.total_plan_time)::numeric) OVER ())::numeric, 2) as cpu_portion_pctg, pss.query as short_query FROM pg_stat_statements pss JOIN pg_database pd ON pd.oid = pss.dbid JOIN pg_user pu ON pu.usesysid = pss.userid where pd.datname not in ('pmm_user','postgres') ORDER BY (pss.total_exec_time + pss.total_plan_time) DESC LIMIT 10;`;
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_topcpu',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        const decodedValue = atob(result.value);
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed result:', parsedResult);

                        if (parsedResult.status === 'error' && parsedResult.message && parsedResult.message.includes('pg_stat_statements')) {
                            message.error({
                                content: (
                                    <div>
                                        <p><strong>Error:</strong> pg_stat_statements extension is not installed.</p>
                                        <p>To install the extension, run the following SQL command as a superuser:</p>
                                        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                                            CREATE EXTENSION pg_stat_statements;
                                        </pre>
                                        <p>After installation, you may need to restart the PostgreSQL server.</p>
                                    </div>
                                ),
                                duration: 10
                            });
                            setQueryResultsTopCpu([]);
                            return;
                        }

                        const queryResult = [];
                        const rowCount = parsedResult.row_count || 0;

                        for (let i = 0; i < rowCount; i++) {
                            if (parsedResult[`usename_${i}`] !== '') {
                                queryResult.push({
                                    usename: parsedResult[`usename_${i}`],
                                    db_name: parsedResult[`db_name_${i}`],
                                    total_time: parsedResult[`total_time_${i}`],
                                    calls: parsedResult[`calls_${i}`],
                                    mean: parsedResult[`mean_${i}`],
                                    cpu_portion_pctg: parsedResult[`cpu_portion_pctg_${i}`],
                                    short_query: parsedResult[`short_query_${i}`]
                                });
                            }
                        }

                        setQueryResultsTopCpu(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                        message.error('Error parsing query result');
                        setQueryResultsTopCpu([]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            message.error('Error fetching query results');
            setQueryResultsTopCpu([]);
        } finally {
            setIsLoadingTopCpuQueryResults(false);
        }
    }, [nodeInfo]); // Sadece nodeInfo'yu dependency olarak ekliyoruz

    const fetchPgBouncerStats = async (nodeName: string) => {
        try {
            setIsLoadingPgBouncerStats(true)
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/pgbouncer_stats`);

            let nodeStats: PgBouncerStat[] = [];

            for (const item of response.data) {
                if (item[nodeName]) {
                    nodeStats = item[nodeName];
                    break;
                }
            }
            setIsLoadingPgBouncerStats(false)

            setPgBouncerStats(nodeStats);
        } catch (error) {
            console.error('Error fetching PgBouncer stats:', error);
        }
    };

    const fetchQueryUnusedIndexes = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingUnusedIndexesResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                select 'regular index' as indextype,
                    stats_child.schemaname,
                    stats_child.relname AS tablename,
                    c.relname as indexname,
                    index_columns.idx_columns as idx_columns,
                    stats_child.idx_scan as id_scan_count,
                    pg_relation_size(stats_child.indexrelid) as index_size 
                from pg_class c 
                join pg_index idx_parent on idx_parent.indexrelid = c.oid 
                join pg_catalog.pg_stat_user_indexes stats_child on c.oid = stats_child.indexrelid, 
                LATERAL (
                    SELECT string_agg(attname, ', ' order by attnum) AS idx_columns 
                    FROM pg_attribute 
                    WHERE attrelid = c.oid
                ) index_columns 
                where c.relkind = 'i' 
                AND 0 <>ALL (idx_parent.indkey) 
                AND NOT idx_parent.indisunique  
                AND NOT EXISTS (
                    SELECT 1 
                    FROM pg_catalog.pg_constraint cc 
                    WHERE cc.conindid = idx_parent.indexrelid
                ) 
                AND NOT EXISTS (
                    SELECT 1 
                    FROM pg_inherits pi 
                    where pi.inhrelid = c.oid
                ) 
                and stats_child.relname not like '%template';
            `;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_unused_indexes',
                    command: query,
                    database: dbName
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed unused indexes result:', parsedResult); // Debug için

                        const queryResult: QueryResultUnusedIndexes[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`indextype_${i}`] !== '') {
                                    queryResult.push({
                                        indextype: parsedResult[`indextype_${i}`],
                                        schemaname: parsedResult[`schemaname_${i}`],
                                        tablename: parsedResult[`tablename_${i}`],
                                        indexname: parsedResult[`indexname_${i}`],
                                        idx_columns: parsedResult[`idx_columns_${i}`],
                                        id_scan_count: parseInt(parsedResult[`id_scan_count_${i}`]) || 0,
                                        index_size: parseInt(parsedResult[`index_size_${i}`]) || 0
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    indextype: row.indextype || '',
                                    schemaname: row.schemaname || '',
                                    tablename: row.tablename || '',
                                    indexname: row.indexname || '',
                                    idx_columns: row.idx_columns || '',
                                    id_scan_count: parseInt(row.id_scan_count) || 0,
                                    index_size: parseInt(row.index_size) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    indextype: row.indextype || '',
                                    schemaname: row.schemaname || '',
                                    tablename: row.tablename || '',
                                    indexname: row.indexname || '',
                                    idx_columns: row.idx_columns || '',
                                    id_scan_count: parseInt(row.id_scan_count) || 0,
                                    index_size: parseInt(row.index_size) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    indextype: row.indextype || '',
                                    schemaname: row.schemaname || '',
                                    tablename: row.tablename || '',
                                    indexname: row.indexname || '',
                                    idx_columns: row.idx_columns || '',
                                    id_scan_count: parseInt(row.id_scan_count) || 0,
                                    index_size: parseInt(row.index_size) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                indextype: row.indextype || '',
                                schemaname: row.schemaname || '',
                                tablename: row.tablename || '',
                                indexname: row.indexname || '',
                                idx_columns: row.idx_columns || '',
                                id_scan_count: parseInt(row.id_scan_count) || 0,
                                index_size: parseInt(row.index_size) || 0
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı
                            if (parsedResult.indextype) {
                                queryResult.push({
                                    indextype: parsedResult.indextype || '',
                                    schemaname: parsedResult.schemaname || '',
                                    tablename: parsedResult.tablename || '',
                                    indexname: parsedResult.indexname || '',
                                    idx_columns: parsedResult.idx_columns || '',
                                    id_scan_count: parseInt(parsedResult.id_scan_count) || 0,
                                    index_size: parseInt(parsedResult.index_size) || 0
                                });
                            }
                        }

                        setQueryResultsUnusedIndexes(queryResult);
        } catch (error) {
                        console.error('Error parsing unused indexes result:', error);
                        console.log('Raw unused indexes result:', result);
                    }
                } else {
                    console.error('Unexpected unused indexes result type:', result.type_url);
                }
            } else {
                console.error('Invalid unused indexes response format:', data);
            }
            setIsLoadingUnusedIndexesResults(false);
        } catch (error) {
            console.error('Error fetching unused indexes data:', error);
            setIsLoadingUnusedIndexesResults(false);
        }
    };

    const fetchQueryIndexBloat = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingIndexBloatResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                WITH index_bloat AS (
                    SELECT
                        current_database() AS db_name,
                        n.nspname AS schema_name,
                        t.relname AS table_name,
                        i.indexrelid::regclass::text AS index_name,
                        t.reltuples::bigint AS num_rows,
                        t.relpages::bigint AS total_pages,
                        CEIL(t.reltuples * (pg_column_size(t) + 4) / 8192.0) AS expected_pages,
                        t.relpages - CEIL(t.reltuples * (pg_column_size(t) + 4) / 8192.0) AS bloat_pages
                    FROM
                        pg_stat_user_indexes i
                        JOIN pg_class t ON i.relid = t.oid
                        JOIN pg_namespace n ON t.relnamespace = n.oid
                    WHERE
                        t.relpages > 0
                )
                SELECT
                    db_name,
                    schema_name,
                    table_name,
                    index_name,
                    num_rows,
                    total_pages,
                    expected_pages,
                    bloat_pages,
                    bloat_pages / total_pages::float*100 AS bloat_ratio,
                    CASE 
                        WHEN bloat_pages / total_pages::float*100 >= 50 THEN 3
                        WHEN bloat_pages / total_pages::float*100 >= 25 THEN 2
                        WHEN bloat_pages / total_pages::float*100 > 0 THEN 1
                        ELSE 0
                    END AS fragmentation_level
                FROM index_bloat
                WHERE bloat_pages > 0
                ORDER BY bloat_ratio DESC;
            `;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_index_bloat',
                    command: query,
                    database: dbName
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed index bloat result:', parsedResult); // Debug için

                        const queryResult: QueryResultIndexBloat[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`db_name_${i}`] !== '') {
                                    queryResult.push({
                                        db_name: parsedResult[`db_name_${i}`],
                                        schema_name: parsedResult[`schema_name_${i}`],
                                        table_name: parsedResult[`table_name_${i}`],
                                        index_name: parsedResult[`index_name_${i}`],
                                        num_rows: parseInt(parsedResult[`num_rows_${i}`]) || 0,
                                        total_pages: parseInt(parsedResult[`total_pages_${i}`]) || 0,
                                        expected_pages: parseInt(parsedResult[`expected_pages_${i}`]) || 0,
                                        bloat_pages: parseInt(parsedResult[`bloat_pages_${i}`]) || 0,
                                        bloat_ratio: parseFloat(parsedResult[`bloat_ratio_${i}`]) || 0,
                                        fragmentation_level: parseInt(parsedResult[`fragmentation_level_${i}`]) || 0
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    index_name: row.index_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    expected_pages: parseInt(row.expected_pages) || 0,
                                    bloat_pages: parseInt(row.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    index_name: row.index_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    expected_pages: parseInt(row.expected_pages) || 0,
                                    bloat_pages: parseInt(row.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    index_name: row.index_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    expected_pages: parseInt(row.expected_pages) || 0,
                                    bloat_pages: parseInt(row.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                db_name: row.db_name || '',
                                schema_name: row.schema_name || '',
                                table_name: row.table_name || '',
                                index_name: row.index_name || '',
                                num_rows: parseInt(row.num_rows) || 0,
                                total_pages: parseInt(row.total_pages) || 0,
                                expected_pages: parseInt(row.expected_pages) || 0,
                                bloat_pages: parseInt(row.bloat_pages) || 0,
                                bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                fragmentation_level: parseInt(row.fragmentation_level) || 0
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı
                            if (parsedResult.db_name) {
                                queryResult.push({
                                    db_name: parsedResult.db_name || '',
                                    schema_name: parsedResult.schema_name || '',
                                    table_name: parsedResult.table_name || '',
                                    index_name: parsedResult.index_name || '',
                                    num_rows: parseInt(parsedResult.num_rows) || 0,
                                    total_pages: parseInt(parsedResult.total_pages) || 0,
                                    expected_pages: parseInt(parsedResult.expected_pages) || 0,
                                    bloat_pages: parseInt(parsedResult.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(parsedResult.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(parsedResult.fragmentation_level) || 0
                                });
                            }
                        }

                        setQueryResultsIndexBloat(queryResult);
        } catch (error) {
                        console.error('Error parsing index bloat result:', error);
                        console.log('Raw index bloat result:', result);
                    }
                } else {
                    console.error('Unexpected index bloat result type:', result.type_url);
                }
            } else {
                console.error('Invalid index bloat response format:', data);
            }
            setIsLoadingIndexBloatResults(false);
        } catch (error) {
            console.error('Error fetching index bloat data:', error);
            setIsLoadingIndexBloatResults(false);
        }
    };

    const fetchQueryDbStats = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingDbStatsResults(true);
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/run_pg_dbstats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName, dbName: dbName }),
            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json() as QueryResultDbStats[];
            setQueryResultsDbStats(data);
            setIsLoadingDbStatsResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingDbStatsResults(false);
        }
    };


    const handleDatabaseChange = (value: string) => {
        if (activeTab === '3') {
            setSelectedDatabase(value);
            fetchDatabases(nodeName)
            fetchQueryUnusedIndexes(nodeName, selectedDatabase)
            fetchQueryIndexBloat(nodeName, selectedDatabase)
            // Database seçimi ile ilgili işlemler
        } else if (activeTab === '6') {
            setSelectedDatabase(value);
            fetchDatabases(nodeName)
            fetchQueryDbStats(nodeName, selectedDatabase)
        }

    };

    const handleNodeChange = (value: string) => {
        setNodeName(value);
        if (activeTab === '4') {
            fetchSystemMetrics(value);
        }
    };

    const handleLogFileChange = async (selectedFileName: string) => {
        const selectedLogFile = pgLogFiles.find(log => log.name === selectedFileName);
        if (selectedLogFile) {
            setLoading(true);
            setCurrentStep(3)
            setSelectedFullPath(selectedLogFile.fullPath);
            const postData = {
                ...selectedLogFile,
                hostname: nodeName,
                fullPath: selectedLogFile.fullPath,
            };

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/parse_postgres_log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData)
            });

            setLoading(false);
            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    // Hata mesajını kullanıcıya göster
                    message.error(data.error);
                    setLogContent(""); // logContent'i boşalt
                } else {
                    setLogContent(data.content);
                }
            } else {
                console.error('Failed to fetch log content');
            }
        }
    };

    const handleFilterLogs = async (selectedFullPath: string, startTime: Dayjs, endTime: Dayjs) => {
        const selectedLogFile = pgLogFiles.find(logFile => logFile.fullPath === selectedFullPath);
        if (selectedLogFile && startTime && endTime) {
            setLoading(true);

            const formattedStartDate = startTime.format('HH:mm:ss');
            const formattedEndDate = endTime.format('HH:mm:ss');

            const postData = {
                ...selectedLogFile,
                hostname: nodeName,
                startDate: formattedStartDate,
                endDate: formattedEndDate
            };

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/parse_postgres_log_with_date`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData)
            });

            setLoading(false);
            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    message.error(data.error);
                    setLogContent("");
                } else {
                    setLogContent(data.content);
                }
            } else {
                console.error('Failed to fetch log content');
                message.error('Failed to fetch log content');
            }
        }
    };


    const fetchDatabases = async (nodeName: string) => {
        try {
            const agentId = `agent_${nodeName}`;

            const query = `
                SELECT datname 
                FROM pg_database 
                WHERE datistemplate = false 
                AND datname NOT IN ('postgres', 'template0', 'template1')
                ORDER BY datname;
            `;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_databases',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);
                        console.log('Parsed databases result:', parsedResult); // Debug için

                        const databases: Database[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`datname_${i}`] !== '') {
                                    databases.push({
                                        datname: parsedResult[`datname_${i}`]
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                if (row.datname) {
                                    databases.push({
                                        datname: row.datname
                                    });
                                }
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                if (row.datname) {
                                    databases.push({
                                        datname: row.datname
                                    });
                                }
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                if (row.datname) {
                                    databases.push({
                                        datname: row.datname
                                    });
                                }
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            if (parsedResult.map.datname) {
                                databases.push({
                                    datname: parsedResult.map.datname
                                });
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.datname) {
                            // Doğrudan nesne formatı
                            databases.push({
                                datname: parsedResult.datname
                            });
                        }

                        // Veritabanı isimlerini ayarla
                        const dbNames = databases.map(db => db.datname);
            setDatabaseNames(dbNames);

                        if (dbNames.length > 0) {
                            setSelectedDatabase(dbNames[0]);
                        }
        } catch (error) {
                        console.error('Error parsing databases result:', error);
                        console.log('Raw databases result:', result);
                    }
                } else {
                    console.error('Unexpected databases result type:', result.type_url);
                }
            } else {
                console.error('Invalid databases response format:', data);
            }
        } catch (error) {
            console.error('Error fetching databases:', error);
        }
    };

    const fetchPostgresLogs = async (nodeName: string) => {
        try {
            setLoadingPgLogs(true);

            // Axios ile POST isteği yaparak JSON body içinde nodeName gönder
            const response = await axios.post(`https://dbstatus-api.hepsi.io/get_postgres_logs`, {
                nodeName: nodeName // Burada JSON body içinde nodeName kullan
            });

            if (response.data && response.data.recentFiles) {
                const logs = response.data.recentFiles.map((file: LogFile) => {
                    return {
                        name: file.name, // 'name' özelliğini ayarla
                        path: response.data.logPath,
                        fullPath: `${response.data.logPath}/${file.name}`,
                        timeRange: file.timeRange // 'timeRange' özelliği varsa ekle
                    };
                });
                setPgLogFiles(logs);
            } else {
                message.error('No log files found for the selected node');
            }
        } catch (error) {
            console.error('Error fetching log files:', error);
            message.error('Failed to fetch log files');
        } finally {
            setLoadingPgLogs(false);
        }
    };



    useEffect(() => {
        let countdownTimer: number | null = null;
        
        // refreshInterval değiştiğinde countdown'ı sıfırla
        setCountdown(refreshInterval);
        
        if (refreshInterval > 0) {
            countdownTimer = window.setInterval(() => {
                setCountdown((prevCount) => {
                    // countdown 1'e ulaştığında refresh interval'a geri dön
                    if (prevCount <= 1) {
                    return refreshInterval;
                }
                    // değilse 1 azalt
                    return prevCount - 1;
            });
        }, 1000);
        }
        
        // Clean up function
        return () => {
            if (countdownTimer) {
                window.clearInterval(countdownTimer);
            }
        };
    }, [refreshInterval]);

    // Ana veri çekme useEffect
    useEffect(() => {
        let intervalId: number | null = null;
        let isMounted = true;
        let currentRequestController: AbortController | null = null;

        // Veri çekme fonksiyonu
        const fetchData = async () => {
            if (!nodeName || !isMounted) return;

            // Önceki isteği iptal et
            if (currentRequestController) {
                currentRequestController.abort();
                console.log('Aborted previous request');
            }

            // Yeni bir controller oluştur
            currentRequestController = new AbortController();
            const timeoutId = setTimeout(() => {
                if (currentRequestController) {
                    console.log('Request timed out, aborting');
                    currentRequestController.abort();
                }
            }, 30000); // 30 saniye timeout

            try {
                console.log(`Fetching data for submenu: ${selectedSubMenu}`);
                
                // selectedSubMenu'ye göre API çağrılarını yap
                if (selectedSubMenu === 'pgbouncer') {
                    await fetchPgBouncerStats(nodeName);
                } else if (selectedSubMenu === 'connections') {
                    await fetchQueryResults(nodeName);
                } else if (selectedSubMenu === 'connections-by-app') {
                    await fetchQueryNonIdleConnsResults(nodeName);
                } else if (selectedSubMenu === 'top-cpu') {
                    await fetchQueryTopCpuResults(nodeName);
                } else if (selectedSubMenu === 'cache-hit') {
                    await fetchQueryCacheHitRatioResults(nodeName);
                } else if (selectedSubMenu === 'long-running') {
                    await fetchQueryLongRunningResults(nodeName);
                } else if (selectedSubMenu === 'blocking') {
                    await fetchQueryLocksResults(nodeName);
                } else if (selectedSubMenu === 'index-usage' && selectedDatabase) {
                    await fetchQueryUnusedIndexes(nodeName, selectedDatabase);
                } else if (selectedSubMenu === 'index-bloat' && selectedDatabase) {
                    await fetchQueryIndexBloat(nodeName, selectedDatabase);
                } else if (selectedSubMenu === 'system' && activeTab === '4' && refreshInterval > 0) {
                    console.log('Fetching metrics data due to refresh interval');
                    await fetchSystemMetrics(nodeName);
                } else if (selectedSubMenu === 'logs') {
                    await fetchPostgresLogs(nodeName);
                } else if (selectedSubMenu === 'db-stats' && selectedDatabase) {
                    await fetchQueryDbStats(nodeName, selectedDatabase);
                } else if (selectedSubMenu === 'user-access-list') {
                    await fetchQueryUserAccessList(nodeName);
                }
                
                // Database listesi gerektiren sayfalar için
                if (selectedSubMenu === 'index-usage' || selectedSubMenu === 'index-bloat' || 
                    selectedSubMenu === 'db-stats' || activeTab === '3' || activeTab === '6') {
                    await fetchDatabases(nodeName);
                }
                
                console.log('Fetch completed successfully');
            } catch (error: unknown) {
                if (error instanceof Error && error.name === 'AbortError') {
                    console.log('Fetch aborted due to timeout or manual abort');
                    return;
                }
                console.error('Error in fetchData:', error);
            } finally {
                clearTimeout(timeoutId);
            }
        };

        // İlk yükleme için tek seferlik çağrı
        fetchData();

        // Refresh interval ayarla
        if (refreshInterval > 0) {
            intervalId = window.setInterval(fetchData, refreshInterval * 1000);
        }

        // Cleanup
        return () => {
            console.log('Cleaning up data fetch useEffect');
            isMounted = false;
            if (intervalId !== null) {
                clearInterval(intervalId);
            }
            if (currentRequestController) {
                currentRequestController.abort();
            }
        };
    }, [refreshInterval, nodeName, activeTab, selectedSubMenu, selectedDatabase]);

    // Ana useEffect'e currentStep ayarlamayı ekleyelim
    useEffect(() => {
        if (nodeName) {
            // activeTab değerine göre currentStep'i ayarlama
            if (activeTab === '3' || activeTab === '6') {
                setCurrentStep(3);
            } else if (activeTab === '4' || activeTab === '5' || activeTab === '7') {
                setCurrentStep(2);
            } else {
                setCurrentStep(2);
            }
        }
    }, [nodeName, activeTab]);

    // API'den veri çekme ve cluster isimlerini ayarlama.
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingClusterName(true)
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/postgres`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    withCredentials: true
                });

                if (response.data && response.data.data && Array.isArray(response.data.data)) {
                    const clusterData: ClusterData[] = response.data.data;

                // Cluster isimlerini çıkarmak için döngü
                const clusterNames = clusterData.map(obj => Object.keys(obj)[0]);
                const data = clusterData.reduce<Record<string, Node[]>>((acc, curr) => {
                    const key = Object.keys(curr)[0];
                    return { ...acc, [key]: curr[key] };
                }, {});

                setData(data);
                setClusterNames(clusterNames);
                } else {
                    console.error('Invalid API response structure');
                }
                setLoadingClusterName(false)
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoadingClusterName(false)
            }
        };
        fetchData();
    }, []);


    useEffect(() => {
        if (clusterName) {
            setCurrentStep(1);
            const selectedCluster = data[clusterName];
            if (selectedCluster) {
                const nodeInfo = selectedCluster.map(node => ({
                    name: node.Hostname,
                    status: node.NodeStatus,
                    PGVersion: node.PGVersion
                }));
                setNodeInfo(nodeInfo);
            } else {
                setNodeInfo([]);
            }
        } else {
            setNodeInfo([]);
        }
    }, [clusterName, data]);

    const formatMemory = (memoryInGB: number): string => {
        if (!memoryInGB || memoryInGB === 0) return '0 MB';
        return `${memoryInGB.toFixed(2)} GB`;
    };

    const getColor = (value: number): string => {
        if (value < 1) return 'green';
        if (value < 2) return 'orange';
        return 'red';
    };

    //database stats.

    const infoTexts: { [key: string]: string } = {
        "active_time": "Time spent executing SQL statements in this database, in milliseconds.",
        "blk_read_time": "Time spent reading data file blocks by backends in this database, in milliseconds (if track_io_timing is enabled, otherwise zero)",
        "blk_write_time": "Time spent writing data file blocks by backends in this database, in milliseconds (if track_io_timing is enabled, otherwise zero)",
        "blks_hit": "Number of times disk blocks were found already in the buffer cache, so that a read was not necessary (this only includes hits in the PostgreSQL buffer cache, not the operating system's file system cache)",
        "blks_read": "Number of disk blocks read in this database",
        "conflicts": "Number of queries canceled due to conflicts with recovery in this database. (Conflicts occur only on standby servers; see pg_stat_database_conflicts for details.)",
        "deadlocks": "Number of deadlocks detected in this database",
        "idle_in_transaction_time": "Time spent idling while in a transaction in this database, in milliseconds (this corresponds to the states idle in transaction and idle in transaction (aborted) in pg_stat_activity)",
        "numbackends": "Number of backends currently connected to this database, or NULL for shared objects. This is the only column in this view that returns a value reflecting current state; all other columns return the accumulated values since the last reset.",
        "session_time": "Time spent by database sessions in this database, in milliseconds (note that statistics are only updated when the state of a session changes, so if sessions have been idle for a long time, this idle time won't be included)",
        "sessions": "Total number of sessions established to this database",
        "sessions_abandoned": "Number of database sessions to this database that were terminated because connection to the client was lost",
        "sessions_fatal": "Number of database sessions to this database that were terminated by fatal errors",
        "sessions_killed": "Number of database sessions to this database that were terminated by operator intervention",
        "stats_reset": "Time at which these statistics were last reset",
        "temp_bytes": "Total amount of data written to temporary files by queries in this database. All temporary files are counted, regardless of why the temporary file was created, and regardless of the log_temp_files setting.",
        "temp_files": "Number of temporary files created by queries in this database. All temporary files are counted, regardless of why the temporary file was created (e.g., sorting or hashing), and regardless of the log_temp_files setting.",
        "tup_deleted": "Number of rows deleted by queries in this database",
        "tup_updated": "Number of rows updated by queries in this database",
        "tup_inserted": "Number of rows inserted by queries in this database",
        "tup_fetched": "Number of live rows fetched by index scans in this database",
        "tup_returned": "Number of live rows fetched by sequential scans and index entries returned by index scans in this database",
        "xact_commit": "Number of transactions in this database that have been committed",
        "xact_rollback": "Number of transactions in this database that have been rolled back",
    };

    const exportToCsv = (filename: string, rows: QueryResultUserAccessList[]) => {
        // Sütun başlıklarını bir dizi olarak tanımla
        const headers = ["User Name", "Super User"];

        // CSV başlıklarını ve içeriğini oluştur
        const csvContent =
            headers.join(",") + // Başlıkları birleştir
            "\n" +
            rows
                .map(row => [
                    row.username, // username değerini al
                    row.isSuperuser ? "Yes" : "No" // isSuperuser boolean değerini "Yes" veya "No" olarak çevir
                ].join(","))
                .join("\n"); // Her satır için birleştir

        // Blob ile CSV dosyasını oluştur ve indir
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderStatistics = (data: QueryResultDbStats) => {
        return Object.entries(data).map(([key, value]) => {
            if (value == null) return null;

            let formattedValue = value;
            if (key === 'stats_reset') {
                const date = new Date(value);
                formattedValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
            } else if (typeof value === 'object' && value.Valid !== undefined) {
                formattedValue = value.Valid ? (value.Float64 || value.Int64) : 0;
            }

            const infoText = infoTexts[key];

            return (
                <Col span={8} key={key} style={{ marginBottom: 20 }}>
                    <Card
                        bordered={false}
                        title={
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ color: 'gray', marginRight: '8px' }}>{key.replace(/_/g, ' ').toUpperCase()}</span>
                                <Tooltip title={infoText}>
                                    <InfoCircleOutlined style={{ color: 'blue', marginRight: '8px' }} />
                                </Tooltip>
                            </div>
                        }
                    >
                        <Statistic
                            loading={isLoadingDbStatsResults}
                            value={formattedValue}
                            valueRender={() => (
                                key !== 'stats_reset' ? <CountUp end={formattedValue} duration={1} /> : <span>{formattedValue}</span>
                            )}
                        />
                    </Card>
                </Col>
            );
        });
    };




    // Alt menü seçildiğinde
    const handleSubMenuClick = (key: string) => {
        console.log(`Submenu selected: ${key}`);
        
        // Eğer önceki seçilen alt menü ile aynıysa, tekrar API çağrısı yapmayı önlemek için return
        if (key === selectedSubMenu) {
            console.log('Same submenu already selected, skipping');
            return;
        }
        
        // Alt menü tipine göre işlem yap ve activeTab değerini güncelle
        switch(key) {
            case 'user-access-list':
                setSelectedSubMenu('user-access-list');
                setActiveTab('7');
                break;
            case 'system':
                setSelectedSubMenu('system');
                setActiveTab('4');
                break;
            case 'logs':
                setSelectedSubMenu('logs');
                setActiveTab('5');
                break;
            case 'db-stats':
                setSelectedSubMenu('db-stats');
                setActiveTab('6');
                break;
            case 'pgbouncer':
            case 'connections':
            case 'connections-by-app':
                setSelectedSubMenu(key);
                setActiveTab('1');
                break;
            case 'top-cpu':
            case 'blocking':
            case 'long-running':
            case 'cache-hit':
                setSelectedSubMenu(key);
                setActiveTab('2');
                break;
            case 'index-usage':
            case 'index-bloat':
                setSelectedSubMenu(key);
                setActiveTab('3');
                break;
            default:
                setSelectedSubMenu(key);
        }
    };

    // Render fonksiyonları
    const renderConnectionsContent = () => {
        switch (selectedSubMenu) {
            case 'pgbouncer':
                return (
                            <div style={{ marginTop: 10 }}>
                                <Table loading={isLoadingPgBouncerStats} dataSource={pgBouncerStats} columns={pgBouncerColumns} scroll={{ x: 'max-content' }}
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => fetchPgBouncerStats(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                                    )} />
                            </div>
                );
            case 'connections':
                return (
                    <div style={{ marginTop: 10 }}>
                        <Table
                            dataSource={queryResults}
                            columns={columns}
                            rowKey={(record) => record.total_connections?.toString() || '0'}
                            pagination={false}
                            loading={isLoadingQueryResults}
                                        footer={() => (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button onClick={() => fetchQueryResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                    <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                                </button>
                                            </div>
                                        )}
                                        title={() => (
                                            <div style={{ display: 'flex', alignItems: 'left' }}>
                                            </div>
                                        )} />
                                </div>
                );
            case 'connections-by-app':
                return (
                    <div style={{ marginTop: 10 }}>
                        <Table
                            dataSource={queryResultsNonIdleConns}
                            columns={columnsNonIdleConns}
                            rowKey={(record) => `${record.application_name}-${record.state}`}
                            pagination={false}
                            loading={isLoadingNonIdleQueryResults}
                                        footer={() => (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button onClick={() => fetchQueryNonIdleConnsResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                    <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                                </button>
                                            </div>
                                        )}
                                        title={() => (
                                            <div style={{ display: 'flex', alignItems: 'left' }}>
                                            </div>
                            )} />
                            </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    const renderQueriesContent = () => {
        switch (selectedSubMenu) {
            case 'top-cpu':
                return (
                            <div style={{ marginTop: 10 }}>
                        <Table 
                            pagination={false} 
                            loading={isLoadingTopCpuQueryResults} 
                            dataSource={queryResultsTopCpu.map((result, index) => ({ ...result, key: `cpu-${index}` }))} 
                            columns={columnsTopCpu} 
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => fetchQueryTopCpuResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                            )} 
                        />
                            </div>
                );
            case 'blocking':
                return (
                            <div style={{ marginTop: 10 }}>
                        <Table 
                            pagination={false} 
                            loading={isLoadingLocsResults} 
                            dataSource={queryResultsLocks.map((result, index) => ({ ...result, key: `lock-${index}` }))} 
                            columns={columnsLocks} 
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => fetchQueryLocksResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                            )} 
                        />
                            </div>
                );
            case 'long-running':
                return (
                            <div style={{ marginTop: 10 }}>
                        <Table 
                            pagination={false} 
                            loading={isLoadingLongRunningQueryResults} 
                            dataSource={queryResultsLongRunning.map((result, index) => ({ ...result, key: `long-${index}` }))} 
                            columns={columnsLongRunning} 
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => fetchQueryLongRunningResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                            )} 
                        />
                            </div>
                );
            case 'cache-hit':
                return (
                    <div style={{ marginTop: 10 }}>
                        <Table 
                            pagination={false} 
                            loading={isLoadingCacheHitQueryResults} 
                            dataSource={queryResultsCacheHitRatio.map((result, index) => ({ ...result, key: `cache-${index}` }))} 
                            columns={columnsCacheHitRatio} 
                            scroll={{ x: 'max-content' }} 
                            rowKey="key"
                            rowClassName={(record) => {
                                    return record.hit_cache_ratio < 97 ? 'low-cache-hit-ratio' : '';
                                }}
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => fetchQueryCacheHitRatioResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                            )} 
                        />
                            </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    const renderIndexesContent = () => {
        switch (selectedSubMenu) {
            case 'index-usage':
                return (
                            <div style={{ marginTop: 10 }}>
                        <Table 
                            loading={isLoadingUnusedIndexesResults} 
                            dataSource={queryResultsUnusedIndexes.map((result, index) => ({ ...result, key: `unused-${index}` }))} 
                            columns={columnsUnusedIndexes} 
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => fetchQueryUnusedIndexes(nodeName, selectedDatabase)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                            )} 
                        />
                            </div>
                );
            case 'index-bloat':
                return (
                            <div style={{ marginTop: 10 }}>
                        <Table 
                            loading={isLoadingIndexBloatResults} 
                            dataSource={queryResultsIndexBloat.map((result, index) => ({ ...result, key: `bloat-${index}` }))} 
                            columns={columnsIndexBloat} 
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => fetchQueryIndexBloat(nodeName, selectedDatabase)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                            )} 
                        />
                            </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    // Metrics verilerini otomatik olarak çekecek useEffect
    useEffect(() => {
        // Bu flag component unmount olduğunda API çağrısını önlemek için
        let isMounted = true;
        
        // Node değiştiğinde ve bir node seçili olduğunda ve 
        // system tab aktif olduğunda metrics verilerini çek
        if (nodeName && activeTab === '4') {
            console.log('METRICS: Tab or node changed, auto-fetching metrics data');
            
            // Loading state'i başlangıçta aktif et
            setIsLoadingMetrics(true);
            
            // Doğrudan setTimeout içinde çağıralım ki render cycle tamamlansın
            const delayedFetch = setTimeout(async () => {
                if (isMounted && activeTab === '4') {
                    console.log('METRICS: Executing delayed fetch');
                    
                    // API çağrısı başarısız olsa bile bileşen güncellenmeli ve hata durumu kontrol edilmeli
                    try {
                        await fetchSystemMetrics(nodeName);
                    } catch (error) {
                        console.error('METRICS: Error in useEffect fetch:', error);
                        // Loading state'i her durumda kapat
                        setIsLoadingMetrics(false);
                    }
                }
            }, 300);
            
            // Cleanup function - component unmount olduğunda veya dependencies değiştiğinde
            return () => {
                console.log('METRICS: Cleaning up useEffect');
                isMounted = false;
                clearTimeout(delayedFetch);
            };
        }
    }, [nodeName, activeTab]); // Sadece node veya tab değiştiğinde tetikle

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ marginRight: '8px' }}>Refresh Interval:</span>
                <div style={{ position: 'relative' }}>
                    <Select
                        value={refreshInterval}
                        onChange={setRefreshInterval}
                        style={{ width: 70 }}
                    >
                        <Option value={0}>Off</Option>
                        <Option value={10}>10s</Option>
                        <Option value={20}>20s</Option>
                        <Option value={30}>30s</Option>
                    </Select>
                    {refreshInterval > 0 && (
                        <Badge count={countdown} offset={[-5, -30]} />
                    )}
                </div>
            </div>
            <Card style={{ marginBottom: '20px' }}>
                <Steps current={currentStep}>
                    <Step title="Select Cluster" />
                    <Step title="Select Node" />
                    {activeTab === '3' && <Step title="Select Database" />}
                    {activeTab === '6' && <Step title="Select Database" />}
                    {activeTab === '5' && <Step title="Select Log File" />}
                </Steps>

                <Row justify="center" align="middle" style={{ marginTop: 20 }}>
                    <Col span={8} style={{ paddingRight: '10px' }}>
                        <Select
                            showSearch
                            value={clusterName}
                            onChange={setClusterName}
                            style={{ width: '100%' }}
                            filterOption={(input, option) =>
                                option?.children
                                    ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                    : false
                            }
                            loading={loadingClusterName}
                        >
                            {clusterNames.map((name, index) => (
                                <Option key={`cluster-${name}-${index}`} value={name}>
                                    {name}
                                </Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={8} style={{ paddingRight: '10px' }}>
                        <Select
                            value={nodeName}
                            onChange={handleNodeChange}
                            style={{ width: '100%' }}
                            loading={loading}
                            showSearch
                        >
                            {nodeInfo.map(node => (
                                <Option key={node.name} value={node.name}>{`${node.name} - ${node.status}`}</Option>
                            ))}
                        </Select>
                    </Col>
                    {activeTab === '3' && (
                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <Select
                                value={selectedDatabase}
                                onChange={handleDatabaseChange}
                                style={{ width: '100%' }}
                                loading={loading}
                                showSearch
                            >
                                {databaseNames.map((db, index) => (
                                    <Option key={`db-${db}-${index}`} value={db}>
                                        {db}
                                    </Option>
                                ))}
                            </Select>
                        </Col>
                    )}

                    {activeTab === '5' && (
                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <Select
                                showSearch
                                placeholder="Select a log file"
                                onChange={handleLogFileChange}
                                style={{ width: '100%' }}
                                filterOption={(input, option) =>
                                    option?.children
                                        ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                        : false
                                }
                                loading={loadingPgLogs}
                            >
                                {pgLogFiles.map((log, index) => (
                                    <Option key={`log-${log.name}-${index}`} value={log.name}>{log.name}</Option>
                                ))}
                            </Select>
                        </Col>
                    )}
                    {activeTab === '6' && (
                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <Select
                                value={selectedDatabase}
                                onChange={handleDatabaseChange}
                                style={{ width: '100%' }}
                                loading={loading}
                                showSearch
                            >
                                {databaseNames.map((db, index) => (
                                    <Option key={`db-${db}-${index}`} value={db}>
                                        {db}
                                    </Option>
                                ))}
                            </Select>
                        </Col>
                    )}

                </Row>
            </Card>

            <Layout style={{ background: '#fff', padding: '0', minHeight: '500px' }}>
                <Sider
                    width={250}
                    style={{
                        background: '#fff',
                        borderRight: '1px solid #f0f0f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}
                    collapsible
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                >
                    <Menu
                        mode="inline"
                        selectedKeys={[selectedSubMenu || (activeTab === '7' ? 'user-access-list' : activeTab === '6' ? 'db-stats' : activeTab === '5' ? 'logs' : activeTab === '4' ? 'system' : '')]}
                        style={{ height: '100%', borderRight: 0 }}
                    >
                        <Menu.SubMenu key="connections" icon={<TeamOutlined />} title="Connections">
                            <Menu.Item key="pgbouncer" onClick={() => handleSubMenuClick('pgbouncer')}>
                                PgBouncer Statistics
                            </Menu.Item>
                            <Menu.Item key="connections" onClick={() => handleSubMenuClick('connections')}>
                                Connections Summary
                            </Menu.Item>
                            <Menu.Item key="connections-by-app" onClick={() => handleSubMenuClick('connections-by-app')}>
                                Connections by Application
                            </Menu.Item>
                        </Menu.SubMenu>

                        <Menu.SubMenu key="queries" icon={<BarChartOutlined />} title="Queries">
                            <Menu.Item key="top-cpu" onClick={() => handleSubMenuClick('top-cpu')}>
                                Top 10 CPU Intensive Queries
                            </Menu.Item>
                            <Menu.Item key="blocking" onClick={() => handleSubMenuClick('blocking')}>
                                Blocking Queries
                            </Menu.Item>
                            <Menu.Item key="long-running" onClick={() => handleSubMenuClick('long-running')}>
                                Long Running Queries
                            </Menu.Item>
                            <Menu.Item key="cache-hit" onClick={() => handleSubMenuClick('cache-hit')}>
                                Cache Hit Ratio
                            </Menu.Item>
                        </Menu.SubMenu>

                        <Menu.SubMenu key="indexes" icon={<DatabaseOutlined />} title="Indexes">
                            <Menu.Item key="index-usage" onClick={() => handleSubMenuClick('index-usage')}>
                                Index Usage Statistics
                            </Menu.Item>
                            <Menu.Item key="index-bloat" onClick={() => handleSubMenuClick('index-bloat')}>
                                Index Bloat Ratio
                            </Menu.Item>
                        </Menu.SubMenu>
                        <Menu.Item key="system" icon={<SettingOutlined />} onClick={() => handleSubMenuClick('system')}>
                            System
                        </Menu.Item>
                        <Menu.Item key="logs" icon={<FileTextOutlined />} onClick={() => handleSubMenuClick('logs')}>
                            Logs
                        </Menu.Item>
                        <Menu.Item key="db-stats" icon={<DatabaseOutlined />} onClick={() => handleSubMenuClick('db-stats')}>
                            Database Stats
                        </Menu.Item>
                        <Menu.Item key="user-access-list" icon={<UserOutlined />} onClick={() => handleSubMenuClick('user-access-list')}>
                            User Access List
                        </Menu.Item>
                    </Menu>
                </Sider>
                <Content style={{ padding: '0 24px', minHeight: '500px' }}>
                    <Card style={{ marginTop: '16px' }}>
                        {activeTab === '1' && renderConnectionsContent()}
                        {activeTab === '2' && renderQueriesContent()}
                        {activeTab === '3' && renderIndexesContent()}
                        {activeTab === '4' && (
                            <div id="metrics-container" key={`metrics-${Date.now()}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h2 style={{ color: isLoadingMetrics ? '#1890ff' : 'inherit' }}>
                                        System Metrics {isLoadingMetrics ? '(Loading...)' : ''}
                                    </h2>
                                    <div>
                                        {isLoadingMetrics ? (
                                            <Spin style={{ marginRight: '10px' }} />
                                        ) : (
                                            <Tag color={systemMetrics ? 'success' : 'warning'} style={{ marginRight: '10px' }}>
                                                {systemMetrics ? 'Data Loaded' : 'No Data'}
                                            </Tag>
                                        )}
                                        <Button 
                                            type="primary"
                                            onClick={() => {
                                                console.log('METRICS: Manual refresh button clicked');
                                                // Reset state before fetching - ensures visual changes
                                                setSystemMetrics(null);
                                                if (nodeName) fetchSystemMetrics(nodeName);
                                            }} 
                                            icon={<ReloadOutlined />}
                                            loading={isLoadingMetrics}
                                            disabled={!nodeName || isLoadingMetrics}
                                        >
                                            Refresh Metrics
                                        </Button>
                                    </div>
                                </div>
                                
                                {!nodeName && (
                                    <Alert 
                                        message="Please select a node to view metrics" 
                                        type="info" 
                                        showIcon 
                                        style={{ marginBottom: '16px' }}
                                    />
                                )}
                                
                                {nodeName && isLoadingMetrics && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <Spin size="large" />
                                            <div style={{ marginTop: '15px', color: '#1890ff', fontWeight: 'bold' }}>
                                                Loading System Metrics...
                                            </div>
                                            <div style={{ maxWidth: '80%', margin: '10px auto', color: '#666' }}>
                                                This may take up to 60 seconds. If data doesn't appear, please use the refresh button.
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {nodeName && !isLoadingMetrics && !systemMetrics && (
                                    <Alert 
                                        message="No metrics data available" 
                                        description="The server didn't return any metrics data. Please try refreshing or check server logs."
                                        type="warning" 
                                        showIcon 
                                        style={{ marginBottom: '16px' }}
                                    />
                                )}
                                
                                {nodeName && !isLoadingMetrics && systemMetrics && (
                                    <Row gutter={16}>
                                        <Col span={8}>
                                            <Card title="CPU" hoverable>
                                                <Progress 
                                                    type="dashboard" 
                                                    percent={parseFloat((systemMetrics.cpu_usage || 0).toFixed(2))}
                                                    strokeColor={systemMetrics.cpu_usage > 70 ? '#ff4d4f' : '#52c41a'}
                                                />
                                                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                                    <p><strong>Cores:</strong> {systemMetrics.cpu_cores}</p>
                                                </div>
                                            </Card>
                                        </Col>
                                        <Col span={8}>
                                            <Card title="Memory" hoverable>
                                                <Progress 
                                                    type="dashboard" 
                                                    percent={parseFloat((systemMetrics.memory_usage || 0).toFixed(2))}
                                                    strokeColor={systemMetrics.memory_usage > 70 ? '#ff4d4f' : '#52c41a'}
                                                />
                                                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                                    <p><strong>Total:</strong> {formatBytes(systemMetrics.total_memory || 0)}</p>
                                                    <p><strong>Free:</strong> {formatBytes(systemMetrics.free_memory || 0)}</p>
                                                </div>
                                            </Card>
                                        </Col>
                                        <Col span={8}>
                                            <Card title="Load Average" hoverable>
                                                <ul style={{ listStyleType: 'none', padding: 0 }}>
                                                    <li style={{ margin: '10px 0', color: getColor(systemMetrics.load_average_1m || 0) }}>
                                                        <strong>1 min:</strong> {systemMetrics.load_average_1m || 0}
                                                    </li>
                                                    <li style={{ margin: '10px 0', color: getColor(systemMetrics.load_average_5m || 0) }}>
                                                        <strong>5 min:</strong> {systemMetrics.load_average_5m || 0}
                                                    </li>
                                                    <li style={{ margin: '10px 0', color: getColor(systemMetrics.load_average_15m || 0) }}>
                                                        <strong>15 min:</strong> {systemMetrics.load_average_15m || 0}
                                                    </li>
                                                </ul>
                                            </Card>
                                        </Col>
                                        <Col span={24} style={{ marginTop: '16px' }}>
                                            <Card title="System Information" hoverable>
                                                <Row gutter={16}>
                                                    <Col span={6}>
                                                        <p><strong>OS:</strong> {systemMetrics.os_version || 'Unknown'}</p>
                                                        <p><strong>Kernel:</strong> {systemMetrics.kernel_version || 'Unknown'}</p>
                                                    </Col>
                                                    <Col span={6}>
                                                        <p><strong>Disk Total:</strong> {formatBytes(systemMetrics.total_disk || 0)}</p>
                                                        <p><strong>Disk Free:</strong> {formatBytes(systemMetrics.free_disk || 0)}</p>
                                                    </Col>
                                                    <Col span={12}>
                                                        <p><strong>Uptime:</strong> {formatUptime(systemMetrics.uptime || 0)}</p>
                                                    </Col>
                                                </Row>
                                            </Card>
                                        </Col>
                                    </Row>
                                )}
                            </div>
                        )}
                {activeTab === '5' && (
                            <div>
                                <Spin spinning={loadingPgLogs}>
                            {pgLogFiles.map((log, index) => (
                                <Option key={`log-${log.name}-${index}`} value={log.name}>{log.name}</Option>
                                    ))}
                                </Spin>

                                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
                                    <Select defaultValue="ALL" style={{ width: 120 }} onChange={setFilter}>
                                        <Option value="ALL">All Lines</Option>
                                        <Option value="ERROR">Error</Option>
                                        <Option value="WARN">Warning</Option>
                                        <Option value="FATAL">Fatal</Option>
                                    </Select>

                                    <Search
                                        placeholder="Search in logs"
                                        onSearch={value => setSearchText(value)}
                                        style={{ flex: 1 }}
                                    />
                                    <Search
                                        placeholder="Minimum duration (ms)"
                                        onSearch={value => setMinDuration(value)}
                                        style={{ flex: 1 }}
                                        type="number"
                                    />
                                    <TimePicker
                                        format="HH:mm"
                                        onChange={(time) => setStartTime(time)}
                                        value={startTime}
                                        placeholder='Start Time'
                                    />
                                    <TimePicker
                                        format="HH:mm"
                                        onChange={(time) => setEndTime(time)}
                                        value={endTime}
                                        placeholder='End Time'
                                    />
                                    <Button onClick={() => {
                                        if (selectedFullPath && startTime && endTime) {
                                            handleFilterLogs(selectedFullPath, startTime, endTime);
                                        } else {
                                            message.info('Please select both start and end times');
                                        }
                                    }}>
                                        Filter Logs
                                    </Button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                                    <InfoCircleOutlined style={{ color: 'blue', marginRight: '8px' }} />
                                    <Text type="secondary" style={{ fontStyle: 'italic' }}>
                                        The displayed logs include the last 5 hours.
                                    </Text>
                                </div>

                                {loading ? (
                                    <Spin size="large" />
                                ) : (
                                    <>
                                        <div style={{ maxHeight: '50vh', overflowY: 'auto', marginBottom: '16px' }}>
                                            <Paragraph style={{ fontSize: '11px' }}>
                                                <pre dangerouslySetInnerHTML={createMarkup()} />
                                            </Paragraph>
                                        </div>

                                        <Pagination
                                            current={currentPage}
                                            onChange={page => setCurrentPage(page)}
                                            total={totalLines}
                                            pageSize={linesPerPage}
                                            showSizeChanger={false}
                                        />
                                    </>
                                )}
                            </div>
                )}
                {activeTab === '6' && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ marginTop: 20 }}>
                                    {queryResultsDbStats ? (
                                        queryResultsDbStats.length > 0 ? (
                                            queryResultsDbStats.map((stats, index) => (
                                                <div key={index}>
                                                    <Row gutter={16}>
                                                        {renderStatistics(stats)}
                                                    </Row>
                                                </div>
                                            ))
                                        ) : (
                                            <p>error: no data.</p>
                                        )
                                    ) : (
                                        <p>no user database selected.</p>
                                    )}
                                </div>
                            </div>
                )}
                {activeTab === '7' && (
                            <div style={{ marginTop: 10 }}>
                                <Table loading={isLoadingUserAccessListResults} dataSource={queryResultsUserAccessList} columns={UserAccessListColumns} scroll={{ x: 'max-content' }}
                                    footer={() => (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => exportToCsv("users.csv", queryResultsUserAccessList)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <DownloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                                <span style={{ marginLeft: '5px', color: 'black' }}>Export CSV</span>
                                            </button>
                                        </div>
                                    )}
                                    title={() => (
                                        <div style={{ display: 'flex', alignItems: 'left' }}>
                                        </div>
                                    )} />
                            </div>
                )}
                </Card>
        </Content>
            </Layout >
        </div >
    );
};

export default PostgrePA;


