import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Col, Row, Input, Checkbox, Tag, Select, Collapse, Tooltip, Spin } from 'antd';
import { SiMongodb, SiPostgresql, SiApachecassandra } from 'react-icons/si';
import { MdOutlineTableChart, MdOutlineInventory } from 'react-icons/md';
import { getRequestOptions } from './api';
import { GeneralProps } from './App';

const { Search } = Input;
const { Option } = Select;
const { Panel } = Collapse;

interface InventoryItem {
    id: number;
    nodename: string;
    ip: string;
    owner: string;
    clustername: string;
    type: string;
    sox: 'yes' | 'no';
}

const InventoryTable: React.FC<GeneralProps> = ({ keycloak }) => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [groupedInventory, setGroupedInventory] = useState<Record<string, InventoryItem[]>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [showSoxOnly, setShowSoxOnly] = useState(false);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/get_inventory`,
                    getRequestOptions(keycloak?.token)
                );
                
                // Yanıtın bir dizi olup olmadığını kontrol et
                if (Array.isArray(response.data)) {
                    setInventory(response.data);
                } else {
                    console.warn('API response is not an array:', response.data);
                    setInventory([]); // Boş dizi ayarla
                }
                
                setLoading(false);
            } catch (error) {
                console.error('Error fetching inventory data:', error);
                setInventory([]); // Hata durumunda boş dizi
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter and group data
    useEffect(() => {
        const filteredInventory = Array.isArray(inventory) 
            ? inventory.filter((item) => {
                const matchesSearchTerm = Object.values(item).some((value) =>
                    typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
                );
                const matchesSoxFilter = !showSoxOnly || item.sox === 'yes';
                const matchesTypeFilter = !selectedType || item.type.toLowerCase() === selectedType.toLowerCase();

                return matchesSearchTerm && matchesSoxFilter && matchesTypeFilter;
            })
            : [];

        // Group by clustername
        const grouped = filteredInventory.reduce((acc, item) => {
            if (!acc[item.clustername]) acc[item.clustername] = [];
            acc[item.clustername].push(item);
            return acc;
        }, {} as Record<string, InventoryItem[]>);

        setGroupedInventory(grouped);
    }, [inventory, searchTerm, showSoxOnly, selectedType]);

    // Icon Mapping
    const renderDatabaseIcon = (type: string) => {
        switch (type.trim().toLowerCase()) {
            case 'mongodb':
                return <SiMongodb style={{ color: '#47A248', fontSize: '1.5rem' }} />;
            case 'postgresql':
                return <SiPostgresql style={{ color: '#336791', fontSize: '1.5rem' }} />;
            case 'mssql':
                return <MdOutlineTableChart style={{ color: '#CC2927', fontSize: '1.5rem' }} />;
            case 'cassandra':
                return <SiApachecassandra style={{ color: '#1287B1', fontSize: '1.5rem' }} />;
            default:
                return <MdOutlineTableChart style={{ color: 'gray', fontSize: '1.5rem' }} />;
        }
    };

    // Check if a cluster has any SOX=yes nodes
    const clusterHasSox = (nodes: InventoryItem[]) => {
        return nodes.some((item) => item.sox === 'yes');
    };

    return (
        <div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                    <Spin size="large" />
                </div>
            ) : (
                <>
                    {/* Search and Filter Section */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                        <Search
                            placeholder="Search inventory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '300px', marginRight: '10px' }}
                            allowClear
                        />
                        <Select
                            placeholder="Filter by DB type"
                            allowClear
                            style={{ width: '200px', marginRight: '10px' }}
                            onChange={(value) => setSelectedType(value)}
                        >
                            <Option value="mongodb">MongoDB</Option>
                            <Option value="postgresql">PostgreSQL</Option>
                            <Option value="mssql">MSSQL</Option>
                            <Option value="cassandra">Cassandra</Option>
                        </Select>
                        <Checkbox checked={showSoxOnly} onChange={(e) => setShowSoxOnly(e.target.checked)}>
                            Show only SOX DBs
                        </Checkbox>
                    </div>

                    {/* Grouped Inventory */}
                    <Row gutter={[16, 16]}>
                        {Object.keys(groupedInventory).length === 0 ? (
                            <Col span={24}>
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    justifyContent: 'center', 
                                    alignItems: 'center', 
                                    height: '300px',
                                    background: '#f0f2f5',
                                    borderRadius: '8px',
                                    padding: '20px',
                                    textAlign: 'center'
                                }}>
                                    <MdOutlineInventory style={{ fontSize: '60px', color: '#FF5733' }} />
                                    <h2 style={{ marginTop: '20px' }}>No Inventory Items Found</h2>
                                    <p>Try adjusting your search or filter criteria.</p>
                                </div>
                            </Col>
                        ) : (
                            Object.keys(groupedInventory).map((clustername) => {
                                const nodes = groupedInventory[clustername];
                                const hasSox = clusterHasSox(nodes);

                                return (
                                    <Col key={clustername} xs={24} sm={12} md={8} lg={8}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {hasSox && (
                                                        <Tooltip title="SOX">
                                                        <Tag color="green" style={{ fontWeight: 'bold', cursor: 'pointer' }}>
                                                            S
                                                        </Tag>
                                                    </Tooltip>
                                                    )}
                                                    <strong>{clustername}</strong>
                                                </div>
                                            }
                                            bordered
                                            hoverable
                                        >
                                            <Collapse>
                                                <Panel header={`Nodes in ${clustername}`} key={clustername}>
                                                    {nodes.map((item) => (
                                                        <div key={item.id} style={{ marginBottom: '10px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                {renderDatabaseIcon(item.type)}
                                                                <div>
                                                                    <p>
                                                                        <strong>Node:</strong> {item.nodename}
                                                                    </p>
                                                                    <p>
                                                                        <strong>IP:</strong> {item.ip}
                                                                    </p>
                                                                    <p>
                                                                        <strong>Owner:</strong> {item.owner}
                                                                    </p>
                                                                    <p>
                                                                        <strong>SOX:</strong>{' '}
                                                                        <Tag color={item.sox === 'yes' ? 'green' : 'red'}>
                                                                            {item.sox.toUpperCase()}
                                                                        </Tag>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </Panel>
                                            </Collapse>
                                        </Card>
                                    </Col>
                                );
                            })
                        )}
                    </Row>
                </>
            )}
        </div>
    );
};

export default InventoryTable;
