import React, { useMemo } from 'react';
import ReactFlow, { 
    Node, 
    Edge, 
    Background,
    Controls,
    ReactFlowProvider,
    Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

interface TopologyProps {
    nodes: Array<{
        Hostname: string;
        NodeStatus: string;
        ReplicationLagSec: string;
        IP: string;
    }>;
}

const ClusterTopology: React.FC<TopologyProps> = ({ nodes }) => {
    // Node'ları ve Edge'leri memoize edelim
    const { flowNodes, flowEdges } = useMemo(() => {
        const flowNodes: Node[] = nodes.map((node, index) => {
            const isMaster = node.NodeStatus === 'MASTER';
            let xPosition = 250; // Master için merkez pozisyon
            let yPosition = 0;   // Master için üst pozisyon

            if (!isMaster) {
                // Slave'leri sağ ve sol tarafa yerleştir
                const isEvenIndex = index % 2 === 0;
                xPosition = isEvenIndex ? 100 : 400; // Sol taraf için 100, sağ taraf için 400
                yPosition = 150; // Tüm slave'ler aynı y pozisyonunda
            }

            return {
                id: node.Hostname,
                position: { x: xPosition, y: yPosition },
                data: { 
                    label: (
                        <div style={{ padding: '10px' }}>
                            <div style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '5px',
                                color: isMaster ? '#1890ff' : '#52c41a'
                            }}>
                                {node.Hostname}
                            </div>
                            <div style={{ 
                                fontSize: '12px',
                                color: isMaster ? '#1890ff' : '#52c41a',
                                marginBottom: '2px'
                            }}>
                                {isMaster ? 'MASTER' : 'SLAVE'}
                            </div>
                            <div style={{ 
                                fontSize: '11px',
                                color: '#666'
                            }}>
                                {node.IP}
                            </div>
                        </div>
                    )
                },
                style: {
                    background: '#fff',
                    border: `2px solid ${isMaster ? '#1890ff' : '#52c41a'}`,
                    borderRadius: '8px',
                    width: 180,
                },
            };
        });

        const masterNode = nodes.find(n => n.NodeStatus === 'MASTER');
        const slaveNodes = nodes.filter(n => n.NodeStatus !== 'MASTER');
        
        const flowEdges: Edge[] = slaveNodes.map((node) => {
            // Replication lag değerini sayıya çevir ve kontrol et
            const lagValue = node.ReplicationLagSec ? parseFloat(node.ReplicationLagSec) : 0;
            console.log('Processing lag value for node:', node.Hostname, 'Value:', lagValue);
            
            return {
                id: `${masterNode?.Hostname}-${node.Hostname}`,
                source: masterNode?.Hostname || '',
                target: node.Hostname,
                type: 'smoothstep',
                animated: true,
                style: { 
                    stroke: lagValue > 300 ? '#ff4d4f' : '#1890ff',
                    strokeWidth: lagValue > 300 ? 2 : 1
                },
                label: `${lagValue.toFixed(0)}s`,
                labelStyle: { 
                    fill: '#fff',
                    background: lagValue > 300 ? '#ff4d4f' : '#1890ff',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '12px'
                },
                labelBgStyle: { fill: lagValue > 300 ? '#ff4d4f' : '#1890ff' },
                labelBgPadding: [4, 4],
                labelBgBorderRadius: 3,
            };
        });

        return { flowNodes, flowEdges };
    }, [nodes]);

    return (
        <ReactFlowProvider>
            <div style={{ height: '500px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    fitView
                    attributionPosition="bottom-right"
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.2}
                    maxZoom={1.5}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}
                >
                    <Background />
                    <Controls />
                    <Panel position="top-left">
                        <div style={{ background: 'white', padding: '8px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6' }}></div>
                                <span>Master</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></div>
                                <span>Slave</span>
                            </div>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>
        </ReactFlowProvider>
    );
};

export default React.memo(ClusterTopology); 