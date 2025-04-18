import { Tooltip } from "antd";
import { useState } from "react";
import { NodeType } from "./type";
import "./index.css";

export const STATUS_COLORS = {
    GREEN: "#4CAF50",
    YELLOW: "#FFC107",
    RED: "#F44336",
    HOVER: "#FFD700", // Hover sırasında kullanılacak renk
};

type HexagonProps = {
    node: NodeType;
    size?: "small" | "large"; // Hexagon boyutu
};

const parseDiskSize = (diskData: string | undefined): number => {
    if (!diskData) return 0; // Eğer veri yoksa 0 döndür
    const tbMatch = diskData.match(/([\d.]+)\s*TB/i); // TB'yi eşleştir
    const gbMatch = diskData.match(/([\d.]+)\s*GB/i); // GB'yi eşleştir

    if (tbMatch) {
        return parseFloat(tbMatch[1]) * 1024; // TB'yi GB'ye çevir
    } else if (gbMatch) {
        return parseFloat(gbMatch[1]); // GB'yi direkt döndür
    }

    return 0; // Belirtilen birim yoksa varsayılan 0 döndür
};

export const getStatusColor = (node: NodeType): string => {
    // For debugging
    console.log("Evaluating status for node:", node.nodename || node.Hostname, node);

    // Check if node has MongoDB or PostgreSQL service status
    const mongoStatus = node.MongoStatus ? node.MongoStatus.toUpperCase() : "";
    const pgStatus = node.PGServiceStatus ? node.PGServiceStatus.toUpperCase() : "";
    
    // If any service status exists and is not RUNNING, show as critical
    if ((mongoStatus && mongoStatus !== "RUNNING") || 
        (pgStatus && pgStatus !== "RUNNING")) {
        return STATUS_COLORS.RED;
    }
    
    // Check node operational status
    const isHealthyStatus =
        node.status === "PRIMARY" ||
        node.status === "MASTER" ||
        node.status === "SECONDARY" ||
        node.status === "SLAVE" ||
        node.NodeStatus === "PRIMARY" ||
        node.NodeStatus === "MASTER" ||
        node.NodeStatus === "SECONDARY" ||
        node.NodeStatus === "SLAVE";
    
    // Check operational status
    if (!isHealthyStatus) {
        console.log(`Node ${node.nodename || node.Hostname} has unhealthy operational status`);
        return STATUS_COLORS.RED; // Kritik Durum
    }

    // Check disk space
    const freeDisk = node.freediskpercent || node.FDPercent || 100;
    const freeDiskData = parseDiskSize(node.freediskdata || node.FreeDisk);

    if (freeDisk < 25 && freeDiskData < 100) {
        console.log(`Node ${node.nodename || node.Hostname} has low disk space: ${freeDisk}% free, ${freeDiskData}GB`);
        return STATUS_COLORS.YELLOW; // Uyarı Durumu
    }

    return STATUS_COLORS.GREEN; // Sağlıklı Durum
};


const Hexagon: React.FC<HexagonProps> = ({ node, size = "small" }) => {
    const [hovered, setHovered] = useState(false); // Hover durumu
    const statusColor = getStatusColor(node);

    const dimensions =
        size === "large"
            ? { width: "50px", height: "50px", fontSize: "8px" }
            : { width: "25px", height: "25px", fontSize: "2px" };

    const isCritical = statusColor === STATUS_COLORS.RED;

    // Get node display values with fallbacks
    const nodeStatus = node.dbType === "MongoDB" 
        ? (node.status || node.NodeStatus || "N/A")
        : (node.NodeStatus || node.status || "N/A");
    
    const location = node.dbType === "MongoDB"
        ? (node.dc || node.DC || "N/A")
        : (node.DC || node.dc || "N/A");
    
    const nodeName = node.dbType === "MongoDB"
        ? (node.nodename || node.Hostname || "N/A")
        : (node.Hostname || node.nodename || "N/A");
    
    const clusterName = node.dbType === "MongoDB"
        ? (node.replsetname || node.ClusterName || "N/A")
        : (node.ClusterName || "N/A");
    
    const freeDiskPercent = node.dbType === "MongoDB"
        ? (node.freediskpercent || node.FDPercent || "N/A")
        : (node.FDPercent || node.freediskpercent || "N/A");
    
    const freeDiskData = node.dbType === "MongoDB"
        ? (node.freediskdata || node.FreeDisk || "N/A")
        : (node.FreeDisk || node.freediskdata || "N/A");

    const mongoSpecificInfo = node.dbType === "MongoDB" && node.MongoStatus
        ? `<strong>Service Status:</strong> ${node.MongoStatus}<br/>`
        : '';
    
    const replicationInfo = node.dbType === "MongoDB" && node.ReplicationLagSec !== undefined
        ? `<strong>Replication Lag:</strong> ${node.ReplicationLagSec} seconds<br/>`
        : '';

    const tooltipContent = `
        <strong>${node.dbType} Node</strong><br/>
        <strong>Name:</strong> ${nodeName}<br/>
        <strong>${node.dbType === "MongoDB" ? "ReplSet" : "Cluster"}:</strong> ${clusterName}<br/>
        <strong>Status:</strong> ${nodeStatus}<br/>
        ${mongoSpecificInfo}
        ${replicationInfo}
        <strong>Location:</strong> ${location}<br/>
        <strong>Free Disk:</strong> ${freeDiskPercent}%<br/>
        <strong>Free Disk Data:</strong> ${freeDiskData}<br/>
        <strong>IP:</strong> ${node.IP || "N/A"}
    `;


    return (
        <Tooltip title={<span dangerouslySetInnerHTML={{ __html: tooltipContent }} />}>
            <div
                className={`hexagon ${isCritical ? "blinking" : ""}`}
                style={{
                    position: "relative",
                    width: dimensions.width,
                    height: dimensions.height,
                    backgroundColor: hovered ? STATUS_COLORS.HOVER : statusColor,
                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    margin: "2px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease-in-out",
                }}
                onMouseEnter={() => setHovered(true)} // Hover başladığında
                onMouseLeave={() => setHovered(false)} // Hover bittiğinde
            >

            </div>
        </Tooltip>
    );
};

export default Hexagon;
