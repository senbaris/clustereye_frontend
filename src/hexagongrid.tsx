import React from "react";
import Hexagon from "./hexagon";
import { NodeType } from "./type"; // NodeType'ı import et

type HexagonGridProps = {
  nodes: NodeType[];
  size?: "small" | "large"; // Hexagon boyutu
};

const HexagonGrid: React.FC<HexagonGridProps> = ({ nodes, size = "small" }) => {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0px",
        }}
      >
        {nodes.map((node, index) => (
          <Hexagon key={index} node={node} size={size} />
        ))}
      </div>
    );
  };
  
  export default HexagonGrid;
  