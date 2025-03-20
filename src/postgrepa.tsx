import React, { useState, useEffect, useCallback } from 'react';
import { Select, Table, Badge, message, Modal, Tabs, Steps, Row, Col, Card, Progress, Spin, Input, Pagination, Typography, TimePicker, Button, Statistic, Tooltip, Tag } from 'antd';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { CopyOutlined, ReloadOutlined, InfoCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import CountUp from 'react-countup';
import MonacoEditor from './monacoeditor';


const { Option } = Select;
const { TabPane } = Tabs;
const { Step } = Steps;
const { Search } = Input;
const { Paragraph, Text } = Typography;

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

interface SystemInfo {
    cpu_cores: number;
    cpu_type: string;
    os_distribution: string;
    os_version: string;
    uptime: number;
    ram_total: number;
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
    duration: string;
    datName: string;
    pid: number;
    userName: string;
    applicationName: string;
    queryStart: string;
    waitEventType: string | null;
    waitEvent: string | null;
    state: string;
    query: string;
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
    total_connections: number;
    non_idle_connections: number;
    max_connections: number;
    connections_utilization_pctg: number;
}

interface CpuUsage {
    cpu_usage: number;
}

interface MemoryUsage {
    memory_usage: number;
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
        dataIndex: 'datname',
        key: 'datname',
    },
    {
        title: 'PID',
        dataIndex: 'pid',
        key: 'pid',
    },
    {
        title: 'User Name',
        dataIndex: 'usename',
        key: 'usename',
    },
    {
        title: 'Application Name',
        dataIndex: 'application_name',
        key: 'application_name',
    },
    {
        title: 'Query Start',
        dataIndex: 'query_start',
        key: 'query_start',
    },
    {
        title: 'Wait Event Type',
        dataIndex: 'wait_event_type',
        key: 'wait_event_type',
    },
    {
        title: 'Wait Event',
        dataIndex: 'wait_event',
        key: 'wait_event',
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
    const [queryResultsCpuUsage, setQueryResultsCpuUsage] = useState<CpuUsage>({ cpu_usage: 0 });
    const [queryResultsMemoryUsage, setQueryResultsMemoryUsage] = useState<MemoryUsage>({ memory_usage: 0 });
    const [loadAverage, setLoadAverage] = useState({ cpuCount: 0, load1: 0, load5: 0, load15: 0 });
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
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
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/run_pg_connstats_query`, {
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
            setQueryResults(data);
            setIsLoadingQueryResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchQueryNonIdleConnsResults = async (nodeName: string) => {
        try {
            setIsLoadingNonIdleQueryResults(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/run_pg_nonidleconns_query`, {
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
            setQueryResultsNonIdleConns(data);
            setIsLoadingNonIdleQueryResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchQueryCacheHitRatioResults = async (nodeName: string) => {
        try {
            setIsLoadingCacheHitQueryResults(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_pg_cachehitratio`, {
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
            setQueryResultsCacheHitRatio(data);
            setIsLoadingCacheHitQueryResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchQueryUserAccessList = async (nodeName: string) => {
        try {
            setIsLoadingUserAccessListResults(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_pg_users`, {
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
            setQueryResultsUserAccessList(data);
            setIsLoadingUserAccessListResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };


    const fetchQueryLongRunningResults = async (nodeName: string) => {
        try {
            setIsLoadingLongRunningQueryResults(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_pg_longrunning`, {
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
            setQueryResultsLongRunning(data);
            setIsLoadingLongRunningQueryResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingLongRunningQueryResults(false)
        }
    };

    const fetchQueryLocksResults = async (nodeName: string) => {
        try {
            setIsLoadingLocksResults(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_pg_locks`, {
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
            setQueryResultsLocks(data);
            setIsLoadingLocksResults(false)
        } catch (error) {
            setIsLoadingLocksResults(false)
            console.error('Error fetching data:', error);
        }

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
        try {
            setIsLoadingTopCpuQueryResults(true)
            const selectedNodeInfo = nodeInfo.find(node => node.name === nodeName);
            const PGVersion = selectedNodeInfo ? selectedNodeInfo.PGVersion : 'unknown';
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/run_pg_topcpu_query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName, PGVersion: PGVersion }),

            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json();
            setQueryResultsTopCpu(data);
            setIsLoadingTopCpuQueryResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }, [nodeInfo]);

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
            setIsLoadingUnusedIndexesResults(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/run_pg_unused_indexes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName, dbName: dbName }), // dbName parametresi eklendi
            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json();
            setQueryResultsUnusedIndexes(data);
            setIsLoadingUnusedIndexesResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchQueryIndexBloat = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingIndexBloatResults(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/run_pg_index_bloat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeName: nodeName, dbName: dbName }),
            });
            if (!response.ok) {
                throw new Error('API response not ok');
            }
            const data = await response.json();
            setQueryResultsIndexBloat(data);
            setIsLoadingIndexBloatResults(false)
        } catch (error) {
            console.error('Error fetching data:', error);
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

    const handleTabChange = (key: string) => {
        setActiveTab(key);
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
            fetchMemoryUsage(value);
            fetchCPUUsage(value);
            fetchLoadAverage(value);
            fetchSystemInfo(value);
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
            setLoading(true)
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/get_pg_databases`, {
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
            const dbNames = data.map((db: Database) => db.datname);
            setDatabaseNames(dbNames);
            setLoading(false)
        } catch (error) {
            console.error('Error fetching data:', error);
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
        let intervalId: number | null = null;

        // Geri sayımı her saniye azalt
        intervalId = window.setInterval(() => {
            setCountdown(prevCountdown => {
                // Geri sayım sıfıra ulaştığında verileri yenile
                if (prevCountdown === 1) {
                    switch (activeTab) {
                        case '1':
                            fetchPgBouncerStats(nodeName);
                            fetchQueryResults(nodeName);
                            break;
                        case '2':
                            fetchQueryTopCpuResults(nodeName);
                            fetchQueryCacheHitRatioResults(nodeName);
                            fetchQueryLongRunningResults(nodeName);
                            fetchQueryLocksResults(nodeName)
                            break;
                        case '3':
                            fetchQueryUnusedIndexes(nodeName, selectedDatabase);
                            fetchQueryIndexBloat(nodeName, selectedDatabase)
                            break;
                        case '4':
                            fetchCPUUsage(nodeName)
                            fetchMemoryUsage(nodeName)
                            fetchLoadAverage(nodeName)
                            fetchSystemInfo(nodeName);
                            break;
                        case '6':
                            fetchQueryDbStats(nodeName, selectedDatabase);
                            break;
                        case '7':
                            fetchQueryUserAccessList(nodeName);
                            break;
                        default:
                            // Varsayılan durumda herhangi bir işlem yapmayabilir
                            break;
                    }
                    return refreshInterval;
                } else {
                    return prevCountdown > 0 ? prevCountdown - 1 : 0;
                }
            });
        }, 1000);

        // refreshInterval veya nodeName değiştiğinde geri sayımı yeniden başlat
        setCountdown(refreshInterval);

        return () => {
            if (intervalId !== null) {
                clearInterval(intervalId);
            }
        };
    }, [refreshInterval, nodeName, activeTab, selectedDatabase, fetchQueryTopCpuResults]);

    useEffect(() => {
        if (nodeName) {
            setCurrentStep(activeTab === '3' ? 3 : 2);
            if (activeTab === '1') {
                fetchPgBouncerStats(nodeName);
                fetchQueryResults(nodeName);
                fetchQueryNonIdleConnsResults(nodeName);
            } else if (activeTab === '2') {
                fetchQueryTopCpuResults(nodeName);
                fetchQueryCacheHitRatioResults(nodeName)
                fetchQueryLongRunningResults(nodeName)
                fetchQueryLocksResults(nodeName)
            } else if (activeTab === '3') {
                fetchQueryUnusedIndexes(nodeName, selectedDatabase);
                fetchQueryIndexBloat(nodeName, selectedDatabase)
                fetchDatabases(nodeName);
            } else if (activeTab === '4') {
                fetchCPUUsage(nodeName)
                fetchMemoryUsage(nodeName)
                fetchLoadAverage(nodeName)
                fetchSystemInfo(nodeName);
            } else if (activeTab === '5') {
                fetchPostgresLogs(nodeName)
            } else if (activeTab === '6') {
                fetchQueryDbStats(nodeName, selectedDatabase);
                fetchDatabases(nodeName);
                setCurrentStep(3);
            } else if (activeTab === '7') {
                fetchQueryUserAccessList(nodeName);

            }

        }
    }, [nodeName, activeTab, selectedDatabase, fetchQueryTopCpuResults]);

    // API'den veri çekme ve cluster isimlerini ayarlama.
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingClusterName(true)
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/statuspostgres`);
                const clusterData: ClusterData[] = response.data; // API'den gelen veri

                // Cluster isimlerini çıkarmak için döngü
                const clusterNames = clusterData.map(obj => Object.keys(obj)[0]);
                const data = clusterData.reduce<Record<string, Node[]>>((acc, curr) => {
                    const key = Object.keys(curr)[0];
                    return { ...acc, [key]: curr[key] };
                }, {});

                setData(data);
                setClusterNames(clusterNames);
                setLoadingClusterName(false)
            } catch (error) {
                console.error('Error fetching data:', error);
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
                            value={clusterName}
                            onChange={setClusterName}
                            style={{ width: '100%' }}
                            loading={loadingClusterName}
                            showSearch
                        >
                            {clusterNames.map(name => (
                                <Option key={name} value={name}>{name}</Option>
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
                                {databaseNames.map(dbName => (
                                    <Option key={dbName} value={dbName}>{dbName}</Option>
                                ))}
                            </Select>
                        </Col>
                    )}

                    {activeTab === '5' && (
                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <Select
                                showSearch
                                onChange={handleLogFileChange}
                                placeholder="Select a log file"
                                style={{ width: '100%' }}
                                filterOption={(input, option) =>
                                    option?.children
                                        ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                        : false
                                }
                                loading={loadingPgLogs}
                            >
                                {pgLogFiles.map((logFile, index) => {
                                    const displayText = logFile.timeRange ? `${logFile.name} - ${logFile.timeRange}` : logFile.name;
                                    return (
                                        <Option key={index} value={logFile.name}>
                                            {displayText}
                                        </Option>
                                    );
                                })}
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
                                {databaseNames.map(dbName => (
                                    <Option key={dbName} value={dbName}>{dbName}</Option>
                                ))}
                            </Select>
                        </Col>
                    )}

                </Row>
            </Card>

            <div>
                <Card>
                    <Tabs defaultActiveKey="1" onChange={handleTabChange}>
                        <TabPane tab="Connections" key="1">
                            {/* İlk Tablo - PgBouncer İstatistikleri */}
                            <div style={{ marginTop: 10 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>PGBouncer Statistics
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
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

                            {/* İkinci Tablo - Bağlantı Özeti */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                                <div style={{ flex: 1, marginRight: '10px' }}> {/* Sağdaki boşluk için marginRight */}
                                    <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Connections Summary
                                    </span>} placement="end" style={{ zIndex: 1000 }}>
                                    </Badge.Ribbon>
                                    <Table loading={isLoadingQueryResults} pagination={false} dataSource={queryResults} columns={columns} rowKey={record => record.non_idle_connections}
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
                                {/* Üçüncü Tablo */}
                                <div style={{ flex: 1 }}> {/* Üçüncü tablo için konteyner.. */}
                                    <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Connections by Application Name
                                    </span>} placement="end" style={{ zIndex: 1000 }}>
                                    </Badge.Ribbon>
                                    <Table loading={isLoadingNonIdleQueryResults} pagination={false} dataSource={queryResultsNonIdleConns} columns={columnsNonIdleConns} rowKey={record => record.non_idle_connections}
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
                                        )} /> </div>

                            </div>
                        </TabPane>

                        <TabPane tab="Queries" key="2">
                            <div style={{ marginTop: 10 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Top 10 CPU Intensive Queries
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
                                <Table pagination={false} loading={isLoadingTopCpuQueryResults} dataSource={queryResultsTopCpu} columns={columnsTopCpu} scroll={{ x: 'max-content' }}
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
                                    )} />
                            </div>
                            <div style={{ marginTop: 10 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Blocking Queries
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
                                <Table pagination={false} loading={isLoadingLocsResults} dataSource={queryResultsLocks} columns={columnsLocks} scroll={{ x: 'max-content' }}
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
                                    )} />

                            </div>
                            <div style={{ marginTop: 10 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Long Running Queries
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
                                <Table pagination={false} loading={isLoadingLongRunningQueryResults} dataSource={queryResultsLongRunning} columns={columnsLongRunning} scroll={{ x: 'max-content' }}
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
                                    )} />

                            </div>
                            <div style={{ marginTop: 20 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Cache Hit Ratio
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
                                <Table pagination={false} loading={isLoadingCacheHitQueryResults} dataSource={queryResultsCacheHitRatio} columns={columnsCacheHitRatio} scroll={{ x: 'max-content' }} rowClassName={(record) => {
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
                                    )} />
                            </div>
                        </TabPane>
                        <TabPane tab="Indexes" key="3">
                            <div style={{ marginTop: 10 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Index Usage Statistics
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
                                <Table loading={isLoadingUnusedIndexesResults} dataSource={queryResultsUnusedIndexes} columns={columnsUnusedIndexes} scroll={{ x: 'max-content' }}
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
                                    )} />
                            </div>

                            <div style={{ marginTop: 10 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>Index Bloat Ratio
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
                                <Table loading={isLoadingIndexBloatResults} dataSource={queryResultsIndexBloat} columns={columnsIndexBloat} scroll={{ x: 'max-content' }}
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
                                    )} />
                            </div>
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
                        <TabPane tab="Logs" key="5">
                            <div>
                                <Spin spinning={loadingPgLogs}>

                                    {pgLogFiles.map(log => (
                                        <Option key={log.name} value={log.name}>{log.name}</Option>
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
                        </TabPane>
                        <TabPane tab="Database Statistics" key="6">
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
                        </TabPane>
                        <TabPane tab="User Access List" key="7">
                            <div style={{ marginTop: 10 }}>
                                <Badge.Ribbon color='#336790ff' text={<span style={{ fontWeight: 'bold' }}>User Access List
                                </span>} placement="end" style={{ zIndex: 1000 }}>
                                </Badge.Ribbon>
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
                        </TabPane>

                    </Tabs>
                </Card>
            </div>

        </div >

    );
};

export default PostgrePA;
