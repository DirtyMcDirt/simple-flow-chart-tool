# Simple Flow Chart Tool

A lightweight, user-friendly flow chart tool designed for visualizing app user flows with a focus on simplicity and readability.

## Features

- Create various node types (Process, Decision, Start/End, Input/Output)
- Connect nodes with automatic curved paths
- Label connections to describe transitions
- Edit node and connection properties
- Drag and drop interface for easy positioning
- Export diagrams as PNG or JSON
- Import saved diagrams from JSON
- Zoom controls for working with larger diagrams

## Getting Started

### Option 1: Run directly in browser

1. Clone this repository or download the files
2. Open `index.html` in your web browser
3. Start creating your flow chart!

### Option 2: Run on a local server

If you want to avoid potential CORS issues when exporting or importing:

1. Clone this repository
2. Start a local server in the repository directory
   - Using Python: `python -m http.server`
   - Using Node.js: Install `http-server` globally with `npm install -g http-server` and run `http-server`
3. Open the provided URL in your browser (usually `http://localhost:8000` or similar)

## How to Use

### Creating Nodes

1. Select a node type from the dropdown in the "Add Elements" section
2. Click the "Add Node" button
3. The node will appear in the center of your viewport

### Connecting Nodes

**Method 1:**
1. Click the "Connect Nodes" button
2. Click on a source node to start the connection
3. Hover over the target node and click to complete the connection

**Method 2:**
1. Right-click on a node to open the context menu
2. Select "Connect to..."
3. Click on the target node to complete the connection

### Editing Elements

- **Edit Node Text**: Double-click on a node or right-click and select "Edit Text"
- **Edit Connection Label**: Double-click on a connection label or right-click on it and select "Edit Label"
- **Move Node**: Click and drag a node to reposition it
- **Delete Elements**: Select an element and press the "Delete Selected" button or right-click and select "Delete"

### Properties Panel

Select any node or connection to view and edit its properties in the right panel:

- **Nodes**: Change type, text, and precise position
- **Connections**: Edit label and view connected nodes

### Exporting Your Diagram

- **Export as PNG**: Click "Export as PNG" to save an image of your diagram
- **Save as JSON**: Click "Save as JSON" to export your diagram data for later importing
- **Load from JSON**: Click "Load from JSON" to import a previously saved diagram

## Browser Compatibility

This tool works best in modern browsers such as:
- Chrome
- Firefox
- Edge
- Safari

## Dependencies

- [html2canvas](https://html2canvas.hertzen.com/) (loaded automatically for PNG export)

## Customization

The tool is designed with a clean, minimalist approach to keep the focus on the flow structure. If you want to customize the appearance:

- Edit `styles.css` to change colors, sizes, and visual elements
- Modify node types and styles in both CSS and JavaScript

## License

This project is open source and available under the MIT License.
