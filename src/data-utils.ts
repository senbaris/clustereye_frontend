import { NodeType } from "./type";

export const flattenMongoData = (data: any): NodeType[] => {
    const flattened: NodeType[] = [];
  
    data.forEach((replSetGroup: any) => {
      Object.keys(replSetGroup).forEach((replSetName) => {
        const replSetNodes = replSetGroup[replSetName];
  
        if (Array.isArray(replSetNodes)) {
          replSetNodes.forEach((node: any) => {
            flattened.push({
              nodename: node.nodename || "N/A",
              replsetname: node.replsetname || replSetName,
              status: node.status || "N/A",
              dc: node.dc || "N/A",
              freediskpercent: parseFloat(node.freediskpercent) || 0,
              freediskdata: node.freediskdata || "Unknown", // Disk bilgisi ekleniyor
              ClusterName: replSetName,
              dbType: "MongoDB", // MongoDB olduğunu belirtmek için ekleniyor
            });
          });
        } else {
          console.error(`Unexpected data format for replSetName: ${replSetName}`, replSetNodes);
        }
      });
    });
  
    return flattened;
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
    const flattened: NodeType[] = [];
  
    data.forEach((clusterGroup: any) => {
      Object.keys(clusterGroup).forEach((clusterName) => {
        const clusterNodes = clusterGroup[clusterName];
  
        if (Array.isArray(clusterNodes)) {
          clusterNodes.forEach((node: any) => {
            flattened.push({
              ...node,
              ClusterName: clusterName,
              FreeDisk: node.FreeDisk || "Unknown", // Disk bilgisi ekleniyor
              dbType: "PostgreSQL", // PostgreSQL olduğunu belirtmek için ekleniyor
            });
          });
        } else {
          console.error(`Unexpected data format for clusterName: ${clusterName}`, clusterNodes);
        }
      });
    });
  
    return flattened;
  };
  
