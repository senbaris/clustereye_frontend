import React, { useState, ReactNode } from 'react';
import { Card, Tooltip, Modal, Input, Checkbox, List, Button, message, Spin, Radio } from 'antd';
import { DeleteOutlined, BarChartOutlined, PlusOutlined, CrownOutlined } from '@ant-design/icons';
import IconMongo from './icons/mongo';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from './store';

type CustomCardProps = {
    clusterName: string;
    iconColor?: string; // panelColorClass.iconColor direkt olarak geçirilebilir
    onClick: () => void;
    children?: ReactNode;
    nodes: Array<{ nodename: string, status: string }>;
};

const CustomCard: React.FC<CustomCardProps> = ({ clusterName, iconColor, nodes, onClick}) => {
    const [showActions, setShowActions] = useState(false);
    const [newNodeName, setNewNodeName] = useState('');
    const [newNodePort, setNewNodePort] = useState('27127');
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedSecondaryNode, setSelectedSecondaryNode] = useState<string | null>(null);
    const [isSetPrimaryModalVisible, setIsSetPrimaryModalVisible] = useState(false);
	const { isLoggedIn } = useSelector((state: RootState) => state.auth);

    const handleDeleteClick = async () => {
        try {
            const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/delete_mongodb_replset`, {
                clusterName: clusterName,
            });
            console.log('API Response:', response.data);
        } catch (error) {
            console.error('API Error:', error);
        }
    };

    const showDeleteConfirm = () => {
        Modal.confirm({
            title: (
                <span>
                    Are you sure you want to delete <span style={{ color: 'red', fontWeight: 'bold' }}>{clusterName}</span>?
                </span>
            ), content: 'If Dbstatus agents are still running, this cluster will be added to this dashboard again.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk() {
                handleDeleteClick();
            },
            onCancel() {
                console.log('Delete cancelled');
            },
        });
    };


    const handleAddNode = async (): Promise<void> => {
        const primaryNode = nodes.find(node => node.status === 'PRIMARY');
        if (!primaryNode) {
            alert('No primary node found.');
            return;
        }

        let fullPrimaryNodeName: string;
        if (primaryNode.nodename.includes("osp-r1-st") || primaryNode.nodename.includes("osp-r2-st")) {
            fullPrimaryNodeName = `${primaryNode.nodename}.hepsi.io`;
        } else {
            fullPrimaryNodeName = `${primaryNode.nodename}.hepsiburada.dmz`;
        }

        const dbstatusAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/addnode`;
        setLoading(true);

        try {
            const response = await fetch(dbstatusAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hostname: fullPrimaryNodeName,
                    newNode: `${newNodeName}:${newNodePort}`
                })
            });

            if (response.ok) {
                const data = await response.json();
                message.success(data.message || 'Node added successfully!');
            } else {
                console.error("Hata:", response.statusText);
            }
        } catch (error) {
            console.error("Bir hata oluştu:", error);
        } finally {
            setLoading(false);
            setIsModalVisible(false);
            handleDeleteClick();
        }
    };

    const handleRemoveNodes = async () => {
        const primaryNode = nodes.find(node => node.status === 'PRIMARY');
        if (!primaryNode) {
            alert('No primary node found.');
            return;
        }

        let fullPrimaryNodeName: string;
        if (primaryNode.nodename.includes("osp-r1-st") || primaryNode.nodename.includes("osp-r2-st")) {
            fullPrimaryNodeName = `${primaryNode.nodename}.hepsi.io`;
        } else {
            fullPrimaryNodeName = `${primaryNode.nodename}.hepsiburada.dmz`;
        }

        console.log("Selected Nodes:", selectedNodes);  // Debug log

        const dbstatusAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/removenodes`;

        setLoading(true);
        try {
            const cleanedNodes = selectedNodes.map(node => {
                const cleanedNode = node.split(' ')[0]; // Remove (SECONDARY) or (PRIMARY) parts
                let fullNodeName: string;
                if (cleanedNode.includes("osp-r1-st") || cleanedNode.includes("osp-r2-st")) {
                    fullNodeName = `${cleanedNode}.hepsi.io:27127`;
                } else {
                    fullNodeName = `${cleanedNode}.hepsiburada.dmz:27127`;
                }
                console.log("Cleaned Node:", fullNodeName);  // Debug log
                return fullNodeName;
            });

            console.log("Cleaned Nodes Array:", cleanedNodes);  // Debug log

            const response = await fetch(dbstatusAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hostname: fullPrimaryNodeName,
                    removeNodes: cleanedNodes
                })
            });

            if (response.ok) {
                const data = await response.json();
                message.success(data.message || 'Nodes removed successfully!');
                setIsModalVisible(false);
                handleDeleteClick()
            } else {
                const errorData = await response.json();
                message.error(errorData.error || 'Failed to remove nodes!');
            }
        } catch (error) {
            console.error("Bir hata oluştu:", error);
            message.error('An error occurred!');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPrimary = async () => {
        const primaryNode = nodes.find(node => node.status === 'PRIMARY');
        if (!primaryNode) {
            alert('No primary node found.');
            return;
        }

        let fullPrimaryNodeName: string;
        if (primaryNode.nodename.includes("osp-r1-st") || primaryNode.nodename.includes("osp-r2-st")) {
            fullPrimaryNodeName = `${primaryNode.nodename}.hepsi.io`;
        } else {
            fullPrimaryNodeName = `${primaryNode.nodename}.hepsiburada.dmz`;
        }

        const secondaryNodes = nodes
            .filter(node => node.status === 'SECONDARY' && node.nodename !== selectedSecondaryNode)
            .map(node => {
                let fullNodeName: string;
                if (node.nodename.includes("osp-r1-st") || node.nodename.includes("osp-r2-st")) {
                    fullNodeName = `${node.nodename}.hepsi.io`;
                } else {
                    fullNodeName = `${node.nodename}.hepsiburada.dmz`;
                }
                return fullNodeName;
            });

        const dbstatusAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/setprimary`;

        setLoading(true);
        try {
            const response = await fetch(dbstatusAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hostname: fullPrimaryNodeName,
                    newPrimaryNode: selectedSecondaryNode,
                    freezeNodes: secondaryNodes
                })
            });

            if (response.ok) {
                const data = await response.json();
                message.success(data.message || 'Primary node set successfully!');
                setIsSetPrimaryModalVisible(false);
                handleDeleteClick();
            } else {
                const errorData = await response.json();
                message.error(errorData.error || 'Failed to set primary node!');
            }
        } catch (error) {
            console.error("Bir hata oluştu:", error);
            message.error('An error occurred!');
        } finally {
            setLoading(false);
        }
    };

    const showSetPrimaryModal = () => {
        setIsSetPrimaryModalVisible(true);
    };

    const showAddRemoveNodeModal = () => {
        setIsModalVisible(true);
    };

    const handleModalCancel = () => {
        setIsModalVisible(false);
        setIsSetPrimaryModalVisible(false);
    };

    const handleCheckboxChange = (node: string, checked: boolean) => {
        setSelectedNodes(prev => checked ? [...prev, node] : prev.filter(n => n !== node));
    };

    const handleRadioChange = (e: any) => {
        setSelectedSecondaryNode(e.target.value);
    };


    return (
        <div>
            <Card
                bodyStyle={{ padding: 5, width: 195 }}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
                onClick={onClick}
                actions={showActions ? [
                    isLoggedIn && (
                        <Tooltip title="Remove replset from dbstatus">
                            <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); showDeleteConfirm(); }} />
                        </Tooltip>
                    ),
                    <Tooltip title="Performance Analyze">
                        <Link to={`/mongopa?clusterName=${clusterName}`}>
                            <BarChartOutlined key="edit" />
                        </Link>
                    </Tooltip>,
                    isLoggedIn && (
                        <Tooltip title="Add or Remove Node">
                            <PlusOutlined key="add-remove" onClick={(e) => { e.stopPropagation(); showAddRemoveNodeModal(); }} />
                        </Tooltip>
                    ),
                    isLoggedIn && (
                        <Tooltip title="Set Primary Node">
                            <CrownOutlined key="set-primary" onClick={(e) => { e.stopPropagation(); showSetPrimaryModal(); }} />
                        </Tooltip>
                    ),
                ] : []}
            >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <IconMongo size="20" color={iconColor} />
                    <span
                        style={{
                            marginLeft: 8,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            fontSize: '12px',
                            textOverflow: 'ellipsis',
                            maxWidth: 'calc(100% - 25px - 8px)'
                        }}
                    >
                        {clusterName}
                    </span>
                </div>
            </Card>
            <Modal
                title="Add or Remove Node"
                visible={isModalVisible}
                onCancel={handleModalCancel}
                maskClosable={false}
                zIndex={1000}
                style={{ zIndex: 1001 }}
                maskStyle={{ zIndex: 1000 }}
                footer={[
                    <Button key="cancel" onClick={handleModalCancel}>
                        Cancel
                    </Button>,
                    <Button key="add" type="primary" onClick={() => handleAddNode()}>
                        Add Node
                    </Button>,
                    <Button key="remove" danger onClick={handleRemoveNodes}>
                        Remove Node(s)
                    </Button>
                ]}
            >
                <Spin spinning={loading}>
                    <div style={{ marginBottom: 16 }}>
                        <h3>Add Node</h3>
                        <Input
                            placeholder="Node Name"
                            value={newNodeName}
                            onChange={(e) => setNewNodeName(e.target.value)}
                            style={{ marginBottom: 8 }}
                        />
                        <Input
                            placeholder="Port"
                            value={newNodePort}
                            onChange={(e) => setNewNodePort(e.target.value)}
                        />
                    </div>
                    <div>
                        <h3>Remove Node(s)</h3>
                        <List
                            dataSource={nodes.map(node => `${node.nodename} (${node.status})`)}
                            renderItem={(node: string) => (
                                <List.Item>
                                    <Checkbox onChange={(e) => handleCheckboxChange(node, e.target.checked)}>
                                        {node}
                                    </Checkbox>
                                </List.Item>
                            )}
                        />
                    </div>
                </Spin>
            </Modal>
            <Modal
                title="Set Primary Node"
                visible={isSetPrimaryModalVisible}
                onCancel={handleModalCancel}
                maskClosable={false}
                zIndex={1000}
                style={{ zIndex: 1001 }}
                maskStyle={{ zIndex: 1000 }}
                footer={[
                    <Button key="cancel" onClick={handleModalCancel}>
                        Cancel
                    </Button>,
                    <Button key="set-primary" type="primary" onClick={handleSetPrimary}>
                        Set Primary
                    </Button>
                ]}
            >
                <Spin spinning={loading}>
                    <h3>Select a Secondary Node to Set as Primary</h3>
                    <Radio.Group onChange={handleRadioChange} value={selectedSecondaryNode}>
                        {nodes.filter(node => node.status === 'SECONDARY').map(node => (
                            <Radio key={node.nodename} value={node.nodename}>
                                {node.nodename}
                            </Radio>
                        ))}
                    </Radio.Group>
                </Spin>
            </Modal>
        </div>
    );
};

export default CustomCard;
