import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

interface Application {
    name: string;
    connections: number;
}

interface ClusterMappingProps {
    clusterName: string;
    nodeName: string;
    applications: Application[];
}

const ClusterMapping: React.FC<ClusterMappingProps> = ({ clusterName, nodeName, applications }) => {
    const cyRef = useRef<cytoscape.Core | null>(null);

    useEffect(() => {
        if (cyRef.current) {
            cyRef.current.destroy();
        }


        const elements: cytoscape.ElementDefinition[] = [
            { data: { id: 'cluster', label: `Cluster: ${clusterName}` } },
            { data: { id: 'node', label: `Node: ${nodeName}` } },
            { data: { source: 'cluster', target: 'node' } },
            ...applications.map((app) => ({
                data: { id: app.name, label: `${app.name}\n(${app.connections} connections)` },
            })),
            ...applications.map((app) => ({
                data: { source: 'node', target: app.name },
            })),
        ];
        
        cyRef.current = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#0074D9',
                        label: (node: cytoscape.NodeSingular): string => {
                            const label = node.data('label');
                            if (!label) return '';
                            const labelString = label.toString();
                            return labelString.length > 35 ? `${labelString.slice(0, 17)}...` : labelString; // 25 karakterden uzun yazıları kısalt
                        },
                        
                        color: '#000',
                        'text-valign': 'bottom',
                        'text-margin-y': 10,
                        'font-size': '12px',
                        'width': 80,
                        'height': 80,
                        'border-width': 2,
                        'border-color': '#ccc',
                        'text-wrap': 'wrap',
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#ccc',
                        'target-arrow-color': '#ccc',
                        'target-arrow-shape': 'triangle',
                    },
                },
                {
                    selector: 'node:selected',
                    style: {
                        'background-color': '#FF4136',
                    },
                },
            ],
            layout: {
                name: 'concentric',
                concentric: (node) => {
                    if (node.data('id') === 'cluster') return 3;
                    if (node.data('id') === 'node') return 2;
                    if (['largeGroup', 'mediumGroup', 'smallGroup'].includes(node.data('id'))) return 1;
                    return 0;
                },
                levelWidth: () => 1,
                spacingFactor: 2,
            },
        });
        cyRef.current.on('mouseover', 'node', (event) => {
            const node = event.target;
            const fullLabel = node.data('label'); // Tam label verisini al
            node.qtip({
                content: fullLabel, // Tooltip içeriği
                show: { event: 'mouseover' },
                hide: { event: 'mouseout' },
                position: {
                    my: 'top center',
                    at: 'bottom center',
                },
                style: {
                    classes: 'qtip-dark',
                },
            });
        });
        

        return () => {
            if (cyRef.current) {
                cyRef.current.destroy();
            }
        };
    }, [clusterName, nodeName, applications]);

    return <div id="cy" style={{ width: '100%', height: '600px', marginTop: '20px' }} />;
};

export default ClusterMapping;
