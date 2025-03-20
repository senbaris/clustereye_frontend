import React, { useState, useEffect } from 'react';
import { Select, message, Steps, DatePicker, Button, Table, Checkbox,Modal, List } from 'antd';
import axios from 'axios';
import { SortOrder } from 'antd/es/table/interface';

const { Option } = Select;
const { Step } = Steps;

interface DCInfo {
    id: number;
    replicaset: string;
    datacenter: string;
    date: string;
    status: string;
    created_at: string;
}

interface NodeInfo {
    nodename: string;
    dbAgentStatus: string;
    dc: string;
    isPrimary: boolean;
    status: string;
    replsetname: string;
}

interface LogEntry {
    message: string;
    created_at: string;
}

const statusOrder: { [key: string]: number } = {
    pending: 1,
    completed: 2,
};

const ChangeDataCenter: React.FC = () => {
    const [dataCenters] = useState(['Esenyurt', 'Gebze']);
    const [selectedDataCenter, setSelectedDataCenter] = useState<string | null>(null);
    const [replSets, setReplSets] = useState<string[]>([]);
    const [selectedReplicaSets, setSelectedReplicaSets] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [dcInfoData, setDcInfoData] = useState<DCInfo[]>([]);
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLogModalVisible, setLogModalVisible] = useState<boolean>(false);



    const fetchDCInfo = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/get_changedc_schedules`);
            
            // Veri kontrolü
            const dcData = response.data;
            if (Array.isArray(dcData)) {
                setDcInfoData(dcData);
            } else {
                console.warn('DC info data is not an array:', dcData);
                setDcInfoData([]);
            }
        } catch (error) {
            console.error('Error fetching dc info data:', error);
            setDcInfoData([]);
        }
    };

    useEffect(() => {
        fetchDCInfo();
        const interval = setInterval(() => {
            fetchDCInfo();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const fetchReplicaSets = async (dataCenter: string) => {
        setLoading(true);
        setReplSets([]);  // Listeyi sıfırla
        setNodes([]);  // Node listesini de sıfırla

        try {
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/status`);
            const data = response.data;

            // Veri kontrolü ekleyelim
            if (!Array.isArray(data)) {
                console.warn('API response is not an array:', data);
                setLoading(false);
                return;
            }

            const filteredReplicaSets: string[] = [];
            const relevantNodes: NodeInfo[] = [];

            data.forEach((replicaSetObject: { [key: string]: NodeInfo[] }) => {
                if (!replicaSetObject) return; // Null kontrolü
                
                const replicaSetName = Object.keys(replicaSetObject)[0];
                if (!replicaSetName) return; // Boş key kontrolü
                
                const nodes = replicaSetObject[replicaSetName];
                if (!Array.isArray(nodes)) return; // Nodes array kontrolü
                
                const primaryNode = nodes.find(node => node.status === 'PRIMARY');

                if (primaryNode && primaryNode.dc !== dataCenter) {
                    // Sadece benzersiz replica set'leri ekliyoruz
                    if (!filteredReplicaSets.includes(replicaSetName)) {
                        filteredReplicaSets.push(replicaSetName);

                        // Node'ları isPrimary değeri ile birlikte ekliyoruz
                        nodes.forEach((node) => {
                            relevantNodes.push({
                                ...node,
                                isPrimary: node.status === 'PRIMARY',  // Primary node'u işaretliyoruz
                            });
                        });
                    }
                }
            });

            filteredReplicaSets.sort(); // Alfabetik sıraya göre sıralama

            setReplSets(filteredReplicaSets);
            setNodes(relevantNodes);

        } catch (error) {
            console.error('Error fetching Replica Sets:', error);
        } finally {
            setLoading(false);
        }
    };



    const handleDataCenterChange = (dc: string) => {
        setSelectedDataCenter(dc);
        setCurrentStep(1);
        fetchReplicaSets(dc);
    };

    const handleReplicaSetChange = (checkedValues: string[]) => {
        setSelectedReplicaSets(checkedValues);
    };

    const handleSelectAll = () => {
        if (selectedReplicaSets.length === replSets.length) {
            setSelectedReplicaSets([]);
        } else {
            setSelectedReplicaSets(replSets);
        }
    };

    const handleDateChange = (_: any, dateString: string | string[]) => {
        if (typeof dateString === "string") {
            setSelectedDate(dateString);
            setCurrentStep(2);
        } else {
            message.error("Invalid date selection.");
        }
    };
    

    const handleNextStep = () => {
        if (selectedReplicaSets.length > 0) {
            setCurrentStep(2);
        } else {
            message.warning('Please select at least one replica set.');
        }
    };

    const handleSubmit = async () => {
        if (loading) return; // Eğer işlem devam ediyorsa başka bir istek göndermeyi önler

        setLoading(true); // İstek başlamadan önce loading'i true yapıyoruz

        if (selectedReplicaSets.length > 0 && selectedDataCenter && selectedDate && nodes.length > 0) {
            try {
                // Seçilen replica setler için ilgili node'ları filtreliyoruz
                const selectedNodes = nodes
                    .filter(node => selectedReplicaSets.includes(node.replsetname))
                    .map(node => ({
                        ...node,
                        isPrimary: node.status === 'PRIMARY'
                    }));

                console.log('Selected Nodes with isPrimary:', selectedNodes);

                const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/changedc_setschedule`, {
                    replicaSet: selectedReplicaSets,
                    dataCenter: selectedDataCenter,
                    date: selectedDate,
                    status: "pending",
                    nodes: selectedNodes // Filtrelenmiş node'ları gönderiyoruz
                });
                message.success('Schedule for DC change successfully set up!');
                console.log('API Response:', response.data);
            } catch (error) {
                message.error('Failed to set schedule for DC change.');
                console.error('API Error:', error);
            } finally {
                setLoading(false); // İstek tamamlandıktan sonra loading state'ini false yapıyoruz
            }
        } else {
            message.warning('Please complete all steps before submitting.');
            setLoading(false);
        }
    };

    const showLogs = async (changedcID: number) => {
        setLoading(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/get_logs`, {
                params: { changedc_id: changedcID }
            });
            
            // Veri kontrolü
            const logData = response.data;
            if (Array.isArray(logData)) {
                setLogs(logData);
            } else {
                console.warn('Log data is not an array:', logData);
                setLogs([]);
            }
            
            setLogModalVisible(true);
        } catch (error) {
            message.error('Failed to fetch logs.');
            console.error('API Error:', error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Replica Set',
            dataIndex: 'replicaset',
            key: 'replicaset',
            filters: Array.from(new Set(dcInfoData.map((item) => item.replicaset)))
                .map((replicaSet) => ({ text: replicaSet, value: replicaSet })),
            onFilter: (value: string | number | boolean | React.Key, record: DCInfo) => {
                if (typeof value === "string" || typeof value === "number") {
                    return record.replicaset.includes(value.toString());
                }
                return false;
            },
            filterSearch: true,
        },
        {
            title: 'Data Center',
            dataIndex: 'datacenter',
            key: 'datacenter',
        },
        {
            title: 'Schedule Date',
            dataIndex: 'date',
            key: 'date',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            sorter: (a: DCInfo, b: DCInfo) => statusOrder[a.status] - statusOrder[b.status],
            sortDirections: ['ascend', 'descend'] as SortOrder[],
            defaultSortOrder: 'ascend' as SortOrder,
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: DCInfo) => (
                <Button type="primary" onClick={() => showLogs(record.id)}>
                    View Logs
                </Button>
            ),
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Steps current={currentStep}>
                <Step title="Select Data Center" description={selectedDataCenter ? `${selectedDataCenter}` : ''} />
                <Step title="Select Replica Set" description={selectedReplicaSets.length > 0 ? `${selectedReplicaSets.length} selected` : ''} />
                <Step title="Select Date/Time" description={selectedDate ? `${selectedDate}` : ''} />
            </Steps>

            {currentStep === 0 && (
                <Select
                    style={{ width: '25%', marginTop: 20 }}
                    showSearch
                    placeholder="Select a data center"
                    onChange={handleDataCenterChange}
                    value={selectedDataCenter}
                    loading={loading}
                >
                    {dataCenters.map(dc => (
                        <Option key={dc} value={dc}>{dc}</Option>
                    ))}
                </Select>
            )}

            {currentStep === 1 && (
                <div style={{ width: '25%', marginTop: 20 }}>
                    <Select
                        mode="multiple"
                        placeholder="Select Replica Sets"
                        value={selectedReplicaSets}
                        onChange={handleReplicaSetChange}
                        loading={loading}
                        maxTagCount={5}
                        style={{ width: '100%' }}
                    >
                        <Option key="selectAll">
                            <Checkbox
                                indeterminate={selectedReplicaSets.length > 0 && selectedReplicaSets.length < replSets.length}
                                checked={selectedReplicaSets.length === replSets.length}
                                onChange={handleSelectAll}
                            >
                                Select All
                            </Checkbox>
                        </Option>
                        {replSets.map(replSet => (
                            <Option key={replSet} value={replSet}>
                                {replSet}
                            </Option>
                        ))}
                    </Select>
                    <Button type="primary" onClick={handleNextStep} style={{ marginTop: 20 }}>
                        Next: Select Date/Time
                    </Button>
                </div>
            )}

            {currentStep === 2 && (
                <>
                    <DatePicker
                        showTime
                        style={{ marginTop: 20 }}
                        onChange={handleDateChange}
                    />
                    <Button type="primary" style={{ marginTop: 20 }} onClick={handleSubmit}>
                        Set Schedule For DC Change
                    </Button>
                </>
            )}

            <div style={{ width: '80%', marginTop: 50 }}>
                <Table
                    columns={columns}
                    dataSource={dcInfoData}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    loading={loading}
                />
            </div>
            <Modal
                title="Operation Logs"
                visible={isLogModalVisible}
                onCancel={() => setLogModalVisible(false)}
                footer={null}
            >
                <List
                    dataSource={logs}
                    renderItem={(log) => (
                        <List.Item>
                            <div>{log.created_at}: {log.message}</div>
                        </List.Item>
                    )}
                />
            </Modal>
        </div>
    );
};

export default ChangeDataCenter;
