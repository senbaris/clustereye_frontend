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

interface MongoTopologyProps {
    nodes: Array<{
        nodename: string;
        status: string;
        ip: string;
        dc: string;
        version: string;
        ReplicationLagSec?: number;
        MongoStatus?: string;
    }>;
}

const MongoTopology: React.FC<MongoTopologyProps> = ({ nodes }) => {
    // Node'ları ve Edge'leri memoize edelim
    const { flowNodes, flowEdges } = useMemo(() => {
        const flowNodes: Node[] = nodes.map((node, index) => {
            const isPrimary = node.status === 'PRIMARY';
            const isArbiter = node.status === 'ARBITER';
            let xPosition = 250; // Primary için merkez pozisyon
            let yPosition = 0;   // Primary için üst pozisyon

            if (!isPrimary) {
                if (isArbiter) {
                    // Arbiter node'ları üstte sağda konumlandır
                    xPosition = 450;
                    yPosition = 0;
                } else {
                    // Secondary'leri sağ ve sol tarafa yerleştir
                    const isEvenIndex = index % 2 === 0;
                    xPosition = isEvenIndex ? 100 : 400; // Sol taraf için 100, sağ taraf için 400
                    yPosition = 150; // Tüm secondary'ler aynı y pozisyonunda
                }
            }

            // MongoDB servisi durumunu kontrol et
            let mongoStatusColor = '#999'; // Default gri
            if (node.MongoStatus === 'RUNNING') {
                mongoStatusColor = '#52c41a'; // Yeşil
            } else if (node.MongoStatus === 'STOPPED' || node.MongoStatus === 'FAILED') {
                mongoStatusColor = '#ff4d4f'; // Kırmızı
            }

            return {
                id: node.nodename,
                position: { x: xPosition, y: yPosition },
                data: { 
                    label: (
                        <div style={{ padding: '10px' }}>
                            <div style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '5px',
                                color: isPrimary ? '#1890ff' : isArbiter ? '#722ed1' : '#52c41a'
                            }}>
                                {node.nodename}
                            </div>
                            <div style={{ 
                                fontSize: '12px',
                                color: isPrimary ? '#1890ff' : isArbiter ? '#722ed1' : '#52c41a',
                                marginBottom: '2px'
                            }}>
                                {isPrimary ? 'PRIMARY' : isArbiter ? 'ARBITER' : 'SECONDARY'}
                            </div>
                            <div style={{ 
                                fontSize: '11px',
                                color: '#666',
                                marginBottom: '2px'
                            }}>
                                {node.ip}
                            </div>
                            <div style={{ 
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <span>Service: </span>
                                <div style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    background: mongoStatusColor 
                                }}></div>
                                <span style={{ color: mongoStatusColor, fontSize: '10px' }}>
                                    {node.MongoStatus || 'UNKNOWN'}
                                </span>
                            </div>
                            <div style={{
                                fontSize: '10px',
                                color: '#666',
                                marginTop: '2px'
                            }}>
                                {node.version}
                            </div>
                        </div>
                    )
                },
                style: {
                    background: '#fff',
                    border: `2px solid ${isPrimary ? '#1890ff' : isArbiter ? '#722ed1' : '#52c41a'}`,
                    borderRadius: '8px',
                    width: 180,
                },
            };
        });

        const primaryNode = nodes.find(n => n.status === 'PRIMARY');
        const secondaryNodes = nodes.filter(n => n.status === 'SECONDARY');
        
        const flowEdges: Edge[] = [];
        
        // Secondary node'lardan Primary'ye bağlantılar
        secondaryNodes.forEach((node) => {
            // Replikasyon gecikme değerini kontrol et
            const lagValue = node.ReplicationLagSec || 0;
            
            flowEdges.push({
                id: `${primaryNode?.nodename}-${node.nodename}`,
                source: primaryNode?.nodename || '',
                target: node.nodename,
                type: 'smoothstep',
                animated: true,
                style: { 
                    stroke: lagValue > 100 ? '#ff4d4f' : '#1890ff',
                    strokeWidth: lagValue > 100 ? 2 : 1
                },
                label: `${lagValue}s`,
                labelStyle: { 
                    fill: '#fff',
                    background: lagValue > 100 ? '#ff4d4f' : '#1890ff',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '12px'
                },
                labelBgStyle: { fill: lagValue > 100 ? '#ff4d4f' : '#1890ff' },
                labelBgPadding: [4, 4],
                labelBgBorderRadius: 3,
            });
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
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1890ff' }}></div>
                                <span>Primary</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#52c41a' }}></div>
                                <span>Secondary</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#722ed1' }}></div>
                                <span>Arbiter</span>
                            </div>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>
        </ReactFlowProvider>
    );
};

export default React.memo(MongoTopology); 