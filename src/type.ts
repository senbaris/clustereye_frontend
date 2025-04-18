export type NodeType = {
    nodename?: string;
    Hostname?: string;
    ClusterName?: string;
    replsetname?: string;
    status?: "PRIMARY" | "MASTER" | "SECONDARY" | "SLAVE" | "FAILED";
    NodeStatus?: "PRIMARY" | "MASTER" | "SECONDARY" | "SLAVE" | "FAILED";
    dc?: string;
    DC?: string;
    freediskpercent?: number;
    FDPercent?: number;
    freediskdata?: string; // MongoDB disk alanı
    FreeDisk?: string; // PostgreSQL disk alanı
    dbType?: "MongoDB" | "PostgreSQL"; // Hangi veri tabanı tipi
    MongoStatus?: string; // MongoDB service status
    PGServiceStatus?: string; // PostgreSQL service status
    ReplicationLagSec?: number; // Replication lag in seconds
    IP?: string; // IP address
};

  
  
  export type DashboardData = {
    mongodb: NodeType[];
    postgresql: NodeType[];
  };
  
  