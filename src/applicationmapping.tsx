import React, { useState, useEffect } from 'react';
import { Select, Steps, Spin, message, Button } from 'antd';
import axios from 'axios';
import ClusterMapping from './clustermapping';

const { Option } = Select;
const { Step } = Steps;

const ApplicationMapping: React.FC = () => {
    const [clusters, setClusters] = useState<{ name: string; type: 'mongodb' | 'postgresql' }[]>([]);
    const [nodes, setNodes] = useState<string[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<{ name: string; type: 'mongodb' | 'postgresql' } | null>(
        null
    );
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [mappingData, setMappingData] = useState<{ name: string; connections: number }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState(0);

    // Cluster ve Node seçimlerini sıfırlar
    const resetSteps = () => {
        setSelectedCluster(null);
        setSelectedNode(null);
        setNodes([]);
        setMappingData([]);
        setCurrentStep(0);
    };

    useEffect(() => {
        setLoading(true);

        axios
            .get(`${import.meta.env.VITE_REACT_APP_API_URL}/generalhealth`)
            .then((response) => {
                const { postgresql, mongodb } = response.data;

                const postgresClusters = postgresql.flatMap((cluster: any) =>
                    Object.keys(cluster).map((name) => ({ name, type: 'postgresql' }))
                );

                const mongoClusters = mongodb.flatMap((cluster: any) =>
                    Object.keys(cluster).map((name) => ({ name, type: 'mongodb' }))
                );

                const allClusters = [...postgresClusters, ...mongoClusters];
                setClusters(allClusters);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching clusters:', error);
                message.error('Failed to fetch clusters');
                setLoading(false);
            });
    }, []);

    const handleClusterChange = (clusterName: string) => {
        const cluster = clusters.find((c) => c.name === clusterName);
        if (!cluster) return;

        setSelectedCluster(cluster);
        setLoading(true);

        axios
            .get(`${import.meta.env.VITE_REACT_APP_API_URL}/generalhealth`)
            .then((response) => {
                const clusterData = response.data[cluster.type].find((item: any) => item[clusterName]);
                const clusterNodes = clusterData[clusterName].map((node: any) =>
                    cluster.type === 'mongodb' ? node.nodename : node.Hostname
                );

                setNodes(clusterNodes);
                setSelectedNode(null);
                setCurrentStep(1);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching nodes:', error);
                message.error('Failed to fetch nodes');
                setLoading(false);
            });
    };

    const handleNodeChange = async (node: string) => {
        if (!selectedCluster) return;

        setSelectedNode(node);
        setLoading(true);

        try {
            if (selectedCluster.type === 'mongodb') {
                const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/get_mongodbconnections`, { hostname: node });
                const sanitizedData = response.data.map((app: any) => ({
                    name: app._id || 'noappname',
                    connections: app.total_connections || 0,
                }));
                setMappingData(sanitizedData);
            } else if (selectedCluster.type === 'postgresql') {
                const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/run_pg_nonidleconns_query`, { nodeName: node });
                const sanitizedData = response.data.map((app: any) => ({
                    name: app.application_name || 'noappname',
                    connections: app.connection_count || 0,
                }));
                setMappingData(sanitizedData);
            }
            setCurrentStep(2);
        } catch (error) {
            console.error('Error fetching mapping data:', error);
            message.error('Failed to fetch application mapping');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Steps current={currentStep}>
                <Step title="Select Cluster" description={selectedCluster?.name || ''} />
                <Step title="Select Node" description={selectedNode || ''} />
                <Step title="View Application Mapping" />
            </Steps>

            {currentStep === 0 && (
                <Select
                    style={{ width: '50%', marginTop: 20 }}
                    showSearch
                    placeholder="Select a cluster"
                    onChange={handleClusterChange}
                    loading={loading}
                >
                    {clusters.map((cluster) => (
                        <Option key={cluster.name} value={cluster.name}>
                            {cluster.name} ({cluster.type})
                        </Option>
                    ))}
                </Select>
            )}

            {currentStep === 1 && (
                <Select
                    style={{ width: '50%', marginTop: 20 }}
                    showSearch
                    placeholder="Select a node"
                    onChange={handleNodeChange}
                    loading={loading}
                >
                    {nodes.map((node) => (
                        <Option key={node} value={node}>
                            {node}
                        </Option>
                    ))}
                </Select>
            )}

            {currentStep === 2 && mappingData.length > 0 && (
                <ClusterMapping
                    clusterName={selectedCluster!.name}
                    nodeName={selectedNode!}
                    applications={mappingData}
                />
            )}

            {loading && (
                <div style={{ marginTop: 20 }}>
                    <Spin size="large" />
                </div>
            )}

            {!loading && currentStep > 0 && (
                <Button style={{ marginTop: 20 }} onClick={resetSteps}>
                    Reset
                </Button>
            )}
        </div>
    );
};

export default ApplicationMapping;
