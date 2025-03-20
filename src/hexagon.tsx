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
    const isHealthyStatus =
        node.status === "PRIMARY" ||
        node.status === "MASTER" ||
        node.status === "SECONDARY" ||
        node.status === "SLAVE" ||
        node.NodeStatus === "PRIMARY" ||
        node.NodeStatus === "MASTER" ||
        node.NodeStatus === "SECONDARY" ||
        node.NodeStatus === "SLAVE";

    const freeDisk = node.freediskpercent || node.FDPercent || 100;
    const freeDiskData = parseDiskSize(node.freediskdata || node.FreeDisk);

    if (!isHealthyStatus) {
        return STATUS_COLORS.RED; // Kritik Durum
    }

    if (freeDisk < 25 && freeDiskData < 100) {
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

    const tooltipContent =
        node.dbType === "MongoDB"
            ? `
              <strong>MongoDB Node</strong><br/>
              <strong>Name:</strong> ${node.nodename || "N/A"}<br/>
              <strong>ReplSet:</strong> ${node.replsetname || "N/A"}<br/>
              <strong>Status:</strong> ${node.status || "N/A"}<br/>
              <strong>Location:</strong> ${node.dc || "N/A"}<br/>
              <strong>Free Disk:</strong> ${node.freediskpercent || "N/A"}%<br/>
              <strong>Free Disk Data:</strong> ${node.freediskdata || "N/A"}
            `
            : `
              <strong>PostgreSQL Node</strong><br/>
              <strong>Hostname:</strong> ${node.Hostname || "N/A"}<br/>
              <strong>Cluster:</strong> ${node.ClusterName || "N/A"}<br/>
              <strong>Status:</strong> ${node.NodeStatus || "N/A"}<br/>
              <strong>Location:</strong> ${node.DC || "N/A"}<br/>
              <strong>Free Disk:</strong> ${node.FDPercent || "N/A"}%<br/>
              <strong>Free Disk Data:</strong> ${node.FreeDisk || "N/A"}
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
