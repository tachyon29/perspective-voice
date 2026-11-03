import { useRef, useState, type DragEvent } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";

export type DesignComponentId =
  | "client"
  | "api_gateway"
  | "payment_service"
  | "idempotency_store"
  | "payments_db"
  | "queue"
  | "worker"
  | "monitoring";

export interface DesignNode {
  id: DesignComponentId;
  x: number;
  y: number;
}

export interface SystemDesignDraft {
  nodes: DesignNode[];
  connections: string[];
}

export interface SystemDesignReview {
  success: boolean;
  message: string;
  passed: string[];
  missing: string[];
}

export const designComponents: Array<{ id: DesignComponentId; name: string; label: string; detail: string }> = [
  { id: "client", name: "Customer app", label: "CLIENT", detail: "Starts a payment request" },
  { id: "api_gateway", name: "API Gateway", label: "GATEWAY", detail: "Authenticates and routes requests" },
  { id: "payment_service", name: "Payment service", label: "COMPUTE", detail: "Applies payment rules" },
  { id: "idempotency_store", name: "Idempotency store", label: "DYNAMODB", detail: "Recognizes safe retries" },
  { id: "payments_db", name: "Payments database", label: "RDS · MYSQL", detail: "Stores payment records" },
  { id: "queue", name: "Event queue", label: "SQS", detail: "Buffers follow-up work" },
  { id: "worker", name: "Receipt worker", label: "LAMBDA", detail: "Sends payment receipts" },
  { id: "monitoring", name: "Monitoring", label: "CLOUDWATCH", detail: "Tracks errors and latency" },
];

interface SystemDesignExerciseProps {
  value: SystemDesignDraft;
  onChange: (next: SystemDesignDraft) => void;
  review: SystemDesignReview | null;
  isReviewing: boolean;
  onReview: () => void;
}

const defaultPositions: Array<[number, number]> = [
  [12, 45], [32, 45], [52, 45], [75, 25], [75, 62], [45, 78], [65, 82], [88, 82],
];

export default function SystemDesignExercise({ value, onChange, review, isReviewing, onReview }: SystemDesignExerciseProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [connectionStart, setConnectionStart] = useState<DesignComponentId | null>(null);
  const placed = new Set(value.nodes.map((node) => node.id));
  const componentById = new Map(designComponents.map((component) => [component.id, component]));

  const placeComponent = (id: DesignComponentId, x?: number, y?: number) => {
    if (placed.has(id)) return;
    const position = defaultPositions[designComponents.findIndex((item) => item.id === id)];
    onChange({
      ...value,
      nodes: [...value.nodes, { id, x: x ?? position[0], y: y ?? position[1] }],
    });
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(12, Math.min(88, ((event.clientY - rect.top) / rect.height) * 100));
    const componentId = event.dataTransfer.getData("application/perspective-component") as DesignComponentId;
    const nodeId = event.dataTransfer.getData("application/perspective-node") as DesignComponentId;
    if (componentId) placeComponent(componentId, x, y);
    else if (nodeId) onChange({ ...value, nodes: value.nodes.map((node) => node.id === nodeId ? { ...node, x, y } : node) });
  };

  const connectNode = (id: DesignComponentId) => {
    if (!connectionStart) {
      setConnectionStart(id);
      return;
    }
    if (connectionStart !== id) {
      const connection = `${connectionStart}>${id}`;
      if (!value.connections.includes(connection)) onChange({ ...value, connections: [...value.connections, connection] });
    }
    setConnectionStart(null);
  };

  const removeNode = (id: DesignComponentId) => {
    onChange({
      nodes: value.nodes.filter((node) => node.id !== id),
      connections: value.connections.filter((edge) => !edge.startsWith(`${id}>`) && !edge.endsWith(`>${id}`)),
    });
    setConnectionStart(null);
  };

  const clearDesign = () => {
    onChange({ nodes: [], connections: [] });
    setConnectionStart(null);
  };

  return (
    <section className="system-design-exercise" aria-label="Payment system design exercise">
      <div className="system-design-brief">
        <p className="eyebrow">ARCH-401 · CAPSTONE</p>
        <h3>Design a payment flow that survives retries</h3>
        <p>Customers expect a payment to happen once—even if the network retries. Build a small AWS-style architecture, then connect the request path and data stores.</p>
        <div className="system-design-requirements">
          <strong>Core flow</strong>
          <span>Customer app → API Gateway → Payment service → Idempotency store + Payments database</span>
        </div>
      </div>

      <div className="system-design-builder">
        <aside className="system-design-palette" aria-label="Architecture components">
          <div className="system-design-palette-title"><strong>COMPONENTS</strong><small>Drag or tap to add</small></div>
          {designComponents.map((component) => (
            <button
              type="button"
              draggable={!placed.has(component.id)}
              disabled={placed.has(component.id)}
              key={component.id}
              onDragStart={(event) => event.dataTransfer.setData("application/perspective-component", component.id)}
              onClick={() => placeComponent(component.id)}
              title={component.detail}
            >
              <span>{component.label}</span><strong>{component.name}</strong><small>{placed.has(component.id) ? "On canvas" : component.detail}</small>
            </button>
          ))}
        </aside>

        <div className="system-design-canvas-column">
          <div className="system-design-canvas-toolbar">
            <span>{connectionStart ? `Select a destination for ${componentById.get(connectionStart)?.name}` : "Select two components to connect them"}</span>
            <button type="button" onClick={clearDesign}><RotateCcw size={12} /> Reset</button>
          </div>
          <div
            className="system-design-canvas"
            ref={canvasRef}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
            aria-label="Architecture canvas. Drop components here, then connect them by selecting source and destination."
          >
            <svg className="system-design-edges" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              <defs><marker id="system-design-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#82958a" /></marker></defs>
              {value.connections.map((edge) => {
                const [sourceId, destinationId] = edge.split(">");
                const source = value.nodes.find((node) => node.id === sourceId);
                const destination = value.nodes.find((node) => node.id === destinationId);
                if (!source || !destination) return null;
                return <line key={edge} x1={source.x * 10} y1={source.y * 6} x2={destination.x * 10} y2={destination.y * 6} markerEnd="url(#system-design-arrow)" />;
              })}
            </svg>
            {value.nodes.map((node) => {
              const component = componentById.get(node.id)!;
              const isSelected = connectionStart === node.id;
              return (
                <div
                  className={`system-design-node${isSelected ? " selected" : ""}`}
                  key={node.id}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.setData("application/perspective-node", node.id); event.stopPropagation(); }}
                  role="group"
                  aria-label={`${component.name}. Drag to move.`}
                >
                  <button className="system-design-connect" type="button" onClick={() => connectNode(node.id)} aria-label={`Select ${component.name} to connect`}>
                    <span>{component.label}</span><strong>{component.name}</strong>
                  </button>
                  <button type="button" aria-label={`Remove ${component.name}`} onClick={(event) => { event.stopPropagation(); removeNode(node.id); }}><X size={12} /></button>
                </div>
              );
            })}
            {value.nodes.length === 0 && <p className="system-design-empty">Drag components here or tap a component to start.</p>}
          </div>
          <div className="system-design-actions">
            <p>Bonus: add an SQS queue and Lambda worker for receipts, and CloudWatch for service health.</p>
            <button type="button" onClick={onReview} disabled={isReviewing}>{isReviewing ? "Reviewing…" : "Run design review"}<ArrowRight size={14} /></button>
          </div>
          {review && (
            <div className={`system-design-review${review.success ? " passed" : ""}`} role="status">
              <strong>{review.success ? <><Check size={14} /> Design review passed</> : "A few design pieces need attention"}</strong>
              <p>{review.message}</p>
              {!!review.passed.length && <ul>{review.passed.map((item) => <li key={item}>{item}</li>)}</ul>}
              {!!review.missing.length && <ul>{review.missing.map((item) => <li key={item}>{item}</li>)}</ul>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
