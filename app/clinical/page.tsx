"use client"

export default function ClinicalPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">
            🔬 Clinical & Scientific Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">
            Detailed technical overview of the AI disease detection system used in Bhoomitra.
          </p>
        </div>

        {/* Model Overview */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Model Architecture</h2>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-2">
            <p><strong>Base Model:</strong> MobileNetV2 (Transfer Learning)</p>
            <p><strong>Input Size:</strong> 224 × 224 RGB images</p>
            <p><strong>Preprocessing:</strong> MobileNetV2 preprocess_input normalization</p>
            <p><strong>Output Layer:</strong> Softmax multi-class classifier</p>
            <p><strong>Loss Function:</strong> Categorical Crossentropy</p>
            <p><strong>Optimizer:</strong> Adam</p>
            <p className="text-sm text-muted-foreground mt-2">
              The model extracts hierarchical visual features including lesion geometry,
              chlorotic patterns, texture irregularities, and chromatic deviations.
            </p>
          </div>
        </section>

        {/* Dataset */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Training Dataset</h2>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-2">
            <p><strong>Source:</strong> Kaggle Plant Disease Dataset</p>
            <p><strong>Total Images:</strong> ~175,000 (augmented)</p>
            <p><strong>Classes:</strong> 38+ plant disease categories</p>
            <p><strong>Augmentation Techniques:</strong></p>
            <ul className="list-disc list-inside text-sm">
              <li>Random rotation</li>
              <li>Zoom transformations</li>
              <li>Horizontal flipping</li>
              <li>Lighting & contrast shifts</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Data augmentation improves model generalization and robustness to real-world
              agricultural field conditions.
            </p>
          </div>
        </section>

        {/* Performance */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Performance Metrics</h2>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-2">
            <p><strong>Validation Accuracy:</strong> 92% – 95%</p>
            <p><strong>Precision:</strong> High for fungal disease classes</p>
            <p><strong>Evaluation Method:</strong> Validation on unseen dataset split</p>
            <p className="text-sm text-muted-foreground mt-2">
              The model was evaluated using a hold-out validation set to prevent overfitting
              and ensure generalization capability.
            </p>
          </div>
        </section>

        {/* Environmental Logic */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Environmental Spread Modeling</h2>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-2">
            <p>
              Disease spread probability is correlated with environmental conditions.
            </p>
            <ul className="list-disc list-inside text-sm">
              <li>Humidity &gt; 75%</li>
              <li>Temperature between 18°C – 28°C</li>
              <li>Elevated soil moisture levels</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Spread Risk = f(prediction confidence × humidity × proximity factor)
            </p>
          </div>
        </section>

        {/* Feature Analysis */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Feature Extraction Insight</h2>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-2">
            <ul className="list-disc list-inside text-sm">
              <li>Edge detection for lesion boundary identification</li>
              <li>Color clustering for chlorosis recognition</li>
              <li>Texture irregularity mapping for fungal growth patterns</li>
              <li>Spatial feature hierarchy via convolutional layers</li>
            </ul>
          </div>
        </section>

        {/* Limitations */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Model Limitations</h2>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-2">
            <ul className="list-disc list-inside text-sm">
              <li>Reduced performance under extreme lighting conditions</li>
              <li>Single-leaf analysis (no contextual canopy-level modeling)</li>
              <li>Does not yet include multispectral imaging</li>
            </ul>
          </div>
        </section>

        {/* Future Improvements */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. Future Improvements</h2>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-2">
            <ul className="list-disc list-inside text-sm">
              <li>Explainable AI via Grad-CAM heatmaps</li>
              <li>Drone-based canopy monitoring integration</li>
              <li>Edge-device deployment for offline farms</li>
              <li>IoT-calibrated environmental feedback loops</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  )
}