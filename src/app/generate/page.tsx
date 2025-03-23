export default function GeneratePage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Generate 3D Model</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="bg-card p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Upload Images</h2>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <p className="text-muted-foreground">Drag and drop images here or click to upload</p>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Generation Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Quality</label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2">
                  <option value="draft">Draft</option>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Style</label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2">
                  <option value="realistic">Realistic</option>
                  <option value="stylized">Stylized</option>
                  <option value="low-poly">Low Poly</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="bg-card p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Preview will appear here</p>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Generation Status</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <span className="text-sm text-muted-foreground">Ready to generate</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Estimated Time</span>
                <span className="text-sm text-muted-foreground">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 