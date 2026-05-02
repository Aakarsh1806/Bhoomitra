import { NextResponse } from "next/server"

interface Node {
  id: string
  [key: string]: any
}

interface Edge {
  source: string
  target: string
  [key: string]: any
}

interface SimulationRequest {
  nodes: Node[]
  edges: Edge[]
  initial_infected: string[]
  blocked_nodes: string[]
  time_steps: number
}

interface TimeStepResult {
  time: number
  infected: string[]
  at_risk: string[]
  healthy: string[]
  protected: string[]
}

interface SimulationResponse {
  timeline: TimeStepResult[]
  final_infected: string[]
  total_infections: number
}

/**
 * Multi-source BFS disease spread simulation
 * Spreads disease from initially infected nodes through the graph over time
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body: SimulationRequest = await req.json()

    const { nodes, edges, initial_infected, blocked_nodes, time_steps } = body

    // Validation
    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json(
        { error: "Invalid nodes array" },
        { status: 400 }
      )
    }

    if (!edges || !Array.isArray(edges)) {
      return NextResponse.json(
        { error: "Invalid edges array" },
        { status: 400 }
      )
    }

    if (!initial_infected || !Array.isArray(initial_infected)) {
      return NextResponse.json(
        { error: "Invalid initial_infected array" },
        { status: 400 }
      )
    }

    if (time_steps <= 0 || time_steps > 100) {
      return NextResponse.json(
        { error: "time_steps must be between 1 and 100" },
        { status: 400 }
      )
    }

    // Build adjacency list from edges
    const adjacencyMap = new Map<string, string[]>()
    nodes.forEach((node) => {
      adjacencyMap.set(node.id, [])
    })

    edges.forEach((edge) => {
      const neighbors = adjacencyMap.get(edge.source) || []
      if (!neighbors.includes(edge.target)) {
        neighbors.push(edge.target)
      }
      adjacencyMap.set(edge.source, neighbors)

      // Add reverse edge for undirected graph
      const reverseNeighbors = adjacencyMap.get(edge.target) || []
      if (!reverseNeighbors.includes(edge.source)) {
        reverseNeighbors.push(edge.source)
      }
      adjacencyMap.set(edge.target, reverseNeighbors)
    })

    // Convert blocked nodes to set for O(1) lookup
    const blockedSet = new Set(blocked_nodes || [])

    // Run BFS simulation for each time step
    const timeline: TimeStepResult[] = []
    let currentInfected = new Set(initial_infected)

    for (let t = 0; t <= time_steps; t++) {
      // Identify at-risk nodes (neighbors of infected that aren't infected/blocked/protected)
      const at_risk = new Set<string>()
      currentInfected.forEach((nodeId) => {
        const neighbors = adjacencyMap.get(nodeId) || []
        neighbors.forEach((neighbor) => {
          if (
            !currentInfected.has(neighbor) &&
            !blockedSet.has(neighbor)
          ) {
            at_risk.add(neighbor)
          }
        })
      })

      // Protected nodes are blocked
      const protected_nodes = Array.from(blockedSet).filter(
        (id) =>
          !currentInfected.has(id) &&
          initial_infected.includes(id) === false
      )

      // Healthy nodes are those not infected, at-risk, or protected
      const healthy = nodes
        .map((n) => n.id)
        .filter(
          (id) =>
            !currentInfected.has(id) &&
            !at_risk.has(id) &&
            !blockedSet.has(id)
        )

      timeline.push({
        time: t,
        infected: Array.from(currentInfected).sort(),
        at_risk: Array.from(at_risk).sort(),
        healthy: healthy.sort(),
        protected: protected_nodes.sort(),
      })

      // Spread infection to at-risk nodes for next time step
      if (t < time_steps) {
        const newInfected = new Set(currentInfected)
        at_risk.forEach((nodeId) => {
          // Each at-risk node has a probability of becoming infected
          // For demo purposes, we use a simple rule: if neighbor is infected, it becomes infected
          // This can be made more sophisticated with infection probability
          newInfected.add(nodeId)
        })
        currentInfected = newInfected
      }
    }

    const response: SimulationResponse = {
      timeline,
      final_infected: Array.from(currentInfected).sort(),
      total_infections: currentInfected.size,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Simulation error:", error)
    return NextResponse.json(
      { error: "Simulation failed", details: String(error) },
      { status: 500 }
    )
  }
}
