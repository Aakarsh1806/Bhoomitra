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

interface OptimizationRequest {
  nodes: Node[]
  edges: Edge[]
  initial_infected: string[]
  budget: number
  time_steps: number
}

interface RecommendedNode {
  node_id: string
  impact: number
  infections_prevented: number
  description: string
}

interface OptimizationResponse {
  recommended_nodes: RecommendedNode[]
  total_impact: number
  total_infections_baseline: number
  total_infections_with_intervention: number
  budget_used: number
}

/**
 * Greedy optimization algorithm to select best nodes to protect
 * Ranks nodes by their potential to prevent infections
 */
async function runSimulation(
  nodes: Node[],
  edges: Edge[],
  initial_infected: string[],
  blocked_nodes: string[],
  time_steps: number
): Promise<number> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/spread-control/simulate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          initial_infected,
          blocked_nodes,
          time_steps,
        }),
      }
    )

    const data = await response.json()
    return data.total_infections || 0
  } catch (error) {
    console.error("Simulation error:", error)
    return initial_infected.length
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body: OptimizationRequest = await req.json()

    const { nodes, edges, initial_infected, budget, time_steps } = body

    // Validation
    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json(
        { error: "Invalid nodes array" },
        { status: 400 }
      )
    }

    if (budget <= 0 || budget > nodes.length) {
      return NextResponse.json(
        { error: "Invalid budget" },
        { status: 400 }
      )
    }

    if (time_steps <= 0 || time_steps > 100) {
      return NextResponse.json(
        { error: "time_steps must be between 1 and 100" },
        { status: 400 }
      )
    }

    // Build adjacency map
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

      const reverseNeighbors = adjacencyMap.get(edge.target) || []
      if (!reverseNeighbors.includes(edge.source)) {
        reverseNeighbors.push(edge.source)
      }
      adjacencyMap.set(edge.target, reverseNeighbors)
    })

    // Get baseline infections (no intervention)
    const baselineInfections = await runSimulation(
      nodes,
      edges,
      initial_infected,
      [],
      time_steps
    )

    // Greedy selection: iteratively pick the node that reduces infections most
    const candidateNodes = nodes
      .map((n) => n.id)
      .filter((id) => !initial_infected.includes(id))

    const recommendedNodes: RecommendedNode[] = []
    const selectedNodes: string[] = []

    // For each candidate node, calculate impact if we protect it
    const impacts = new Map<string, number>()

    for (const candidateId of candidateNodes) {
      const blocked = [...selectedNodes, candidateId]
      const infectionsWithBlock = await runSimulation(
        nodes,
        edges,
        initial_infected,
        blocked,
        time_steps
      )

      const impact = baselineInfections - infectionsWithBlock
      impacts.set(candidateId, impact)
    }

    // Sort by impact (descending)
    const sortedByImpact = Array.from(impacts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, budget)

    let totalImpact = 0
    for (const [nodeId, impact] of sortedByImpact) {
      selectedNodes.push(nodeId)
      totalImpact += impact

      recommendedNodes.push({
        node_id: nodeId,
        impact: Math.round(impact),
        infections_prevented: Math.round(impact),
        description: `Protect Plot ${nodeId.replace("plot-", "")} to prevent disease spread`,
      })
    }

    // Get final infections with all interventions
    const finalInfections = await runSimulation(
      nodes,
      edges,
      initial_infected,
      selectedNodes,
      time_steps
    )

    const response: OptimizationResponse = {
      recommended_nodes: recommendedNodes,
      total_impact: Math.round(totalImpact),
      total_infections_baseline: baselineInfections,
      total_infections_with_intervention: finalInfections,
      budget_used: selectedNodes.length,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Optimization error:", error)
    return NextResponse.json(
      { error: "Optimization failed", details: String(error) },
      { status: 500 }
    )
  }
}
