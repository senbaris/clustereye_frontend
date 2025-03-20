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
};

  
  
  export type DashboardData = {
    mongodb: NodeType[];
    postgresql: NodeType[];
  };
  
  