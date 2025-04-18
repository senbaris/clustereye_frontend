import { NodeType } from "./type";

export const flattenMongoData = (data: any): NodeType[] => {
    console.log("flattenMongoData received data:", data);
    const flattened: NodeType[] = [];
  
    if (!data || !Array.isArray(data)) {
      console.error("MongoDB data is not an array or is undefined:", data);
      return [];
    }
  
    try {
      data.forEach((replSetGroup: any) => {
        // Check if the item is an object
        if (typeof replSetGroup !== 'object' || replSetGroup === null) {
          console.error("Invalid replSetGroup item:", replSetGroup);
          return; // Skip this iteration
        }
  
        Object.keys(replSetGroup).forEach((replSetName) => {
          const replSetNodes = replSetGroup[replSetName];
  
          if (Array.isArray(replSetNodes)) {
            replSetNodes.forEach((node: any) => {
              // Skip if node is not an object
              if (!node || typeof node !== 'object') {
                console.warn("Skipping invalid node:", node);
                return;
              }
  
              // Map the node data to NodeType format, trying different possible field names
              const nodeData: NodeType = {
                nodename: node.nodename || node.Hostname || node.hostname || "N/A",
                replsetname: node.replsetname || node.ReplicaSetName || replSetName,
                status: node.status || node.NodeStatus || node.Status || "N/A",
                dc: node.dc || node.Location || node.DC || "N/A",
                freediskpercent: parseFloat(node.freediskpercent) || node.FDPercent || 0,
                freediskdata: node.freediskdata || node.FreeDisk || "Unknown",
                ClusterName: replSetName,
                dbType: "MongoDB",
                // Also keep original fields for compatibility
                Hostname: node.Hostname,
                NodeStatus: node.NodeStatus,
                MongoStatus: node.MongoStatus,
                ReplicationLagSec: node.ReplicationLagSec,
                IP: node.IP || node.ip
              };
              
              console.log(`Processed MongoDB node: ${nodeData.nodename} (${replSetName})`);
              flattened.push(nodeData);
            });
          } else {
            console.error(`Unexpected data format for replSetName: ${replSetName}`, replSetNodes);
          }
        });
      });
  
      console.log(`Flattened ${flattened.length} MongoDB nodes`);
      return flattened;
    } catch (error) {
      console.error("Error in flattenMongoData:", error);
      return [];
    }
  };

  // utils/disk-utils.ts
export const parseDiskSize = (diskSize: string | undefined): number => {
  if (!diskSize) return 0;
  const sizeMatch = diskSize.match(/^([\d.]+)\s*(GB|TB)$/i);
  if (!sizeMatch) return 0;
  const sizeValue = parseFloat(sizeMatch[1]);
  const sizeUnit = sizeMatch[2].toUpperCase();
  return sizeUnit === "TB" ? sizeValue * 1024 : sizeValue;
};

  
  export const flattenPostgresData = (data: any): NodeType[] => {
    console.log("flattenPostgresData received data:", data);
    const flattened: NodeType[] = [];
  
    if (!data || !Array.isArray(data)) {
      console.error("PostgreSQL data is not an array or is undefined:", data);
      return [];
    }
  
    try {
      data.forEach((clusterGroup: any) => {
        // Check if the item is an object
        if (typeof clusterGroup !== 'object' || clusterGroup === null) {
          console.error("Invalid clusterGroup item:", clusterGroup);
          return; // Skip this iteration
        }
        
        Object.keys(clusterGroup).forEach((clusterName) => {
          const clusterNodes = clusterGroup[clusterName];
  
          if (Array.isArray(clusterNodes)) {
            clusterNodes.forEach((node: any) => {
              // Skip if node is not an object
              if (!node || typeof node !== 'object') {
                console.warn("Skipping invalid PostgreSQL node:", node);
                return;
              }
              
              flattened.push({
                ...node,
                ClusterName: clusterName,
                FreeDisk: node.FreeDisk || "Unknown", 
                dbType: "PostgreSQL", 
              });
            });
          } else {
            console.error(`Unexpected data format for clusterName: ${clusterName}`, clusterNodes);
          }
        });
      });
  
      console.log(`Flattened ${flattened.length} PostgreSQL nodes`);
      return flattened;
    } catch (error) {
      console.error("Error in flattenPostgresData:", error);
      return [];
    }
  };
  
