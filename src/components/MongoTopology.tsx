import React, { useMemo } from 'react';
import ReactFlow, { 
    Node, 
    Edge, 
    Background,
    Controls,
    ReactFlowProvider,
    Panel,
    ConnectionLineType,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
    DatabaseOutlined, 
    CloudServerOutlined, 
    WarningOutlined, 
    CheckCircleOutlined,
    ClockCircleOutlined,
    GlobalOutlined,
    ApiOutlined,
    HddOutlined,
    BuildOutlined
} from '@ant-design/icons';

interface MongoTopologyProps {
    nodes: Array<{
        nodename: string;
        status: string;
        ip: string;
        dc: string;
        version: string;
        freediskpercent?: string;
        ReplicationLagSec?: number;
        MongoStatus?: string;
    }>;
}

const MongoTopology: React.FC<MongoTopologyProps> = ({ nodes }) => {
    // Helper function to truncate hostname
    const truncateHostname = (hostname: string, maxLength: number = 20) => {
        return hostname.length > maxLength ? hostname.substring(0, maxLength) + '...' : hostname;
    };

    // Calculate optimal positions based on node count
    const { flowNodes, flowEdges } = useMemo(() => {
        const primaryNode = nodes.find(n => n.status === 'PRIMARY');
        const secondaryNodes = nodes.filter(n => n.status === 'SECONDARY');
        const arbiterNodes = nodes.filter(n => n.status === 'ARBITER');
        const otherNodes = nodes.filter(n => 
            n.status !== 'PRIMARY' && 
            n.status !== 'SECONDARY' && 
            n.status !== 'ARBITER'
        );
        
        const centerX = 400;
        const centerY = 250;
        const primaryRadius = 0; // Primary at center
        const secondaryRadius = 220; // Secondary nodes in a circle around primary
        const arbiterRadius = 180; // Arbiters in a slightly smaller circle
        
        const flowNodes: Node[] = [];
        
        // Position the PRIMARY node at the center
        if (primaryNode) {
            flowNodes.push({
                id: primaryNode.nodename,
                position: { x: centerX - 85, y: centerY - 60 },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '10px', 
                            fontFamily: 'Inter, system-ui, sans-serif',
                            background: 'linear-gradient(135deg, #f5f9ff 0%, #e8f0fe 100%)',
                            borderRadius: '8px',
                            border: '1px solid rgba(26, 115, 232, 0.2)'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    background: '#1a73e8',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '8px',
                                    boxShadow: '0 2px 4px rgba(26, 115, 232, 0.2)'
                                }}>
                                    <DatabaseOutlined style={{ color: 'white', fontSize: '14px' }} />
                                </div>
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '13px',
                                    color: '#1a73e8',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {truncateHostname(primaryNode.nodename)}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                                background: '#1a73e8',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: 'white',
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(26, 115, 232, 0.2)'
                            }}>
                                PRIMARY
                            </div>
                            
                            <div style={{ background: 'white', padding: '8px', borderRadius: '6px', marginBottom: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                    marginBottom: '4px'
                                }}>
                                    <GlobalOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>{primaryNode.ip}</span>
                                </div>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                }}>
                                    <CloudServerOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>{primaryNode.dc}</span>
                                </div>
                            </div>
                            
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: primaryNode.MongoStatus === 'RUNNING' 
                                    ? '#e6f4ea' 
                                    : primaryNode.MongoStatus === 'STOPPED' || primaryNode.MongoStatus === 'FAILED'
                                        ? '#fce8e6'
                                        : '#f1f3f4',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500'
                            }}>
                                {primaryNode.MongoStatus === 'RUNNING' ? (
                                    <CheckCircleOutlined style={{ color: '#34a853', marginRight: 6 }} />
                                ) : primaryNode.MongoStatus === 'STOPPED' || primaryNode.MongoStatus === 'FAILED' ? (
                                    <WarningOutlined style={{ color: '#ea4335', marginRight: 6 }} />
                                ) : (
                                    <ClockCircleOutlined style={{ color: '#9aa0a6', marginRight: 6 }} />
                                )}
                                <span style={{ 
                                    color: primaryNode.MongoStatus === 'RUNNING' 
                                        ? '#34a853' 
                                        : primaryNode.MongoStatus === 'STOPPED' || primaryNode.MongoStatus === 'FAILED'
                                            ? '#ea4335'
                                            : '#9aa0a6'
                                }}>
                                    {primaryNode.MongoStatus || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 170,
                },
            });
        }
        
        // Position SECONDARY nodes in a circle around PRIMARY
        secondaryNodes.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / Math.max(secondaryNodes.length, 1);
            const x = centerX + secondaryRadius * Math.cos(angle);
            const y = centerY + secondaryRadius * Math.sin(angle);
            
            const lagValue = node.ReplicationLagSec || 0;
            const lagColor = lagValue > 100 ? '#ea4335' : lagValue > 10 ? '#fbbc04' : '#34a853';
            
            flowNodes.push({
                id: node.nodename,
                position: { x: x - 85, y: y - 60 },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '10px', 
                            fontFamily: 'Inter, system-ui, sans-serif',
                            background: 'linear-gradient(135deg, #f5fbf6 0%, #e6f4ea 100%)',
                            borderRadius: '8px',
                            border: '1px solid rgba(52, 168, 83, 0.2)'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    background: '#34a853',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '8px',
                                    boxShadow: '0 2px 4px rgba(52, 168, 83, 0.2)'
                                }}>
                                    <DatabaseOutlined style={{ color: 'white', fontSize: '14px' }} />
                                </div>
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '13px',
                                    color: '#34a853',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {truncateHostname(node.nodename)}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                                background: '#34a853',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: 'white',
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(52, 168, 83, 0.2)'
                            }}>
                                SECONDARY
                            </div>
                            
                            <div style={{ background: 'white', padding: '8px', borderRadius: '6px', marginBottom: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                }}>
                                    <GlobalOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>{node.ip}</span>
                                </div>
                            </div>

                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: node.MongoStatus === 'RUNNING' 
                                    ? '#e6f4ea' 
                                    : node.MongoStatus === 'STOPPED' || node.MongoStatus === 'FAILED'
                                        ? '#fce8e6'
                                        : '#f1f3f4',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500'
                            }}>
                                {node.MongoStatus === 'RUNNING' ? (
                                    <CheckCircleOutlined style={{ color: '#34a853', marginRight: 6 }} />
                                ) : node.MongoStatus === 'STOPPED' || node.MongoStatus === 'FAILED' ? (
                                    <WarningOutlined style={{ color: '#ea4335', marginRight: 6 }} />
                                ) : (
                                    <ClockCircleOutlined style={{ color: '#9aa0a6', marginRight: 6 }} />
                                )}
                                <span style={{ 
                                    color: node.MongoStatus === 'RUNNING' 
                                        ? '#34a853' 
                                        : node.MongoStatus === 'STOPPED' || node.MongoStatus === 'FAILED'
                                            ? '#ea4335'
                                            : '#9aa0a6'
                                }}>
                                    {node.MongoStatus || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 170,
                },
            });
        });
        
        // Position ARBITER nodes
        arbiterNodes.forEach((node, index) => {
            // Place arbiters at the top of the visualization
            const angle = (Math.PI / 2) + ((Math.PI / Math.max(arbiterNodes.length + 1, 2)) * (index + 1));
            const x = centerX + arbiterRadius * Math.cos(angle);
            const y = centerY + arbiterRadius * Math.sin(angle);
            
            flowNodes.push({
                id: node.nodename,
                position: { x: x - 70, y: y - 45 }, // Arbiter nodes are slightly smaller
                data: { 
                    label: (
                        <div style={{ 
                            padding: '10px', 
                            fontFamily: 'Inter, system-ui, sans-serif',
                            background: 'linear-gradient(135deg, #f9f7fd 0%, #f3e8fd 100%)',
                            borderRadius: '8px',
                            border: '1px solid rgba(147, 52, 230, 0.2)'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    background: '#9334e6',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '8px',
                                    boxShadow: '0 2px 4px rgba(147, 52, 230, 0.2)'
                                }}>
                                    <ApiOutlined style={{ color: 'white', fontSize: '14px' }} />
                                </div>
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '12px',
                                    color: '#9334e6',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {truncateHostname(node.nodename)}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                                background: '#9334e6',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: 'white',
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(147, 52, 230, 0.2)'
                            }}>
                                ARBITER
                            </div>
                            
                            <div style={{ background: 'white', padding: '6px 8px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                }}>
                                    <GlobalOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>{node.ip}</span>
                                </div>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 135,
                },
            });
        });
        
        // Position other nodes (if any) on the bottom
        otherNodes.forEach((node, index) => {
            const x = centerX - (otherNodes.length * 150) / 2 + index * 150;
            const y = centerY + 300;
            
            flowNodes.push({
                id: node.nodename,
                position: { x, y },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '10px', 
                            fontFamily: 'Inter, system-ui, sans-serif',
                            background: 'linear-gradient(135deg, #fdf3f2 0%, #fce8e6 100%)',
                            borderRadius: '8px',
                            border: '1px solid rgba(234, 67, 53, 0.2)'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    background: '#ea4335',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '8px',
                                    boxShadow: '0 2px 4px rgba(234, 67, 53, 0.2)'
                                }}>
                                    <BuildOutlined style={{ color: 'white', fontSize: '14px' }} />
                                </div>
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '12px',
                                    color: '#ea4335',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {truncateHostname(node.nodename)}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                                background: '#ea4335',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: 'white',
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(234, 67, 53, 0.2)'
                            }}>
                                {node.status}
                            </div>
                            
                            <div style={{ background: 'white', padding: '6px 8px', borderRadius: '4px', marginBottom: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                }}>
                                    <GlobalOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>{node.ip}</span>
                                </div>
                            </div>
                            
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: node.MongoStatus === 'RUNNING' 
                                    ? '#e6f4ea' 
                                    : node.MongoStatus === 'STOPPED' || node.MongoStatus === 'FAILED'
                                        ? '#fce8e6'
                                        : '#f1f3f4',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500'
                            }}>
                                {node.MongoStatus === 'RUNNING' ? (
                                    <CheckCircleOutlined style={{ color: '#34a853', marginRight: 6 }} />
                                ) : node.MongoStatus === 'STOPPED' || node.MongoStatus === 'FAILED' ? (
                                    <WarningOutlined style={{ color: '#ea4335', marginRight: 6 }} />
                                ) : (
                                    <ClockCircleOutlined style={{ color: '#9aa0a6', marginRight: 6 }} />
                                )}
                                <span style={{ 
                                    color: node.MongoStatus === 'RUNNING' 
                                        ? '#34a853' 
                                        : node.MongoStatus === 'STOPPED' || node.MongoStatus === 'FAILED'
                                            ? '#ea4335'
                                            : '#9aa0a6'
                                }}>
                                    {node.MongoStatus || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 135,
                },
            });
        });
        
        // Create edges
        const flowEdges: Edge[] = [];
        
        // Connect PRIMARY to all SECONDARY nodes
        if (primaryNode) {
            secondaryNodes.forEach((node) => {
                const lagValue = node.ReplicationLagSec || 0;
                const lagColor = lagValue > 100 ? '#ea4335' : lagValue > 10 ? '#fbbc04' : '#34a853';
                
                flowEdges.push({
                    id: `primary-to-${node.nodename}`,
                    source: primaryNode.nodename,
                    target: node.nodename,
                    type: 'smoothstep',
                    animated: true,
                    style: { 
                        stroke: lagColor,
                        strokeWidth: lagValue > 100 ? 2.5 : lagValue > 10 ? 2 : 1.5,
                        opacity: 0.8
                    },
                    label: `${lagValue}s`,
                    labelStyle: { 
                        fill: lagColor,
                        fontWeight: 'bold',
                        fontSize: '10px',
                        fontFamily: 'Inter, system-ui, sans-serif'
                    },
                    labelBgStyle: { 
                        fill: '#ffffff',
                        stroke: lagColor,
                        strokeWidth: 1,
                        borderRadius: 4
                    },
                    labelBgPadding: [4, 3],
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: lagColor,
                        width: 16,
                        height: 16,
                        strokeWidth: 1
                    },
                });
            });
            
            // Connect PRIMARY to all ARBITER nodes
            arbiterNodes.forEach((node) => {
                flowEdges.push({
                    id: `primary-to-${node.nodename}`,
                    source: primaryNode.nodename,
                    target: node.nodename,
                    type: 'smoothstep',
                    style: { 
                        stroke: '#9334e6',
                        strokeWidth: 1.5,
                        strokeDasharray: '6 3',
                        opacity: 0.7
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#9334e6',
                        width: 14,
                        height: 14,
                        strokeWidth: 1
                    },
                });
            });
        }
        
        return { flowNodes, flowEdges };
    }, [nodes]);

    return (
        <ReactFlowProvider>
            <div style={{ 
                height: '550px', 
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)', 
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fb 100%)'
            }}>
                <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    fitView
                    connectionLineType={ConnectionLineType.SmoothStep}
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.2}
                    maxZoom={1.5}
                    nodesDraggable={true}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    style={{ background: 'transparent' }}
                >
                    <Background color="#e0e0e0" gap={22} size={1.2} />
                    <Controls 
                        position="bottom-right" 
                        showInteractive={false}
                        style={{
                            borderRadius: '8px',
                            padding: '4px',
                            backgroundColor: 'white',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(0,0,0,0.05)'
                        }}
                        onZoomIn={() => {}}
                        onZoomOut={() => {}}
                        onFitView={() => {}}
                    />
                    <Panel position="top-right">
                        <div style={{ 
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fb 100%)', 
                            padding: '12px', 
                            borderRadius: '10px', 
                            boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: '12px',
                            backdropFilter: 'blur(8px)'
                        }}>
                            <div style={{ 
                                fontWeight: 'bold', 
                                fontSize: '13px', 
                                marginBottom: '12px', 
                                color: '#202124',
                                borderBottom: '1px solid rgba(0,0,0,0.05)',
                                paddingBottom: '8px'
                            }}>
                                MongoDB Replica Set
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ 
                                        width: '10px', 
                                        height: '10px', 
                                        borderRadius: '3px', 
                                        background: '#1a73e8',
                                        boxShadow: '0 1px 2px rgba(26, 115, 232, 0.3)'
                                    }}></div>
                                    <span style={{ fontSize: '12px', color: '#3c4043' }}>Primary</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ 
                                        width: '10px', 
                                        height: '10px', 
                                        borderRadius: '3px', 
                                        background: '#34a853',
                                        boxShadow: '0 1px 2px rgba(52, 168, 83, 0.3)'
                                    }}></div>
                                    <span style={{ fontSize: '12px', color: '#3c4043' }}>Secondary</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ 
                                        width: '10px', 
                                        height: '10px', 
                                        borderRadius: '3px', 
                                        background: '#9334e6',
                                        boxShadow: '0 1px 2px rgba(147, 52, 230, 0.3)'
                                    }}></div>
                                    <span style={{ fontSize: '12px', color: '#3c4043' }}>Arbiter</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                    <div style={{ 
                                        width: '10px', 
                                        height: '10px', 
                                        borderRadius: '3px', 
                                        background: '#ea4335',
                                        boxShadow: '0 1px 2px rgba(234, 67, 53, 0.3)'
                                    }}></div>
                                    <span style={{ fontSize: '12px', color: '#3c4043' }}>Down/Unknown</span>
                                </div>
                            </div>
                            
                            <div style={{ 
                                marginTop: '12px', 
                                fontSize: '12px', 
                                color: '#3c4043',
                                background: 'rgba(0,0,0,0.02)',
                                padding: '8px',
                                borderRadius: '6px' 
                            }}>
                                <div style={{ 
                                    fontWeight: '500', 
                                    marginBottom: '6px',
                                    fontSize: '12px',
                                    color: '#202124'
                                }}>
                                    Replication Status:
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ 
                                            height: '3px', 
                                            width: '20px', 
                                            background: 'linear-gradient(90deg, #34a853 0%, #81c995 100%)',
                                            borderRadius: '2px'
                                        }}></div>
                                        <span>Healthy</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ 
                                            height: '3px', 
                                            width: '20px', 
                                            background: 'linear-gradient(90deg, #fbbc04 0%, #fdd663 100%)',
                                            borderRadius: '2px'
                                        }}></div>
                                        <span>Delayed</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ 
                                            height: '3px', 
                                            width: '20px', 
                                            background: 'linear-gradient(90deg, #ea4335 0%, #f28b82 100%)',
                                            borderRadius: '2px'
                                        }}></div>
                                        <span>Critical Delay</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>
        </ReactFlowProvider>
    );
};

export default React.memo(MongoTopology); 