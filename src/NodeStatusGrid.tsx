import React, { useState } from 'react';
import { Card, Badge, Space, Row, Col, Tag, Progress, Collapse } from 'antd';
import { NodeType } from './type';
import { 
  CheckCircleOutlined, 
  WarningOutlined, 
  CloseCircleOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  HddOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  CaretRightOutlined
} from '@ant-design/icons';
import { getStatusColor, STATUS_COLORS } from './hexagon';
import { useNavigate } from 'react-router-dom';

// MongoDB SVG Icon Component
const MongoDBIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    width="1.2em" 
    height="1.2em" 
    fill="currentColor"
    style={{ marginRight: 8, verticalAlign: 'middle' }}
  >
    <path d="M12.512 24.013a.511.511 0 0 1-.163-.027l-.599-.206a.5.5 0 0 1-.337-.483c0-.016.027-1.457-.288-2.345a12.867 12.867 0 0 1-2.323-2.438 12.8 12.8 0 0 1-.896-1.404 11.18 11.18 0 0 1-1.394-5.934c.178-3.863 1.726-7.372 4.245-9.625.405-.363.616-.708.684-1.117a.499.499 0 0 1 .465-.418c.25-.034.445.138.51.363.113.402.321.84.57 1.2.085.162.301.394.492.597.938 1 2.889 3.082 3.825 7.338.931 5.606-1.662 9.068-3.29 10.636-.359.35-.64.569-.777.673a.983.983 0 0 0-.188.38c-.127.586-.071 1.841-.038 2.275a.504.504 0 0 1-.193.433.51.51 0 0 1-.305.102zM11.923 1.76a3.834 3.834 0 0 1-.498.534c-2.321 2.075-3.747 5.329-3.914 8.928a10.197 10.197 0 0 0 1.273 5.407c.243.442.521.878.825 1.293.975 1.328 1.955 2.111 2.232 2.32a.49.49 0 0 1 .161.207c.046.109.087.226.123.347.076-.225.199-.44.372-.652a.512.512 0 0 1 .092-.088c.093-.067.366-.271.694-.58 1.523-1.479 3.89-4.645 3.039-9.773-.873-3.962-2.63-5.836-3.573-6.844-.318-.339-.528-.563-.631-.793a4.144 4.144 0 0 1-.195-.306z"></path>
  </svg>
);

// PostgreSQL SVG Icon Component
const PostgreSQLIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="1.6em" 
    height="1.6em" 
    viewBox="0 0 32 32"
    fill="currentColor"
    style={{ marginRight: 8, verticalAlign: 'middle', position: 'relative', top: '-2px' }}
  >
    <path d="M26.741 18.661c-.24-.278-.65-.202-.967-.139-.762.136-1.591.294-2.329-.023 1.318-2.08 2.355-4.351 2.935-6.748.211-.911.374-1.843.343-2.781-.023-.525-.096-1.084-.417-1.519A6.019 6.019 0 0 0 23.092 5.3c-1.585-.43-3.285-.302-4.844.18-.129.026-.256-.032-.382-.048-1.415-.287-2.975-.174-4.202.645-1.473-.53-3.056-.85-4.624-.686-1.166.121-2.337.663-3.006 1.656-.846 1.239-.961 2.821-.826 4.273.272 1.928.742 3.826 1.34 5.677.394 1.154.828 2.317 1.529 3.325.356.495.829.994 1.466 1.072.566.069 1.078-.282 1.425-.698.6-.718 1.217-1.423 1.857-2.105.418.205.872.323 1.336.358-.251.298-.458.687-.858.804-.539.208-1.17.18-1.645.539-.274.196-.287.623-.041.848.445.432 1.101.525 1.693.575a3.21 3.21 0 0 0 2.324-.768c-.004 1.334.002 2.672.152 3.999.075.777.41 1.551 1.001 2.074.557.486 1.351.587 2.058.464.694-.132 1.407-.34 1.949-.814.576-.508.822-1.275.936-2.011a93.19 93.19 0 0 0 .514-3.969c1.483.25 3.161-.034 4.269-1.117.237-.223.462-.609.228-.912zM23.45 6.117c.89.338 1.681.925 2.275 1.668.283.355.319.832.337 1.268.013 1.04-.197 2.067-.464 3.067a21.858 21.858 0 0 1-2.262 5.277 4.38 4.38 0 0 1-.317.469 60.07 60.07 0 0 1-.036-.183c.121-.318.298-.618.367-.956.244-.953.038-1.934-.05-2.893-.092-.905.217-1.786.209-2.689.035-.442-.14-.86-.31-1.257-.615-1.375-1.593-2.598-2.848-3.438-.306-.21-.648-.357-.953-.568 1.334-.286 2.765-.25 4.051.234zm-.813 7.719c.078 1.071.389 2.221-.116 3.237-.677-1.347-1.552-2.633-1.857-4.133-.086-.477-.108-1.081.316-1.413.538-.382 1.241-.296 1.863-.258-.027.859-.291 1.702-.205 2.567zm-12.103 6.345c-.243.286-.571.627-.985.542-.484-.14-.792-.582-1.062-.979-.729-1.166-1.168-2.483-1.571-3.79-.451-1.547-.831-3.119-1.05-4.717-.109-1.216-.041-2.52.581-3.603.466-.82 1.335-1.343 2.248-1.514 1.462-.281 2.961.017 4.364.445a6.438 6.438 0 0 0-1.382 2.358 9.506 9.506 0 0 0-.466 3.648c.053.867.03 1.738-.091 2.598-.152 1.123.299 2.278 1.133 3.036-.568.664-1.17 1.297-1.72 1.977zm1.28-4.023c-.143-.636.044-1.276.065-1.913.049-.721-.002-1.443-.016-2.164.674-.436 1.462-.777 2.279-.73a.992.992 0 0 1 .915.734c.371 1.477.486 3.121-.225 4.52a13.24 13.24 0 0 0-.622 1.666c-1.182.012-2.187-.987-2.396-2.112zm3.678 3.954c-.742 1.005-2.227 1.197-3.3.65.529-.245 1.148-.226 1.659-.528.494-.266.69-.851 1.152-1.152.503-.071.87.676.49 1.029zm6.364-1.174c-.282.454-.183 1.008-.252 1.512-.162 1.413-.321 2.828-.551 4.232-.109.673-.395 1.388-1.03 1.723-.651.331-1.407.539-2.139.426-.695-.122-1.133-.77-1.33-1.401-.144-.529-.159-1.082-.2-1.627a50.004 50.004 0 0 1-.037-3.949c.029-.514-.235-1.049-.694-1.299-.222-.125-.482-.142-.73-.162.195-.967.784-1.802.986-2.768.262-1.195.117-2.439-.151-3.619-.131-.589-.579-1.11-1.175-1.253-.918-.231-1.844.128-2.665.512.104-1.334.461-2.7 1.278-3.783a3.79 3.79 0 0 1 2.528-1.473c1.642-.209 3.366.243 4.671 1.27a7.406 7.406 0 0 1 2.389 3.304c-.763-.027-1.628-.058-2.245.472-.56.472-.632 1.277-.506 1.953.292 1.608 1.241 2.975 1.941 4.421.186.339.436.635.674.939-.283.143-.599.28-.76.571zm1.964 1.137c-.504.06-1.028.078-1.514-.089.002-.275-.013-.601.208-.806.175-.129.424-.248.626-.107.86.453 1.86.232 2.775.121-.559.544-1.333.798-2.095.881zm-2.642-8.347c-.179.147.014.367.168.436.373.219.884-.087.896-.513-.337-.157-.76-.141-1.065.077zm-6.602.68c.159-.09.327-.337.143-.486-.262-.213-.643-.254-.962-.168-.103.036-.211.106-.19.232.074.428.647.688 1.008.422z"></path>
  </svg>
);

// Status component with nice icon
const StatusBadge = ({ status }: { status: string }) => {
  const color = status === STATUS_COLORS.GREEN 
    ? 'success' 
    : status === STATUS_COLORS.YELLOW 
      ? 'warning' 
      : 'error';
  
  const icon = status === STATUS_COLORS.GREEN 
    ? <CheckCircleOutlined /> 
    : status === STATUS_COLORS.YELLOW 
      ? <WarningOutlined /> 
      : <CloseCircleOutlined />;
  
  return <Badge status={color as any} text={icon} />;
};

interface NodeStatusGridProps {
  nodes: NodeType[];
  title: string;
  type: 'mongodb' | 'postgresql';
  onStatusCount?: (critical: number, warning: number) => void;
  activeFilter?: 'all' | 'critical' | 'warning' | 'mongodb' | 'postgresql' | 'issues';
  onNodeClick?: (node: NodeType) => void;
}

// Helper function to evaluate node status and assign priority
const evaluateNodeStatus = (node: NodeType, type: 'mongodb' | 'postgresql') => {
  // Node basic information
  const nodeStatus = type === 'mongodb' 
    ? (node.status || node.NodeStatus || 'N/A')
    : (node.NodeStatus || node.status || 'N/A');
  
  // Service status for MongoDB and PostgreSQL
  const mongoServiceStatus = type === 'mongodb' && node.MongoStatus 
    ? node.MongoStatus 
    : null;
  
  const pgServiceStatus = type === 'postgresql' && node.PGServiceStatus 
    ? node.PGServiceStatus 
    : null;
      
  // Determine card border color based on service status and node status
  let borderColor = STATUS_COLORS.GREEN;
  
  // Check if service is running
  const serviceRunning = type === 'mongodb' 
    ? mongoServiceStatus === 'RUNNING'
    : pgServiceStatus === 'RUNNING';
  
  // Check if node status is healthy
  const isHealthyStatus =
    nodeStatus === "PRIMARY" ||
    nodeStatus === "MASTER" ||
    nodeStatus === "SECONDARY" ||
    nodeStatus === "SLAVE";
      
  // If service is not running, show red
  if (!serviceRunning && (mongoServiceStatus || pgServiceStatus)) {
    borderColor = STATUS_COLORS.RED;
  }
  // Else if node is not in healthy state, show red
  else if (!isHealthyStatus) {
    borderColor = STATUS_COLORS.RED;
  }
  // Else if disk space is low, show yellow
  else if (Number(node.freediskpercent || node.FDPercent || 0) < 25) {
    borderColor = STATUS_COLORS.YELLOW;
  }

  // Numeric priority for sorting (critical=1, warning=2, normal=3)
  let priority = 3; // Default (normal)
  if (borderColor === STATUS_COLORS.RED) {
    priority = 1; // Critical
  } else if (borderColor === STATUS_COLORS.YELLOW) {
    priority = 2; // Warning
  }
  
  return {
    node,
    borderColor,
    priority
  };
};

const NodeStatusGrid: React.FC<NodeStatusGridProps> = ({ nodes, title, type, onStatusCount, activeFilter = 'all', onNodeClick }) => {
  const navigate = useNavigate();
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);
  
  // First evaluate all nodes for status and priority
  const evaluatedNodes = nodes.map(node => evaluateNodeStatus(node, type));
  
  // Sort all nodes by priority
  evaluatedNodes.sort((a, b) => a.priority - b.priority);
  
  // Calculate status counts
  const criticalCount = evaluatedNodes.filter(item => item.priority === 1).length;
  const warningCount = evaluatedNodes.filter(item => item.priority === 2).length;
  
  // Notify parent component of status counts
  React.useEffect(() => {
    if (onStatusCount) {
      onStatusCount(criticalCount, warningCount);
    }
  }, [criticalCount, warningCount, onStatusCount]);
  
  // Group nodes by cluster
  const groupedNodes: Record<string, Array<{ node: NodeType, borderColor: string, priority: number }>> = {};
  
  evaluatedNodes.forEach(evalNode => {
    const groupName = type === 'mongodb' 
      ? (evalNode.node.replsetname || evalNode.node.ClusterName || 'Unknown')
      : (evalNode.node.ClusterName || 'Unknown');
    
    if (!groupedNodes[groupName]) {
      groupedNodes[groupName] = [];
    }
    
    groupedNodes[groupName].push(evalNode);
  });

  if (nodes.length === 0) {
    return null;
  }

  // Calculate cluster priorities for sorting
  const clusterPriorities = Object.entries(groupedNodes).map(([groupName, nodes]) => {
    // Find the highest priority (lowest number) in the cluster
    const highestPriority = Math.min(...nodes.map(item => item.priority));
    
    return {
      groupName,
      priority: highestPriority
    };
  }).sort((a, b) => a.priority - b.priority);

  // Filter clusters based on activeFilter
  const shouldShowNode = (node: { priority: number }, type: 'mongodb' | 'postgresql') => {
    switch (activeFilter) {
      case 'critical':
        return node.priority === 1;
      case 'warning':
        return node.priority === 2;
      case 'issues':
        return node.priority === 1 || node.priority === 2;
      case 'mongodb':
        return type === 'mongodb';
      case 'postgresql':
        return type === 'postgresql';
      default:
        return true;
    }
  };

  const shouldShowCluster = (groupName: string, nodes: Array<{ node: NodeType, borderColor: string, priority: number }>) => {
    return nodes.some(node => shouldShowNode(node, type));
  };

  // Toggle cluster expansion
  const toggleCluster = (clusterName: string) => {
    setExpandedClusters(prev => 
      prev.includes(clusterName)
        ? prev.filter(name => name !== clusterName)
        : [...prev, clusterName]
    );
  };

  // Hide entire component if it doesn't match the filter
  if ((activeFilter === 'mongodb' && type !== 'mongodb') || 
      (activeFilter === 'postgresql' && type !== 'postgresql')) {
    return null;
  }

  // Check if there are any nodes matching the filter
  const hasMatchingNodes = clusterPriorities.some(({ groupName }) => {
    const nodes = groupedNodes[groupName];
    return shouldShowCluster(groupName, nodes);
  });

  // If no nodes match the filter, hide the entire component
  if (!hasMatchingNodes) {
    return null;
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {clusterPriorities.map(({ groupName }) => {
          const sortedNodes = groupedNodes[groupName];
          
          // Skip rendering if cluster doesn't match filter
          if (!shouldShowCluster(groupName, sortedNodes)) {
            return null;
          }

          // Determine if this cluster should be highlighted
          const hasIssues = criticalCount > 0 || warningCount > 0;
          
          // Count critical and warning nodes in this cluster
          const clusterCriticalCount = sortedNodes.filter(item => item.borderColor === STATUS_COLORS.RED).length;
          const clusterWarningCount = sortedNodes.filter(item => item.borderColor === STATUS_COLORS.YELLOW).length;
          const clusterIsHealthy = clusterCriticalCount === 0 && clusterWarningCount === 0;
          
          const isExpanded = expandedClusters.includes(groupName);

          return (
            <Card 
              key={groupName} 
              title={
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer' 
                  }}
                  onClick={() => toggleCluster(groupName)}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <CaretRightOutlined 
                      style={{ 
                        marginRight: 8,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s'
                      }} 
                    />
                    {type === 'mongodb' ? <MongoDBIcon /> : <PostgreSQLIcon />}
                    <span style={{ verticalAlign: 'middle' }}>
                      {groupName} {type === 'mongodb' ? 'Replicaset' : 'Cluster'}
                    </span>
                  </span>
                  <div>
                    {clusterCriticalCount > 0 && (
                      <Tag color="red" style={{ marginRight: 5 }}>
                        {clusterCriticalCount} Critical
                      </Tag>
                    )}
                    {clusterWarningCount > 0 && (
                      <Tag color="orange" style={{ marginRight: 5 }}>
                        {clusterWarningCount} Warning
                      </Tag>
                    )}
                    {clusterIsHealthy && (
                      <Tag color="green" style={{ marginRight: 5 }}>
                        Healthy
                      </Tag>
                    )}
                    <Tag color={type === 'mongodb' ? 'blue' : 'cyan'}>
                      {sortedNodes.length} Nodes
                    </Tag>
                  </div>
                </div>
              }
              style={{ 
                marginBottom: 16,
                borderTop: `2px solid ${
                  clusterCriticalCount > 0 ? STATUS_COLORS.RED : 
                  clusterWarningCount > 0 ? STATUS_COLORS.YELLOW :
                  type === 'mongodb' ? '#4FAA41' : '#336791'
                }`
              }}
              size="small"
              bordered
              className={hasIssues ? 'cluster-with-issues' : ''}
              bodyStyle={{ padding: isExpanded ? '16px' : 0, display: isExpanded ? 'block' : 'none' }}
            >
              {isExpanded && (
                <Row gutter={[16, 16]}>
                  {sortedNodes
                    .filter(node => shouldShowNode(node, type))
                    .map(({ node, borderColor }, index) => {
                      // Node basic information
                      const nodeName = type === 'mongodb' 
                        ? (node.nodename || node.Hostname || 'N/A')
                        : (node.Hostname || node.nodename || 'N/A');
                      
                      const nodeStatus = type === 'mongodb' 
                        ? (node.status || node.NodeStatus || 'N/A')
                        : (node.NodeStatus || node.status || 'N/A');
                      
                      const location = type === 'mongodb'
                        ? (node.dc || node.DC || 'N/A')
                        : (node.DC || node.dc || 'N/A');
                      
                      const freeDiskPercent = type === 'mongodb'
                        ? (node.freediskpercent || node.FDPercent || 0)
                        : (node.FDPercent || node.freediskpercent || 0);
                      
                      const freeDiskData = type === 'mongodb'
                        ? (node.freediskdata || node.FreeDisk || 'N/A')
                        : (node.FreeDisk || node.freediskdata || 'N/A');
                      
                      // Get IP address
                      const ipAddress = node.IP || 'N/A';
                      
                      // Service status for MongoDB and PostgreSQL
                      const mongoServiceStatus = type === 'mongodb' && node.MongoStatus 
                        ? node.MongoStatus 
                        : null;
                      
                      const pgServiceStatus = type === 'postgresql' && node.PGServiceStatus 
                        ? node.PGServiceStatus 
                        : null;
                      
                      // Progress bar color based on free disk space percentage
                      const getDiskProgressColor = (percent: number) => {
                        if (percent < 20) return 'red';
                        if (percent < 40) return 'orange';
                        return 'green';
                      };
                      
                      // Handle node click
                      const handleNodeClick = () => {
                        if (onNodeClick) {
                          onNodeClick(node);
                        } else if (type === 'postgresql') {
                          // Default behavior for PostgreSQL nodes
                          const clusterName = node.ClusterName || 'postgres';
                          const hostName = node.Hostname || '';
                          
                          // Navigate with both clusterName and hostName parameters
                          navigate(`/postgrepa?clusterName=${clusterName}&hostName=${hostName}`);
                        }
                      };

                      return (
                        <Col xs={24} sm={12} md={8} lg={6} key={`${nodeName}-${index}`}>
                          <Card 
                            size="small"
                            className={
                              borderColor === STATUS_COLORS.RED 
                                ? 'blinking-card' 
                                : borderColor === STATUS_COLORS.YELLOW 
                                  ? 'warning-card' 
                                  : ''
                            }
                            style={{ 
                              cursor: 'pointer',
                              borderLeft: `4px solid ${borderColor}`,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              height: '100%',
                              borderRadius: '4px'
                            }}
                            bodyStyle={{ padding: '12px' }}
                            onClick={handleNodeClick}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div style={{ 
                                fontWeight: 'bold', 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                maxWidth: '70%',
                                fontSize: '14px'
                              }}>
                                {nodeName}
                              </div>
                              <StatusBadge status={borderColor} />
                            </div>
                            
                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                              <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center' }}>
                                <Tag color={
                                  nodeStatus.includes('PRIMARY') || nodeStatus.includes('MASTER') 
                                    ? 'green' 
                                    : nodeStatus.includes('SECONDARY') || nodeStatus.includes('SLAVE')
                                      ? 'blue'
                                      : 'red'
                                } style={{ margin: 0 }}>
                                  {nodeStatus}
                                </Tag>
                              </div>
                              
                              <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center' }}>
                                <EnvironmentOutlined style={{ marginRight: 4 }} /> {location}
                              </div>
                              
                              <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center' }}>
                                <GlobalOutlined style={{ marginRight: 4 }} /> {ipAddress}
                              </div>
                              
                              {/* MongoDB service status display */}
                              {mongoServiceStatus && (
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: mongoServiceStatus === 'RUNNING' ? 'green' : 'red',
                                  display: 'flex',
                                  alignItems: 'center',
                                  marginTop: 4
                                }}>
                                  <DatabaseOutlined style={{ marginRight: 4 }} /> Service: {mongoServiceStatus}
                                </div>
                              )}
                              
                              {/* PostgreSQL service status display */}
                              {pgServiceStatus && (
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: pgServiceStatus === 'RUNNING' ? 'green' : 'red',
                                  display: 'flex',
                                  alignItems: 'center',
                                  marginTop: 4
                                }}>
                                  <DatabaseOutlined style={{ marginRight: 4 }} /> Service: {pgServiceStatus}
                                </div>
                              )}
                              
                              <div style={{ marginTop: 8 }}>
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  fontSize: '12px',
                                  color: '#666',
                                  marginBottom: 2
                                }}>
                                  <span><HddOutlined /> Disk</span>
                                  <span>{freeDiskData}</span>
                                </div>
                                <Progress 
                                  percent={Number(freeDiskPercent)} 
                                  size="small" 
                                  status={
                                    Number(freeDiskPercent) < 20 
                                      ? 'exception' 
                                      : Number(freeDiskPercent) < 40 
                                        ? 'active' 
                                        : 'success'
                                  }
                                  strokeColor={getDiskProgressColor(Number(freeDiskPercent))}
                                />
                              </div>
                            </Space>
                          </Card>
                        </Col>
                      );
                    })}
                </Row>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default NodeStatusGrid; 