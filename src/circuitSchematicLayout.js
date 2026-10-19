const NODE_WIDTHS = Object.freeze({ switch: 74, gate: 116, lamp: 96 });
const NODE_HEIGHT = 48;
const SIDE_MARGIN = 24;
const TOP_MARGIN = 28;
const NODE_GAP = 22;
const ROW_GAP = 32;
const DEPTH_GAP = 88;
const DEPTH_SHIFT = 12;
const MAX_NODES_PER_ROW = 4;

function rowWidth(row) {
  return row.reduce((sum, node) => sum + node.width, 0)
    + Math.max(0, row.length - 1) * NODE_GAP;
}

export function buildCircuitSchematic(state) {
  const { switchCount, gates, outputs } = state;
  const nodes = Array.from({ length: switchCount }, (_, index) => ({
    id: `S${index + 1}`,
    type: 'switch',
    index,
    depth: 0,
    width: NODE_WIDTHS.switch,
    height: NODE_HEIGHT,
  }));
  const layers = new Map([[0, nodes.slice()]]);
  const wires = [];

  gates.forEach((gate, index) => {
    const nodeIndex = switchCount + index;
    const inputIndices = gate.b === undefined ? [gate.a] : [gate.a, gate.b];
    const depth = 1 + Math.max(...inputIndices.map((input) => nodes[input].depth));
    const node = {
      id: `G${index + 1}`,
      type: 'gate',
      index,
      nodeIndex,
      depth,
      width: NODE_WIDTHS.gate,
      height: NODE_HEIGHT,
      gate,
      inputIndices,
    };
    nodes.push(node);
    const layer = layers.get(depth) || [];
    layer.push(node);
    layers.set(depth, layer);
    inputIndices.forEach((sourceIndex, inputIndex) => {
      wires.push({
        id: `input-${node.id}-${inputIndex}`,
        source: nodes[sourceIndex].id,
        target: node.id,
        targetPort: inputIndex,
        targetPortCount: inputIndices.length,
      });
    });
  });

  const maxGateDepth = Math.max(0, ...nodes.filter((node) => node.type === 'gate').map((node) => node.depth));
  const lampDepth = maxGateDepth + 1;
  const lamps = outputs.map((output, index) => {
    const lamp = {
      id: `L${index + 1}`,
      type: 'lamp',
      index,
      depth: lampDepth,
      width: NODE_WIDTHS.lamp,
      height: NODE_HEIGHT,
      target: output.target,
      sourceIndex: output.node,
    };
    wires.push({
      id: `output-${lamp.id}`,
      source: nodes[output.node].id,
      target: lamp.id,
      targetPort: 0,
      targetPortCount: 1,
    });
    return lamp;
  });
  nodes.push(...lamps);
  layers.set(lampDepth, lamps);

  const positionedRows = [];
  for (let depth = 0; depth <= lampDepth; depth += 1) {
    const layer = layers.get(depth) || [];
    if (depth > 0) {
      layer.sort((first, second) => {
        const averageInputX = (node) => {
          const sources = node.type === 'lamp'
            ? [nodes[node.sourceIndex]]
            : node.inputIndices.map((input) => nodes[input]);
          return sources.reduce((sum, source) => sum + source.x + source.width / 2, 0) / sources.length;
        };
        return averageInputX(first) - averageInputX(second) || first.index - second.index;
      });
    }

    const rows = [];
    for (let index = 0; index < layer.length; index += MAX_NODES_PER_ROW) {
      rows.push(layer.slice(index, index + MAX_NODES_PER_ROW));
    }
    positionedRows.push(rows);
  }

  const maxRowWidth = Math.max(...positionedRows.flat().map((row) => rowWidth(row)));
  const viewBoxWidth = SIDE_MARGIN * 2 + maxRowWidth + lampDepth * DEPTH_SHIFT;
  let nextLayerY = TOP_MARGIN;
  for (const [depth, rows] of positionedRows.entries()) {
    rows.forEach((row, rowIndex) => {
      let nodeLeft = SIDE_MARGIN
        + depth * DEPTH_SHIFT
        + (maxRowWidth - rowWidth(row)) / 2;
      row.forEach((node) => {
        node.x = nodeLeft;
        node.y = nextLayerY + rowIndex * (NODE_HEIGHT + ROW_GAP);
        nodeLeft += node.width + NODE_GAP;
      });
    });
    const layerHeight = rows.length * NODE_HEIGHT + Math.max(0, rows.length - 1) * ROW_GAP;
    nextLayerY += layerHeight + DEPTH_GAP;
  }
  const viewBoxHeight = nextLayerY - DEPTH_GAP + TOP_MARGIN;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const positionedWires = wires.map((wire) => {
    const source = nodeById.get(wire.source);
    const target = nodeById.get(wire.target);
    const sourceX = source.x + source.width / 2;
    const sourceY = source.y + source.height;
    const targetX = target.type === 'gate'
      ? target.x + target.width * ((wire.targetPort + 1) / (wire.targetPortCount + 1))
      : target.x + 20;
    const targetY = target.y;
    const controlOffset = Math.max(24, (targetY - sourceY) * 0.48);
    return {
      ...wire,
      path: `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + controlOffset}, ${targetX} ${targetY - controlOffset}, ${targetX} ${targetY}`,
      sourcePoint: { x: sourceX, y: sourceY },
      targetPoint: { x: targetX, y: targetY },
    };
  });

  return {
    nodes,
    wires: positionedWires,
    nodeById,
    viewBox: { x: 0, y: 0, width: viewBoxWidth, height: viewBoxHeight },
  };
}
