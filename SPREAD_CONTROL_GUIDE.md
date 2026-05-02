# 🌾 Spread Control AI - Implementation Guide

## Overview

**Spread Control AI** is a fully integrated dashboard feature for Bhoomitra that simulates disease spread across farm plots and recommends optimal intervention strategies.

---

## 🎯 Key Features

### 1. **Disease Spread Simulation**
- Multi-source BFS algorithm simulates disease progression
- Visualizes infection spread over time
- Shows infected, at-risk, and healthy plots
- Configurable time steps (1-20 days)

### 2. **AI-Powered Optimization**
- Greedy algorithm recommends best plots to protect
- Respects budget constraints (1-12 plots)
- Calculates impact and infections prevented
- Real-time re-simulation based on selections

### 3. **Interactive Controls**
- **Auto Mode**: AI recommends plots based on budget
- **Manual Mode**: Click plots to select them manually
- Time steps slider: Adjust simulation duration
- Budget slider: Set protection limit

### 4. **Real-Time Visualization**
- Canvas-based graph showing farm plots as nodes
- Color-coded states:
  - 🟢 Green: Healthy
  - 🔴 Red: Infected
  - 🟡 Yellow: At Risk
  - 🔵 Blue: Protected
- Click to select (manual mode)
- Hover for details

### 5. **Timeline Animation**
- Play/pause simulation progression
- Step through each time period
- Real-time infection progression bars
- Day-by-day statistics

### 6. **Impact Analysis**
- Baseline vs. intervention comparison
- Total infections prevented
- Percentage reduction visualization
- Clear action items

---

## 📂 File Structure

```
app/
├── dashboard/
│   ├── spread-control/
│   │   └── page.tsx          # Main page (orchestrator)
│   └── layout.tsx            # Updated with new route
├── api/spread-control/
│   ├── simulate/route.ts     # Simulation endpoint
│   └── optimize/route.ts     # Optimization endpoint

components/spread-control/
├── graph-visualization.tsx   # Canvas-based graph
├── control-panel.tsx         # Sliders and toggles
├── recommendations-panel.tsx # Ranked recommendations
├── impact-comparison.tsx     # Recharts bar chart
├── timeline-controls.tsx     # Play/pause animation
└── insight-box.tsx           # Context-aware insights
```

---

## 🚀 How to Use

### Step 1: Navigate to the Feature
1. Log in to Bhoomitra dashboard
2. Click **"Spread Control AI"** in the sidebar (Shield icon)

### Step 2: Choose Your Mode

#### 🤖 Auto Mode (AI Recommendations)
1. Set your **Protection Budget** (how many plots to protect)
2. Set **Time Steps** (simulation duration)
3. Click **"Get AI Recommendations"**
4. AI analyzes and recommends top plots by impact
5. Automatically re-simulates with recommendations

#### 🎮 Manual Mode (User Control)
1. Set **Time Steps** for simulation
2. Click plots in the graph to protect them
3. Simulation updates in real-time
4. Watch disease spread reduce based on your selections

### Step 3: Analyze Results
- **Impact Analysis**: See how many infections you prevent
- **Timeline**: Play the simulation day-by-day
- **Insights**: Get context-aware guidance
- **Recommendations**: See which plots save the most others

---

## 🔧 API Endpoints

### POST `/api/spread-control/simulate`

Simulates disease spread given a set of protected nodes.

**Request:**
```json
{
  "nodes": [{"id": "plot-0-0", "label": "Plot 1", ...}],
  "edges": [{"source": "plot-0-0", "target": "plot-0-1"}],
  "initial_infected": ["plot-0-0", "plot-0-1"],
  "blocked_nodes": ["plot-1-1"],
  "time_steps": 10
}
```

**Response:**
```json
{
  "timeline": [
    {
      "time": 0,
      "infected": ["plot-0-0", "plot-0-1"],
      "at_risk": ["plot-0-2", "plot-1-0"],
      "healthy": [...],
      "protected": ["plot-1-1"]
    },
    ...
  ],
  "final_infected": [...],
  "total_infections": 15
}
```

### POST `/api/spread-control/optimize`

Recommends best nodes to protect given a budget.

**Request:**
```json
{
  "nodes": [...],
  "edges": [...],
  "initial_infected": ["plot-0-0"],
  "budget": 3,
  "time_steps": 10
}
```

**Response:**
```json
{
  "recommended_nodes": [
    {
      "node_id": "plot-0-1",
      "impact": 8,
      "infections_prevented": 8,
      "description": "Protect Plot 1 to prevent disease spread"
    },
    ...
  ],
  "total_impact": 20,
  "total_infections_baseline": 25,
  "total_infections_with_intervention": 5,
  "budget_used": 3
}
```

---

## 🧠 Algorithm Details

### Simulation Algorithm
Uses **multi-source BFS (Breadth-First Search)**:
1. Start with initially infected nodes
2. For each time step:
   - Identify "at-risk" nodes (neighbors of infected)
   - Spread infection to all at-risk nodes (except protected)
   - Record state: infected, at-risk, healthy, protected
3. Return timeline showing progression

### Optimization Algorithm
Uses **greedy selection** with iterative simulation:
1. Get baseline infections (no intervention)
2. For each candidate node:
   - Simulate with that node protected
   - Calculate impact (infections prevented)
3. Sort nodes by impact (descending)
4. Select top B nodes (where B = budget)
5. Return recommendations with impact values

---

## 🎨 UI/UX Design

- **Color Scheme**: Bhoomitra green + semantic colors
- **Responsive**: Works on desktop and tablet
- **Farmer-Friendly**: Plain language, no jargon
- **Smooth Animations**: Framer Motion-free, CSS-based
- **Clean Layout**: 2-column design (graph + controls)

---

## ⚙️ Technical Details

### Technologies Used
- **Frontend**: React 18, Next.js 14, TypeScript
- **Charts**: Recharts
- **State Management**: Zustand (existing)
- **Styling**: Tailwind CSS + Radix UI components
- **Visualization**: HTML5 Canvas (custom)

### Performance Considerations
- Canvas rendering for graphs (efficient for large grids)
- Minimal re-renders with proper memoization
- Backend handles all simulations
- Frontend updates only on state changes

### Data Flow
1. User sets parameters (budget, time steps, mode)
2. Initialize graph from farm data (16-plot demo grid)
3. Call `/simulate` endpoint with initial state
4. Display timeline and visualization
5. If optimization requested:
   - Call `/optimize` endpoint
   - Auto-select recommended nodes
   - Re-run simulation
6. User can manually toggle nodes (manual mode)
   - Graph updates trigger instant re-simulation

---

## 🔄 Integration with Bhoomitra

### Farm Data Integration
- Currently uses demo grid (4x4 plots)
- Can be extended to use real farm plots from **Farm Map** module
- Integrates with disease detections from **Detection** module

### State Management
- Uses existing `useFarmStore` (Zustand)
- Detections inform initial infected nodes
- Can log results to `implementedRecords`

### Future Enhancements
1. Integrate with real farm GIS coordinates
2. Machine learning for spread probability
3. Multi-disease simulation
4. Historical intervention tracking
5. Mobile app integration

---

## 🐛 Troubleshooting

### Graph doesn't load
- Check that nodes and edges are properly initialized
- Verify canvas ref is mounted

### Simulation errors
- Check API response in console
- Ensure all required fields in request body
- Verify nodes/edges format

### Recommendations not showing
- Run simulation first (if in auto mode, click "Get AI Recommendations")
- Check budget is > 0
- Verify optimization response in network tab

### Timeline not playing
- Click "Play" button in timeline controls
- Check currentTime < maxTime

---

## 📊 Sample Workflow

1. **Day 0**: Disease detected in 2 plots → Run simulation
2. **See Spread**: Disease will spread to 6 plots if no action taken
3. **Set Budget**: 3 plots can be protected
4. **Get Recommendations**: AI suggests protecting plots 2, 4, 7
5. **View Impact**: With recommendations, only 2 plots infected
6. **Take Action**: Spray recommended plots immediately
7. **Track**: Monitor with timeline animation

---

## 📝 Notes for Developers

- **No External Database**: Uses in-memory state (simulation-focused)
- **Extensible**: Easy to add more algorithms, UI components
- **Type-Safe**: Full TypeScript coverage
- **Test-Friendly**: Modular components, pure functions
- **Accessibility**: Semantic HTML, ARIA labels ready

---

## 🤝 Support & Questions

For issues or questions about the Spread Control AI feature:
1. Check the algorithm details section
2. Review the file structure and code comments
3. Test with demo data first
4. Check browser console for errors

---

**Built with ❤️ for Bhoomitra - Smart Agricultural Management**
